
CREATE INDEX IF NOT EXISTS idx_fraud_events_created_at ON public.fraud_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_events_license_key ON public.fraud_events (license_key) WHERE license_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fraud_events_device_id ON public.fraud_events (device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fraud_events_ip_address ON public.fraud_events (ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fraud_events_severity ON public.fraud_events (severity);

CREATE OR REPLACE FUNCTION public.get_pilantrinhas(
  p_since timestamptz,
  p_severities text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_patterns text[] DEFAULT NULL,
  p_min_risk int DEFAULT 0,
  p_max_risk int DEFAULT 100,
  p_hide_fp boolean DEFAULT true,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_total int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT
      COALESCE(license_key, device_id, ip_address, id::text) AS k,
      license_key, device_id, ip_address, event_type, severity, created_at
    FROM public.fraud_events
    WHERE created_at >= p_since
  ),
  fp AS (
    SELECT event_key FROM public.fraud_event_reviews WHERE status = 'false_positive'
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (NOT p_hide_fp OR k NOT IN (SELECT event_key FROM fp))
  ),
  grouped AS (
    SELECT
      k AS key,
      MAX(license_key) AS license_key,
      MAX(device_id)   AS device_id,
      MAX(ip_address)  AS ip_address,
      COUNT(*)::int    AS cnt,
      MAX(created_at)  AS last_seen,
      MIN(created_at)  AS first_seen,
      array_agg(DISTINCT event_type) AS event_types,
      (CASE
        WHEN bool_or(severity='critical') THEN 'critical'
        WHEN bool_or(severity='error')    THEN 'error'
        WHEN bool_or(severity='warn')     THEN 'warn'
        ELSE 'info' END) AS worst_severity,
      LEAST(100, ROUND(
        SUM(
          CASE severity
            WHEN 'critical' THEN 30
            WHEN 'error'    THEN 18
            WHEN 'warn'     THEN 8
            ELSE 2
          END
          * GREATEST(0.2::numeric, 1 - (EXTRACT(EPOCH FROM (now() - created_at))/86400.0)/14.0)
        ) + COUNT(DISTINCT event_type) * 4
      ))::int AS risk_score
    FROM filtered
    GROUP BY k
  ),
  with_patterns AS (
    SELECT g.*,
      ARRAY(
        SELECT p FROM (VALUES
          ('reincidente', g.cnt >= 10),
          ('vpn',        EXISTS (SELECT 1 FROM unnest(g.event_types) t WHERE lower(t) ~ 'vpn|proxy|tor')),
          ('bot',        EXISTS (SELECT 1 FROM unnest(g.event_types) t WHERE lower(t) ~ 'bot|automation|headless')),
          ('clone',      EXISTS (SELECT 1 FROM unnest(g.event_types) t WHERE lower(t) ~ 'clone|tamper|integrity|hmac')),
          ('multi-acct', EXISTS (SELECT 1 FROM unnest(g.event_types) t WHERE lower(t) ~ 'multi[-_ ]?account|hwid_reuse|device_reuse')),
          ('replay',     EXISTS (SELECT 1 FROM unnest(g.event_types) t WHERE lower(t) ~ 'replay|nonce'))
        ) v(p, cond)
        WHERE cond
      ) AS patterns
    FROM grouped g
  ),
  final AS (
    SELECT * FROM with_patterns
    WHERE risk_score BETWEEN p_min_risk AND p_max_risk
      AND (p_severities IS NULL OR worst_severity = ANY(p_severities))
      AND (p_patterns IS NULL OR patterns && p_patterns)
      AND (p_search IS NULL OR p_search = '' OR
           lower(coalesce(license_key,'')) LIKE '%'||lower(p_search)||'%' OR
           lower(coalesce(device_id,''))   LIKE '%'||lower(p_search)||'%' OR
           lower(coalesce(ip_address,''))  LIKE '%'||lower(p_search)||'%' OR
           EXISTS (SELECT 1 FROM unnest(event_types) t WHERE lower(t) LIKE '%'||lower(p_search)||'%'))
  )
  SELECT COUNT(*)::int INTO v_total FROM final;

  SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT * FROM final
    ORDER BY risk_score DESC, cnt DESC
    LIMIT p_limit OFFSET p_offset
  ) f;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pilantrinhas_events(
  p_key text,
  p_since timestamptz,
  p_limit int DEFAULT 200
)
RETURNS SETOF public.fraud_events
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT *
    FROM public.fraud_events
    WHERE created_at >= p_since
      AND COALESCE(license_key, device_id, ip_address, id::text) = p_key
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pilantrinhas_aggregates(p_since timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_severity jsonb;
  v_top_events jsonb;
  v_top_ips jsonb;
  v_top_hwids jsonb;
  v_top_licenses jsonb;
  v_daily jsonb;
  v_hwid_multi jsonb;
  v_ip_multi jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('severity', severity, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_severity
  FROM (
    SELECT severity, COUNT(*)::int c
    FROM public.fraud_events
    WHERE created_at >= p_since
    GROUP BY severity
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('event_type', event_type, 'severity', severity, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_events
  FROM (
    SELECT event_type,
           (CASE
              WHEN bool_or(severity='critical') THEN 'critical'
              WHEN bool_or(severity='error')    THEN 'error'
              WHEN bool_or(severity='warn')     THEN 'warn'
              ELSE 'info' END) severity,
           COUNT(*)::int c
    FROM public.fraud_events
    WHERE created_at >= p_since
    GROUP BY event_type
    ORDER BY c DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('ip', ip_address, 'count', c, 'distinct_licenses', dl) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_ips
  FROM (
    SELECT ip_address, COUNT(*)::int c, COUNT(DISTINCT license_key)::int dl
    FROM public.fraud_events
    WHERE created_at >= p_since AND ip_address IS NOT NULL
    GROUP BY ip_address ORDER BY c DESC LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('device_id', device_id, 'count', c, 'distinct_licenses', dl) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_hwids
  FROM (
    SELECT device_id, COUNT(*)::int c, COUNT(DISTINCT license_key)::int dl
    FROM public.fraud_events
    WHERE created_at >= p_since AND device_id IS NOT NULL
    GROUP BY device_id ORDER BY c DESC LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('license_key', license_key, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_licenses
  FROM (
    SELECT license_key, COUNT(*)::int c
    FROM public.fraud_events
    WHERE created_at >= p_since AND license_key IS NOT NULL
    GROUP BY license_key ORDER BY c DESC LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', bucket, 'critical', critical, 'error', err, 'warn', warn, 'info', info) ORDER BY bucket), '[]'::jsonb)
    INTO v_daily
  FROM (
    SELECT date_trunc('day', created_at) bucket,
           SUM((severity='critical')::int)::int critical,
           SUM((severity='error')::int)::int    err,
           SUM((severity='warn')::int)::int     warn,
           SUM((severity='info')::int)::int     info
    FROM public.fraud_events
    WHERE created_at >= p_since
    GROUP BY bucket
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('device_id', device_id, 'licenses', licenses, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_hwid_multi
  FROM (
    SELECT device_id,
           array_agg(DISTINCT license_key) FILTER (WHERE license_key IS NOT NULL) licenses,
           COUNT(*)::int c
    FROM public.fraud_events
    WHERE created_at >= p_since AND device_id IS NOT NULL AND license_key IS NOT NULL
    GROUP BY device_id
    HAVING COUNT(DISTINCT license_key) >= 2
    ORDER BY c DESC LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('ip', ip_address, 'devices', devices, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_ip_multi
  FROM (
    SELECT ip_address,
           array_agg(DISTINCT device_id) FILTER (WHERE device_id IS NOT NULL) devices,
           COUNT(*)::int c
    FROM public.fraud_events
    WHERE created_at >= p_since AND ip_address IS NOT NULL AND device_id IS NOT NULL
    GROUP BY ip_address
    HAVING COUNT(DISTINCT device_id) >= 2
    ORDER BY c DESC LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'severity_breakdown', v_severity,
    'top_events',         v_top_events,
    'top_ips',            v_top_ips,
    'top_hwids',          v_top_hwids,
    'top_licenses',       v_top_licenses,
    'daily_series',       v_daily,
    'hwid_multi_licenses',v_hwid_multi,
    'ip_multi_devices',   v_ip_multi
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unmark_fraud_event_review(p_event_key text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.fraud_event_reviews
    WHERE event_key = p_event_key AND status = 'false_positive';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pilantrinhas(timestamptz, text[], text, text[], int, int, boolean, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_pilantrinhas_events(text, timestamptz, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_pilantrinhas_aggregates(timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unmark_fraud_event_review(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pilantrinhas(timestamptz, text[], text, text[], int, int, boolean, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pilantrinhas_events(text, timestamptz, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pilantrinhas_aggregates(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmark_fraud_event_review(text) TO authenticated;
