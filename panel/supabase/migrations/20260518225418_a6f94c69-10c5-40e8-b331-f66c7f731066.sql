
CREATE OR REPLACE FUNCTION public.get_monitoring_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_devices_online int;
  v_devices_online_sessions int;
  v_errors_24h int;
  v_errors_24h_fraud int;
  v_pings_today int;
  v_pings_today_sessions int;
  v_failed_24h int;
  v_failed_24h_fraud int;
  v_errors_7d jsonb;
  v_errors_24h_series jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  -- devices online: maior entre heartbeats novos e sessões ativas recentes
  SELECT count(*) INTO v_devices_online FROM public.heartbeats WHERE last_seen >= now() - interval '5 minutes';
  SELECT count(DISTINCT COALESCE(device_id, session_id)) INTO v_devices_online_sessions
    FROM public.sessions WHERE is_active = true AND last_heartbeat >= now() - interval '5 minutes';
  v_devices_online := GREATEST(v_devices_online, v_devices_online_sessions);

  -- erros 24h: extension_errors + fraud_events sev critical/error
  SELECT count(*) INTO v_errors_24h FROM public.extension_errors WHERE created_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_errors_24h_fraud FROM public.fraud_events
    WHERE created_at >= now() - interval '24 hours' AND severity IN ('critical','error');
  v_errors_24h := v_errors_24h + v_errors_24h_fraud;

  -- pings hoje: heartbeats + sessões com heartbeat hoje
  SELECT COALESCE(sum(pings_today),0) INTO v_pings_today FROM public.heartbeats WHERE last_seen >= date_trunc('day', now());
  SELECT count(*) INTO v_pings_today_sessions FROM public.sessions WHERE last_heartbeat >= date_trunc('day', now());
  v_pings_today := v_pings_today + v_pings_today_sessions;

  -- validações falhas 24h: lva + fraud com event_type contendo validation/license
  SELECT count(*) INTO v_failed_24h FROM public.license_validation_attempts
    WHERE success = false AND created_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_failed_24h_fraud FROM public.fraud_events
    WHERE created_at >= now() - interval '24 hours'
      AND (event_type ILIKE '%validation%' OR event_type ILIKE '%invalid_license%' OR event_type ILIKE '%license_denied%');
  v_failed_24h := v_failed_24h + v_failed_24h_fraud;

  -- série 7 dias: erros (extension_errors + fraud_events)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d::date, 'count', COALESCE(c,0)) ORDER BY d), '[]'::jsonb)
  INTO v_errors_7d
  FROM generate_series(date_trunc('day', now() - interval '6 days'), date_trunc('day', now()), '1 day') d
  LEFT JOIN (
    SELECT date_trunc('day', created_at) AS day, count(*) AS c
    FROM (
      SELECT created_at FROM public.extension_errors WHERE created_at >= now() - interval '7 days'
      UNION ALL
      SELECT created_at FROM public.fraud_events WHERE created_at >= now() - interval '7 days' AND severity IN ('critical','error')
    ) u
    GROUP BY 1
  ) e ON e.day = d;

  -- série 24h
  SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', h, 'count', COALESCE(c,0)) ORDER BY h), '[]'::jsonb)
  INTO v_errors_24h_series
  FROM generate_series(date_trunc('hour', now() - interval '23 hours'), date_trunc('hour', now()), '1 hour') h
  LEFT JOIN (
    SELECT date_trunc('hour', created_at) AS hour, count(*) AS c
    FROM (
      SELECT created_at FROM public.extension_errors WHERE created_at >= now() - interval '24 hours'
      UNION ALL
      SELECT created_at FROM public.fraud_events WHERE created_at >= now() - interval '24 hours' AND severity IN ('critical','error')
    ) u
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
$$;
