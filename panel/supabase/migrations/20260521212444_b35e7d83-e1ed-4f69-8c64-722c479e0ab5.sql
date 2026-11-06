
-- Errors (from fraud_events) with filters + pagination
CREATE OR REPLACE FUNCTION public.get_monitoring_errors(
  p_search text DEFAULT NULL,
  p_severities text[] DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb; v_total int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(f.*) ORDER BY f.created_at DESC), '[]'::jsonb)
  INTO v_rows FROM (
    SELECT fe.*,
      EXISTS (SELECT 1 FROM public.fraud_event_reviews r
              WHERE r.event_key = fe.id::text AND r.status = 'resolved') AS resolved
    FROM public.fraud_events fe
    WHERE (p_severities IS NULL OR fe.severity = ANY(p_severities))
      AND (p_since IS NULL OR fe.created_at >= p_since)
      AND (p_search IS NULL OR p_search = '' OR
           fe.event_type ILIKE '%'||p_search||'%' OR
           fe.license_key ILIKE '%'||p_search||'%' OR
           fe.device_id ILIKE '%'||p_search||'%' OR
           fe.ip_address ILIKE '%'||p_search||'%' OR
           (fe.details->>'message') ILIKE '%'||p_search||'%' OR
           fe.endpoint ILIKE '%'||p_search||'%')
    ORDER BY fe.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) f;
  SELECT count(*) INTO v_total FROM public.fraud_events fe
    WHERE (p_severities IS NULL OR fe.severity = ANY(p_severities))
      AND (p_since IS NULL OR fe.created_at >= p_since)
      AND (p_search IS NULL OR p_search = '' OR
           fe.event_type ILIKE '%'||p_search||'%' OR
           fe.license_key ILIKE '%'||p_search||'%' OR
           fe.device_id ILIKE '%'||p_search||'%' OR
           fe.ip_address ILIKE '%'||p_search||'%' OR
           (fe.details->>'message') ILIKE '%'||p_search||'%' OR
           fe.endpoint ILIKE '%'||p_search||'%');
  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END; $$;

-- Heartbeats (with sessions fallback merged server-side)
CREATE OR REPLACE FUNCTION public.get_monitoring_heartbeats(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL, -- 'online' | 'idle' | 'offline' | null
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb; v_total int; v_now timestamptz := now();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  WITH base AS (
    SELECT h.device_id, h.license_key, h.version, h.url, h.user_agent, h.ip_address,
           h.pings_today, h.pings_total, h.first_seen, h.last_seen
    FROM public.heartbeats h
    UNION ALL
    SELECT COALESCE(s.device_id, s.session_id) AS device_id,
           l.license_key,
           NULL::text AS version, NULL::text AS url,
           s.created_ua AS user_agent, s.created_ip AS ip_address,
           CASE WHEN s.last_heartbeat >= date_trunc('day', v_now) THEN 1 ELSE 0 END AS pings_today,
           1 AS pings_total, s.created_at AS first_seen, s.last_heartbeat AS last_seen
    FROM public.sessions s
    LEFT JOIN public.licenses l ON l.id = s.license_id
    WHERE NOT EXISTS (SELECT 1 FROM public.heartbeats h2 WHERE h2.device_id = COALESCE(s.device_id, s.session_id))
  ),
  agg AS (
    SELECT device_id,
           max(license_key) AS license_key,
           max(version) AS version,
           max(url) AS url,
           max(user_agent) AS user_agent,
           max(ip_address) AS ip_address,
           sum(pings_today)::int AS pings_today,
           sum(pings_total)::int AS pings_total,
           min(first_seen) AS first_seen,
           max(last_seen) AS last_seen
    FROM base GROUP BY device_id
  ),
  filtered AS (
    SELECT a.*,
      CASE
        WHEN a.last_seen >= v_now - interval '5 minutes' THEN 'online'
        WHEN a.last_seen >= v_now - interval '30 minutes' THEN 'idle'
        ELSE 'offline'
      END AS status
    FROM agg a
    WHERE (p_search IS NULL OR p_search = '' OR
           a.device_id ILIKE '%'||p_search||'%' OR
           a.license_key ILIKE '%'||p_search||'%' OR
           a.ip_address ILIKE '%'||p_search||'%')
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(x.*) ORDER BY x.last_seen DESC), '[]'::jsonb), count(*)
  INTO v_rows, v_total
  FROM (
    SELECT * FROM filtered
    WHERE (p_status IS NULL OR status = p_status)
    ORDER BY last_seen DESC
    LIMIT p_limit OFFSET p_offset
  ) x;
  -- recount total without limit
  SELECT count(*) INTO v_total FROM filtered WHERE (p_status IS NULL OR status = p_status);
  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END; $$;

