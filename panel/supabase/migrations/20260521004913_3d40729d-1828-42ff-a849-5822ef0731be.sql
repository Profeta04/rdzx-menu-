
-- D: drop dead tables
DROP TABLE IF EXISTS public.nonces;
DROP TABLE IF EXISTS public.session_cache;

-- E: drop extension_errors table + its purge function
DROP FUNCTION IF EXISTS public.purge_old_extension_errors(integer);
DROP TABLE IF EXISTS public.extension_errors;

-- Update run_maintenance_purges: remove extension_errors line + new retention defaults
CREATE OR REPLACE FUNCTION public.run_maintenance_purges()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_res jsonb := '{}'::jsonb;
BEGIN
  v_res := v_res || jsonb_build_object('admin_audit_log',          public.purge_old_admin_audit_log(7));
  v_res := v_res || jsonb_build_object('usage_logs',               public.purge_old_usage_logs(7));
  v_res := v_res || jsonb_build_object('license_validation_attempts', public.purge_old_license_validation_attempts(14));
  v_res := v_res || jsonb_build_object('security_logs',            public.purge_old_security_logs(14));
  v_res := v_res || jsonb_build_object('fraud_events',             public.purge_old_fraud_events(14));
  v_res := v_res || jsonb_build_object('heartbeats',               public.purge_old_heartbeats(30));
  v_res := v_res || jsonb_build_object('reseller_api_logs',        public.purge_old_reseller_api_logs(30));
  PERFORM public.cleanup_stale_sessions();
  PERFORM public.cleanup_old_nonces();
  PERFORM public.reset_heartbeats_pings_today();
  RETURN v_res;
END; $function$;

-- cleanup_old_nonces now points to request_nonces only (nonces dropped)
CREATE OR REPLACE FUNCTION public.cleanup_old_nonces()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    DELETE FROM public.request_nonces WHERE created_at < now() - interval '10 minutes';
END;
$function$;

-- Update get_monitoring_metrics: remove extension_errors references (use fraud_events only)
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

  SELECT count(*) INTO v_errors_24h FROM public.fraud_events
    WHERE created_at >= now() - interval '24 hours' AND severity IN ('critical','error');

  SELECT COALESCE(sum(pings_today),0) INTO v_pings_today FROM public.heartbeats WHERE last_seen >= date_trunc('day', now());
  SELECT count(*) INTO v_pings_today_sessions FROM public.sessions WHERE last_heartbeat >= date_trunc('day', now());
  v_pings_today := v_pings_today + v_pings_today_sessions;

  SELECT count(*) INTO v_failed_24h FROM public.license_validation_attempts
    WHERE success = false AND created_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_failed_24h_fraud FROM public.fraud_events
    WHERE created_at >= now() - interval '24 hours'
      AND (event_type ILIKE '%validation%' OR event_type ILIKE '%invalid_license%' OR event_type ILIKE '%license_denied%');
  v_failed_24h := v_failed_24h + v_failed_24h_fraud;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d::date, 'count', COALESCE(c,0)) ORDER BY d), '[]'::jsonb)
  INTO v_errors_7d
  FROM generate_series(date_trunc('day', now() - interval '6 days'), date_trunc('day', now()), '1 day') d
  LEFT JOIN (
    SELECT date_trunc('day', created_at) AS day, count(*) AS c
    FROM public.fraud_events
    WHERE created_at >= now() - interval '7 days' AND severity IN ('critical','error')
    GROUP BY 1
  ) e ON e.day = d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', h, 'count', COALESCE(c,0)) ORDER BY h), '[]'::jsonb)
  INTO v_errors_24h_series
  FROM generate_series(date_trunc('hour', now() - interval '23 hours'), date_trunc('hour', now()), '1 hour') h
  LEFT JOIN (
    SELECT date_trunc('hour', created_at) AS hour, count(*) AS c
    FROM public.fraud_events
    WHERE created_at >= now() - interval '24 hours' AND severity IN ('critical','error')
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
