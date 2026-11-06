
-- ============================================================
-- FASE 1 — HARDENING CRÍTICO DE BACKEND
-- ============================================================

-- 1. admin_credentials estava SEM RLS (vulnerabilidade crítica)
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

-- Apenas o próprio admin pode ler sua chave. Modificações só via service role / trigger.
DROP POLICY IF EXISTS "Admins can view own credentials" ON public.admin_credentials;
CREATE POLICY "Admins can view own credentials"
  ON public.admin_credentials
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND public.is_admin());

-- Bloqueia INSERT/UPDATE/DELETE direto via cliente (só service role bypassa RLS)
-- Não criamos policies de write → nenhum role autenticado pode modificar.

-- 2. Kill-switch / controle de versão da extensão
CREATE TABLE IF NOT EXISTS public.extension_kill_switch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_allowed_version text NOT NULL,
  blocked_versions text[] NOT NULL DEFAULT '{}',
  enforce_hmac boolean NOT NULL DEFAULT false,
  message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.extension_kill_switch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read kill switch"
  ON public.extension_kill_switch
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage kill switch"
  ON public.extension_kill_switch
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed inicial (libera tudo, HMAC desligado até Fase 3 do hardening da extensão)
INSERT INTO public.extension_kill_switch (min_allowed_version, blocked_versions, enforce_hmac, message)
VALUES ('6.0', '{}', false, 'OK')
ON CONFLICT DO NOTHING;

-- 3. Índice para limpeza eficiente de nonces (anti-replay)
CREATE INDEX IF NOT EXISTS idx_request_nonces_created_at
  ON public.request_nonces (created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_request_nonces_nonce_unique
  ON public.request_nonces (nonce);

-- 4. Reforça função check_rate_limit aceitando IP além de user_id
CREATE OR REPLACE FUNCTION public.check_rate_limit_ip(
  p_ip text,
  p_event_type text,
  p_limit integer,
  p_window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.security_logs
  WHERE ip_address = p_ip
    AND event_type = p_event_type
    AND created_at > now() - (p_window_minutes || ' minutes')::interval;
  RETURN v_count >= p_limit;
END;
$$;

-- 5. Função para consumir nonce atomicamente (anti-replay)
CREATE OR REPLACE FUNCTION public.consume_nonce(p_nonce text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Limpa nonces antigos oportunisticamente (>10 min)
  DELETE FROM public.request_nonces WHERE created_at < now() - interval '10 minutes';

  -- Tenta inserir; se já existe → replay attack
  BEGIN
    INSERT INTO public.request_nonces (nonce) VALUES (p_nonce);
    RETURN true;
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;
END;
$$;

-- 6. Tabela de eventos antifraude estruturados
CREATE TABLE IF NOT EXISTS public.fraud_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warn', 'error', 'critical')),
  license_key text,
  device_id text,
  ip_address text,
  user_agent text,
  endpoint text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read fraud events"
  ON public.fraud_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_fraud_events_created_at ON public.fraud_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_events_license_key ON public.fraud_events (license_key);
CREATE INDEX IF NOT EXISTS idx_fraud_events_ip ON public.fraud_events (ip_address);

-- 7. Helper para registrar eventos antifraude (usado por edge functions)
CREATE OR REPLACE FUNCTION public.log_fraud_event(
  p_event_type text,
  p_severity text,
  p_license_key text DEFAULT NULL,
  p_device_id text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_endpoint text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.fraud_events (event_type, severity, license_key, device_id, ip_address, user_agent, endpoint, details)
  VALUES (p_event_type, p_severity, p_license_key, p_device_id, p_ip, p_user_agent, p_endpoint, p_details);
END;
$$;

-- 8. Endurece policy de UPDATE em resellers (já há trigger, mas garante WITH CHECK)
-- (mantido como está; trigger prevent_reseller_privilege_escalation já bloqueia)

-- 9. Garante que payments só seja escrito por admin/service role
-- (já está correto: única policy é ALL com is_admin)
