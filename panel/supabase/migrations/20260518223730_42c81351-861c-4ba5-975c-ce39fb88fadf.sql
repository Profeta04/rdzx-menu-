
-- extension_errors
CREATE TABLE IF NOT EXISTS public.extension_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text,
  device_id text,
  error_type text NOT NULL DEFAULT 'runtime',
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extension_errors_created ON public.extension_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extension_errors_license ON public.extension_errors (license_key);
ALTER TABLE public.extension_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read extension_errors" ON public.extension_errors;
CREATE POLICY "Admins read extension_errors" ON public.extension_errors FOR SELECT TO authenticated USING (public.is_admin());

-- heartbeats (1 linha por device, upsert)
CREATE TABLE IF NOT EXISTS public.heartbeats (
  device_id text PRIMARY KEY,
  license_key text,
  version text,
  url text,
  user_agent text,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  pings_today integer NOT NULL DEFAULT 1,
  pings_total integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_heartbeats_last_seen ON public.heartbeats (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_heartbeats_license ON public.heartbeats (license_key);
ALTER TABLE public.heartbeats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read heartbeats" ON public.heartbeats;
CREATE POLICY "Admins read heartbeats" ON public.heartbeats FOR SELECT TO authenticated USING (public.is_admin());

-- license_validation_attempts (já existe um sistema de fraud mas queremos visibilidade simples)
CREATE TABLE IF NOT EXISTS public.license_validation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text,
  device_id text,
  success boolean NOT NULL,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lva_created ON public.license_validation_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lva_success ON public.license_validation_attempts (success, created_at DESC);
ALTER TABLE public.license_validation_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read lva" ON public.license_validation_attempts;
CREATE POLICY "Admins read lva" ON public.license_validation_attempts FOR SELECT TO authenticated USING (public.is_admin());

-- fraud_event_reviews (marcar false-positive, ban, anotação)
CREATE TABLE IF NOT EXISTS public.fraud_event_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  status text NOT NULL,
  note text,
  admin_user_id uuid,
  admin_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fer_event_key ON public.fraud_event_reviews (event_key, created_at DESC);
ALTER TABLE public.fraud_event_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage fer" ON public.fraud_event_reviews;
CREATE POLICY "Admins manage fer" ON public.fraud_event_reviews FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- RPC monitoramento
CREATE OR REPLACE FUNCTION public.get_monitoring_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_devices_online int;
  v_errors_24h int;
  v_pings_today int;
  v_failed_24h int;
  v_errors_7d jsonb;
  v_errors_24h_series jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT count(*) INTO v_devices_online FROM public.heartbeats WHERE last_seen >= now() - interval '5 minutes';
  SELECT count(*) INTO v_errors_24h FROM public.extension_errors WHERE created_at >= now() - interval '24 hours';
  SELECT COALESCE(sum(pings_today),0) INTO v_pings_today FROM public.heartbeats WHERE last_seen >= date_trunc('day', now());
  SELECT count(*) INTO v_failed_24h FROM public.license_validation_attempts WHERE success = false AND created_at >= now() - interval '24 hours';

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d::date, 'count', COALESCE(c,0)) ORDER BY d), '[]'::jsonb)
  INTO v_errors_7d
  FROM generate_series(date_trunc('day', now() - interval '6 days'), date_trunc('day', now()), '1 day') d
  LEFT JOIN (
    SELECT date_trunc('day', created_at) AS day, count(*) AS c
    FROM public.extension_errors
    WHERE created_at >= now() - interval '7 days'
    GROUP BY 1
  ) e ON e.day = d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', h, 'count', COALESCE(c,0)) ORDER BY h), '[]'::jsonb)
  INTO v_errors_24h_series
  FROM generate_series(date_trunc('hour', now() - interval '23 hours'), date_trunc('hour', now()), '1 hour') h
  LEFT JOIN (
    SELECT date_trunc('hour', created_at) AS hour, count(*) AS c
    FROM public.extension_errors
    WHERE created_at >= now() - interval '24 hours'
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

-- Purge fraud antigos
CREATE OR REPLACE FUNCTION public.purge_old_fraud_events(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  DELETE FROM public.fraud_events WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Realtime para as novas tabelas
ALTER TABLE public.extension_errors REPLICA IDENTITY FULL;
ALTER TABLE public.heartbeats REPLICA IDENTITY FULL;
ALTER TABLE public.license_validation_attempts REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.extension_errors; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.heartbeats; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.license_validation_attempts; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
