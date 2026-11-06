CREATE OR REPLACE FUNCTION public.get_monitoring_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_devices_online int;
  v_devices_online_sessions int;
  v_errors_24h int;
  v_pings_today int;
  v_pings_today_sessions int;
  v_failed_24h int;
  v_failed_24h_fraud int;
  v_errors_7d jsonb;
  v_errors_24h_series jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT count(*) INTO v_devices_online FROM public.heartbeats WHERE last_seen >= now() - interval '5 minutes';
  SELECT count(DISTINCT COALESCE(device_id, session_id)) INTO v_devices_online_sessions
    FROM public.sessions WHERE is_active = true AND last_heartbeat >= now() - interval '5 minutes';
  v_devices_online := GREATEST(v_devices_online, v_devices_online_sessions);

  -- FIX: inclui 'warn' (hwid_takeover, suspicious_device_id etc. são warn mas relevantes)
  SELECT count(*) INTO v_errors_24h FROM public.fraud_events
    WHERE created_at >= now() - interval '24 hours' AND severity IN ('critical','error','warn');

  SELECT COALESCE(sum(pings_today),0) INTO v_pings_today FROM public.heartbeats WHERE last_seen >= date_trunc('day', now());
  SELECT count(*) INTO v_pings_today_sessions FROM public.sessions WHERE last_heartbeat >= date_trunc('day', now());
  v_pings_today := v_pings_today + v_pings_today_sessions;

  SELECT count(*) INTO v_failed_24h FROM public.license_validation_attempts
    WHERE success = false AND created_at >= now() - interval '24 hours';
  -- FIX: amplia patterns para casar com event_types reais (license_not_found, missing_device_id, hwid_takeover, suspicious_*, invalid_*, *_denied, *_revoked, fraud_*)
  SELECT count(*) INTO v_failed_24h_fraud FROM public.fraud_events
    WHERE created_at >= now() - interval '24 hours'
      AND (
        event_type ILIKE '%validation%'
        OR event_type ILIKE '%invalid%'
        OR event_type ILIKE '%license_not_found%'
        OR event_type ILIKE '%license_denied%'
        OR event_type ILIKE '%missing_device%'
        OR event_type ILIKE '%hwid_takeover%'
        OR event_type ILIKE '%suspicious%'
        OR event_type ILIKE '%revoked%'
        OR event_type ILIKE '%fraud%'
        OR event_type ILIKE '%reseller_invalid%'
      );
  v_failed_24h := v_failed_24h + v_failed_24h_fraud;

  -- FIX: inclui 'warn' nas séries também
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d::date, 'count', COALESCE(c,0)) ORDER BY d), '[]'::jsonb)
  INTO v_errors_7d
  FROM generate_series(date_trunc('day', now() - interval '6 days'), date_trunc('day', now()), '1 day') d
  LEFT JOIN (
    SELECT date_trunc('day', created_at) AS day, count(*) AS c
    FROM public.fraud_events
    WHERE created_at >= now() - interval '7 days' AND severity IN ('critical','error','warn')
    GROUP BY 1
  ) e ON e.day = d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', h, 'count', COALESCE(c,0)) ORDER BY h), '[]'::jsonb)
  INTO v_errors_24h_series
  FROM generate_series(date_trunc('hour', now() - interval '23 hours'), date_trunc('hour', now()), '1 hour') h
  LEFT JOIN (
    SELECT date_trunc('hour', created_at) AS hour, count(*) AS c
    FROM public.fraud_events
    WHERE created_at >= now() - interval '24 hours' AND severity IN ('critical','error','warn')
    GROUP BY 1
  ) e ON e.hour = h;

  RETURN jsonb_build_object(
    'devices_online', v_devices_online,
    'errors_24h', v_errors_24h,
    'pings_today', v_pings_today,
    'failed_validations_24h', v_failed_24h,
    'errors_7d', v_errors_7d,
    'errors_24h_series', v_errors_24h_series,
    'generated_at', now()
  );
END;
$function$;