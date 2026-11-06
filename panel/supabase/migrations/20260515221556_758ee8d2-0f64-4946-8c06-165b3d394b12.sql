
-- Prevent resellers from escalating their own privileges by editing
-- credit/token/api columns on their own row.
CREATE OR REPLACE FUNCTION public.prevent_reseller_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Admins can change anything
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admins (resellers updating their own row) cannot change privileged fields
  IF NEW.credits           IS DISTINCT FROM OLD.credits           THEN RAISE EXCEPTION 'Não permitido alterar credits'; END IF;
  IF NEW.tokens_7d         IS DISTINCT FROM OLD.tokens_7d         THEN RAISE EXCEPTION 'Não permitido alterar tokens_7d'; END IF;
  IF NEW.tokens_monthly    IS DISTINCT FROM OLD.tokens_monthly    THEN RAISE EXCEPTION 'Não permitido alterar tokens_monthly'; END IF;
  IF NEW.tokens_annual     IS DISTINCT FROM OLD.tokens_annual     THEN RAISE EXCEPTION 'Não permitido alterar tokens_annual'; END IF;
  IF NEW.tokens_lifetime   IS DISTINCT FROM OLD.tokens_lifetime   THEN RAISE EXCEPTION 'Não permitido alterar tokens_lifetime'; END IF;
  IF NEW.api_status        IS DISTINCT FROM OLD.api_status        THEN RAISE EXCEPTION 'Não permitido alterar api_status'; END IF;
  IF NEW.api_key_hash      IS DISTINCT FROM OLD.api_key_hash      THEN RAISE EXCEPTION 'Não permitido alterar api_key_hash diretamente'; END IF;
  IF NEW.api_key_prefix    IS DISTINCT FROM OLD.api_key_prefix    THEN RAISE EXCEPTION 'Não permitido alterar api_key_prefix diretamente'; END IF;
  IF NEW.user_id           IS DISTINCT FROM OLD.user_id           THEN RAISE EXCEPTION 'Não permitido alterar user_id'; END IF;
  IF NEW.email             IS DISTINCT FROM OLD.email             THEN RAISE EXCEPTION 'Não permitido alterar email'; END IF;
  IF NEW.license_key       IS DISTINCT FROM OLD.license_key       THEN RAISE EXCEPTION 'Não permitido alterar license_key'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reseller_privilege_escalation ON public.resellers;
CREATE TRIGGER trg_prevent_reseller_privilege_escalation
BEFORE UPDATE ON public.resellers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_reseller_privilege_escalation();