-- Validation attempts (with fraud_events fallback)
CREATE OR REPLACE FUNCTION public.get_monitoring_validations(
  p_search text DEFAULT NULL,
  p_only_failed boolean DEFAULT false,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb; v_total int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  WITH base AS (
    SELECT id, license_key, device_id, success, reason, ip_address, user_agent, created_at
    FROM public.license_validation_attempts
    UNION ALL
    SELECT fe.id, fe.license_key, fe.device_id, false AS success,
           fe.event_type || COALESCE(': '||(fe.details->>'message'),'') AS reason,
           fe.ip_address, fe.user_agent, fe.created_at
    FROM public.fraud_events fe
    WHERE (fe.event_type ILIKE '%validation%' OR fe.event_type ILIKE '%invalid_license%'
        OR fe.event_type ILIKE '%license_denied%' OR fe.event_type ILIKE '%hwid%')
      AND NOT EXISTS (SELECT 1 FROM public.license_validation_attempts lva WHERE lva.id = fe.id)
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (p_only_failed = false OR success = false)
      AND (p_since IS NULL OR created_at >= p_since)
      AND (p_search IS NULL OR p_search = '' OR
           license_key ILIKE '%'||p_search||'%' OR
           device_id ILIKE '%'||p_search||'%' OR
           ip_address ILIKE '%'||p_search||'%' OR
           reason ILIKE '%'||p_search||'%')
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(x.*) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_rows FROM (
    SELECT * FROM filtered ORDER BY created_at DESC LIMIT p_limit OFFSET p_offset
  ) x;
  SELECT count(*) INTO v_total FROM filtered;
  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END; $$;

-- Top aggregations
CREATE OR REPLACE FUNCTION public.get_monitoring_top(
  p_hours int DEFAULT 24
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_since timestamptz; v_top_errors jsonb; v_top_licenses jsonb;
        v_top_ips jsonb; v_validation_rate jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  v_since := now() - (p_hours||' hours')::interval;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'count')::int DESC), '[]'::jsonb)
  INTO v_top_errors FROM (
    SELECT jsonb_build_object('event_type', event_type, 'severity', max(severity),
      'count', count(*), 'last_at', max(created_at)) AS t
    FROM public.fraud_events
    WHERE created_at >= v_since AND severity IN ('critical','error','warn')
    GROUP BY event_type ORDER BY count(*) DESC LIMIT 5
  ) s;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'count')::int DESC), '[]'::jsonb)
  INTO v_top_licenses FROM (
    SELECT jsonb_build_object('license_key', license_key, 'count', count(*),
      'last_at', max(created_at)) AS t
    FROM public.fraud_events
    WHERE created_at >= v_since AND license_key IS NOT NULL
      AND severity IN ('critical','error')
    GROUP BY license_key ORDER BY count(*) DESC LIMIT 5
  ) s;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'count')::int DESC), '[]'::jsonb)
  INTO v_top_ips FROM (
    SELECT jsonb_build_object('ip', ip_address, 'count', count(*),
      'distinct_licenses', count(DISTINCT license_key),
      'last_at', max(created_at)) AS t
    FROM public.fraud_events
    WHERE created_at >= v_since AND ip_address IS NOT NULL
      AND severity IN ('critical','error')
    GROUP BY ip_address ORDER BY count(*) DESC LIMIT 5
  ) s;

  SELECT jsonb_build_object(
    'total', count(*),
    'success', count(*) FILTER (WHERE success),
    'failed', count(*) FILTER (WHERE NOT success)
  ) INTO v_validation_rate
  FROM public.license_validation_attempts WHERE created_at >= v_since;

  RETURN jsonb_build_object(
    'top_errors', v_top_errors,
    'top_licenses', v_top_licenses,
    'top_ips', v_top_ips,
    'validation_rate', v_validation_rate,
    'since', v_since
  );
END; $$;

-- Mark resolved
CREATE OR REPLACE FUNCTION public.mark_fraud_event_resolved(
  p_event_id uuid, p_resolved boolean DEFAULT true, p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_resolved THEN
    BEGIN SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    EXCEPTION WHEN OTHERS THEN v_email := NULL; END;
    INSERT INTO public.fraud_event_reviews (event_key, status, note, admin_user_id, admin_email)
    VALUES (p_event_id::text, 'resolved', p_note, auth.uid(), v_email);
  ELSE
    DELETE FROM public.fraud_event_reviews
    WHERE event_key = p_event_id::text AND status = 'resolved';
  END IF;
END; $$;
