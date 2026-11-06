
-- Allow legitimate API key rotation via set_reseller_api_key (SECURITY DEFINER RPC)
-- by setting a session-local flag that the privilege escalation trigger checks.

CREATE OR REPLACE FUNCTION public.set_reseller_api_key(p_hash text, p_prefix text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_reseller_id UUID;
BEGIN
    SELECT id INTO v_reseller_id FROM public.resellers WHERE user_id = auth.uid();

    IF v_reseller_id IS NULL THEN
        RAISE EXCEPTION 'User is not a registered reseller.';
    END IF;

    -- Sinaliza para o trigger que esta UPDATE veio da rotação oficial de chave
    PERFORM set_config('app.allow_api_key_rotation', 'on', true);

    UPDATE public.resellers
    SET
        api_key_hash = p_hash,
        api_key_prefix = p_prefix,
        api_status = 'active',
        updated_at = now()
    WHERE id = v_reseller_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_reseller_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_allow_rotation text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Campos sempre proibidos para revendedores
  IF NEW.credits           IS DISTINCT FROM OLD.credits           THEN RAISE EXCEPTION 'Não permitido alterar credits'; END IF;
  IF NEW.tokens_7d         IS DISTINCT FROM OLD.tokens_7d         THEN RAISE EXCEPTION 'Não permitido alterar tokens_7d'; END IF;
  IF NEW.tokens_monthly    IS DISTINCT FROM OLD.tokens_monthly    THEN RAISE EXCEPTION 'Não permitido alterar tokens_monthly'; END IF;
  IF NEW.tokens_annual     IS DISTINCT FROM OLD.tokens_annual     THEN RAISE EXCEPTION 'Não permitido alterar tokens_annual'; END IF;
  IF NEW.tokens_lifetime   IS DISTINCT FROM OLD.tokens_lifetime   THEN RAISE EXCEPTION 'Não permitido alterar tokens_lifetime'; END IF;
  IF NEW.user_id           IS DISTINCT FROM OLD.user_id           THEN RAISE EXCEPTION 'Não permitido alterar user_id'; END IF;
  IF NEW.email             IS DISTINCT FROM OLD.email             THEN RAISE EXCEPTION 'Não permitido alterar email'; END IF;
  IF NEW.license_key       IS DISTINCT FROM OLD.license_key       THEN RAISE EXCEPTION 'Não permitido alterar license_key'; END IF;

  -- Campos de API só podem ser alterados pelo RPC oficial set_reseller_api_key
  BEGIN
    v_allow_rotation := current_setting('app.allow_api_key_rotation', true);
  EXCEPTION WHEN OTHERS THEN
    v_allow_rotation := NULL;
  END;

  IF v_allow_rotation IS DISTINCT FROM 'on' THEN
    IF NEW.api_status     IS DISTINCT FROM OLD.api_status     THEN RAISE EXCEPTION 'Não permitido alterar api_status'; END IF;
    IF NEW.api_key_hash   IS DISTINCT FROM OLD.api_key_hash   THEN RAISE EXCEPTION 'Não permitido alterar api_key_hash diretamente'; END IF;
    IF NEW.api_key_prefix IS DISTINCT FROM OLD.api_key_prefix THEN RAISE EXCEPTION 'Não permitido alterar api_key_prefix diretamente'; END IF;
  END IF;

  RETURN NEW;
END;
$function$;
