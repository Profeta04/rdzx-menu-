
-- 1) Drop duplicate audit triggers (keep trg_audit_* canonical name)
DROP TRIGGER IF EXISTS audit_licenses ON public.licenses;
DROP TRIGGER IF EXISTS audit_extension_versions ON public.extension_versions;
DROP TRIGGER IF EXISTS audit_notifications ON public.notifications;
DROP TRIGGER IF EXISTS audit_packages ON public.packages;
DROP TRIGGER IF EXISTS audit_payments ON public.payments;
DROP TRIGGER IF EXISTS audit_reseller_credit_packages ON public.reseller_credit_packages;
DROP TRIGGER IF EXISTS audit_resellers ON public.resellers;

-- Tabelas que só tinham nome "audit_*" sem trg_audit_* → renomeia para padronizar
DROP TRIGGER IF EXISTS audit_admin_credentials ON public.admin_credentials;
CREATE TRIGGER trg_audit_admin_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_credentials
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_extension_kill_switch ON public.extension_kill_switch;
CREATE TRIGGER trg_audit_extension_kill_switch
  AFTER INSERT OR UPDATE OR DELETE ON public.extension_kill_switch
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_reseller_features ON public.reseller_features;
CREATE TRIGGER trg_audit_reseller_features
  AFTER INSERT OR UPDATE OR DELETE ON public.reseller_features
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- 2) Make fn_audit_trigger skip service_role writes and noop updates
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_diff jsonb;
  v_target_id text;
  v_admin_email text;
  v_admin_id uuid;
BEGIN
  -- Skip auto writes from edge functions / service role (no human admin action).
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Skip noop updates (old = new)
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN
    RETURN NEW;
  END IF;

  v_admin_id := auth.uid();
  BEGIN
    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;
  EXCEPTION WHEN OTHERS THEN
    v_admin_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_diff := jsonb_build_object('new', to_jsonb(NEW));
    v_target_id := COALESCE((to_jsonb(NEW)->>'id'), '');
  ELSIF TG_OP = 'UPDATE' THEN
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    v_target_id := COALESCE((to_jsonb(NEW)->>'id'), '');
  ELSIF TG_OP = 'DELETE' THEN
    v_diff := jsonb_build_object('old', to_jsonb(OLD));
    v_target_id := COALESCE((to_jsonb(OLD)->>'id'), '');
  END IF;

  INSERT INTO public.admin_audit_log (
    admin_user_id, admin_email, action, target_table, target_id, diff
  ) VALUES (
    v_admin_id, v_admin_email, TG_OP, TG_TABLE_NAME, v_target_id, v_diff
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- 3) Purge / maintenance functions (callable via cron)
CREATE OR REPLACE FUNCTION public.purge_old_admin_audit_log(p_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.admin_audit_log WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.purge_old_usage_logs(p_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.usage_logs WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.purge_old_extension_errors(p_days integer DEFAULT 14)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.extension_errors WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.purge_old_license_validation_attempts(p_days integer DEFAULT 14)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.license_validation_attempts WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.purge_old_security_logs(p_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.security_logs WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.purge_old_heartbeats(p_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.heartbeats WHERE last_seen < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.purge_old_reseller_api_logs(p_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.reseller_api_logs WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- Daily heartbeats pings_today reset helper
CREATE OR REPLACE FUNCTION public.reset_heartbeats_pings_today()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  UPDATE public.heartbeats SET pings_today = 0
  WHERE pings_today > 0 AND last_seen < date_trunc('day', now());
END; $$;

-- Maintenance orchestrator: run all purges in a single cron call
CREATE OR REPLACE FUNCTION public.run_maintenance_purges()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_res jsonb := '{}'::jsonb;
BEGIN
  v_res := v_res || jsonb_build_object('admin_audit_log',          public.purge_old_admin_audit_log(30));
  v_res := v_res || jsonb_build_object('usage_logs',               public.purge_old_usage_logs(30));
  v_res := v_res || jsonb_build_object('extension_errors',         public.purge_old_extension_errors(14));
  v_res := v_res || jsonb_build_object('license_validation_attempts', public.purge_old_license_validation_attempts(14));
  v_res := v_res || jsonb_build_object('security_logs',            public.purge_old_security_logs(30));
  v_res := v_res || jsonb_build_object('fraud_events',             public.purge_old_fraud_events(30));
  v_res := v_res || jsonb_build_object('heartbeats',               public.purge_old_heartbeats(30));
  v_res := v_res || jsonb_build_object('reseller_api_logs',        public.purge_old_reseller_api_logs(30));
  PERFORM public.cleanup_stale_sessions();
  PERFORM public.cleanup_old_nonces();
  PERFORM public.reset_heartbeats_pings_today();
  RETURN v_res;
END; $$;
