-- 1) Attach centralized audit triggers
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'licenses','resellers','packages','reseller_credit_packages',
    'notifications','extension_versions','payments','user_roles',
    'extension_kill_switch','reseller_features','admin_credentials'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
       FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger()', t
    );
  END LOOP;
END $$;

-- 2) Header metrics RPC
CREATE OR REPLACE FUNCTION public.get_admin_header_metrics()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_today_start timestamptz := date_trunc('day', now());
  v_yesterday_start timestamptz := v_today_start - interval '1 day';
  v_lic_today int; v_lic_yest int;
  v_active_lic int; v_active_sess int; v_resellers int;
  v_revenue_today numeric; v_revenue_yest numeric; v_fraud_24h int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT count(*) INTO v_lic_today   FROM public.licenses WHERE created_at >= v_today_start;
  SELECT count(*) INTO v_lic_yest    FROM public.licenses WHERE created_at >= v_yesterday_start AND created_at < v_today_start;
  SELECT count(*) INTO v_active_lic  FROM public.licenses WHERE status = 'active';
  SELECT count(*) INTO v_active_sess FROM public.sessions WHERE is_active = true AND last_heartbeat >= now() - interval '15 minutes';
  SELECT count(*) INTO v_resellers   FROM public.resellers;
  SELECT COALESCE(sum(amount),0) INTO v_revenue_today FROM public.payments WHERE payment_status = 'paid' AND created_at >= v_today_start;
  SELECT COALESCE(sum(amount),0) INTO v_revenue_yest  FROM public.payments WHERE payment_status = 'paid' AND created_at >= v_yesterday_start AND created_at < v_today_start;
  SELECT count(*) INTO v_fraud_24h   FROM public.fraud_events WHERE created_at >= now() - interval '24 hours';
  RETURN jsonb_build_object(
    'licenses_today', v_lic_today,
    'licenses_yesterday', v_lic_yest,
    'active_licenses', v_active_lic,
    'active_sessions', v_active_sess,
    'resellers_total', v_resellers,
    'revenue_today', v_revenue_today,
    'revenue_yesterday', v_revenue_yest,
    'fraud_events_24h', v_fraud_24h,
    'generated_at', now()
  );
END;
$fn$;

-- 3) Server-side licenses search with pagination
CREATE OR REPLACE FUNCTION public.search_licenses_admin(
  p_search text DEFAULT NULL, p_status text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_rows jsonb; v_total int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(l.*) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT * FROM public.licenses l
    WHERE (p_search IS NULL OR p_search = ''
           OR l.license_key ILIKE '%'||p_search||'%'
           OR l.user_name   ILIKE '%'||p_search||'%'
           OR l.client_email ILIKE '%'||p_search||'%'
           OR l.client_phone ILIKE '%'||p_search||'%')
      AND (p_status IS NULL OR l.status::text = p_status)
      AND (p_created_by IS NULL OR l.created_by = p_created_by)
    ORDER BY l.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) l;
  SELECT count(*) INTO v_total FROM public.licenses l
  WHERE (p_search IS NULL OR p_search = ''
         OR l.license_key ILIKE '%'||p_search||'%'
         OR l.user_name   ILIKE '%'||p_search||'%'
         OR l.client_email ILIKE '%'||p_search||'%'
         OR l.client_phone ILIKE '%'||p_search||'%')
    AND (p_status IS NULL OR l.status::text = p_status)
    AND (p_created_by IS NULL OR l.created_by = p_created_by);
  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$fn$;

-- 4) Enable realtime on critical tables (ignore if already added)
DO $$
DECLARE t text; tables text[] := ARRAY['licenses','sessions','notifications','resellers','payments','fraud_events'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;