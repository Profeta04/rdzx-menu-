
CREATE TABLE IF NOT EXISTS public.security_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_type text NOT NULL CHECK (ban_type IN ('ip','hwid')),
  value text NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ban_type, value)
);

ALTER TABLE public.security_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage security_bans"
  ON public.security_bans
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_security_bans_type_value ON public.security_bans (ban_type, value);

CREATE OR REPLACE FUNCTION public.ban_identifier(p_type text, p_value text, p_reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_type NOT IN ('ip','hwid') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  IF p_value IS NULL OR length(trim(p_value)) = 0 THEN RAISE EXCEPTION 'Valor obrigatório'; END IF;

  INSERT INTO public.security_bans (ban_type, value, reason, created_by)
  VALUES (p_type, p_value, p_reason, auth.uid())
  ON CONFLICT (ban_type, value) DO UPDATE SET reason = COALESCE(EXCLUDED.reason, security_bans.reason)
  RETURNING id INTO v_id;

  IF p_type = 'hwid' THEN
    UPDATE public.licenses
    SET status = 'revoked', active = false, updated_at = now()
    WHERE device_id = p_value;

    UPDATE public.sessions s
    SET is_active = false, is_revoked = true
    WHERE s.device_id = p_value AND s.is_active = true;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unban_identifier(p_type text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  DELETE FROM public.security_bans WHERE ban_type = p_type AND value = p_value;
END;
$$;
