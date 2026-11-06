-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.increment_reseller_credits(uuid, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_reseller_credits(uuid, integer, text) TO authenticated, anon;

-- Update the 3-argument version of the function
CREATE OR REPLACE FUNCTION public.increment_reseller_credits(reseller_uuid uuid, amount_to_add integer, type_of_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Access Denied: Admin privileges or service_role required.';
  END IF;

  IF type_of_token = '7d' THEN
    UPDATE public.resellers 
    SET tokens_7d = COALESCE(tokens_7d, 0) + amount_to_add, 
        credits = COALESCE(credits, 0) + amount_to_add,
        updated_at = now() 
    WHERE id = reseller_uuid;
  ELSIF type_of_token = 'monthly' THEN
    UPDATE public.resellers 
    SET tokens_monthly = COALESCE(tokens_monthly, 0) + amount_to_add, 
        credits = COALESCE(credits, 0) + amount_to_add,
        updated_at = now() 
    WHERE id = reseller_uuid;
  ELSIF type_of_token = 'annual' THEN
    UPDATE public.resellers 
    SET tokens_annual = COALESCE(tokens_annual, 0) + amount_to_add, 
        credits = COALESCE(credits, 0) + amount_to_add,
        updated_at = now() 
    WHERE id = reseller_uuid;
  ELSIF type_of_token = 'lifetime' THEN
    UPDATE public.resellers 
    SET tokens_lifetime = COALESCE(tokens_lifetime, 0) + amount_to_add, 
        credits = COALESCE(credits, 0) + amount_to_add,
        updated_at = now() 
    WHERE id = reseller_uuid;
  ELSIF type_of_token = 'daily' THEN
    UPDATE public.resellers 
    SET tokens_daily = COALESCE(tokens_daily, 0) + amount_to_add, 
        credits = COALESCE(credits, 0) + amount_to_add,
        updated_at = now() 
    WHERE id = reseller_uuid;
  ELSE
    -- Default to monthly if type is unknown, for backwards compatibility
    UPDATE public.resellers 
    SET tokens_monthly = COALESCE(tokens_monthly, 0) + amount_to_add, 
        credits = COALESCE(credits, 0) + amount_to_add,
        updated_at = now() 
    WHERE id = reseller_uuid;
  END IF;
END;
$function$;

-- Update the trigger function to include tokens_daily
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
  -- service_role (Edge Functions) bypassa o trigger
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.is_admin();

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Protect sensitive columns from non-admins
  IF NEW.credits           IS DISTINCT FROM OLD.credits           THEN RAISE EXCEPTION 'Não permitido alterar credits'; END IF;
  IF NEW.tokens_7d         IS DISTINCT FROM OLD.tokens_7d         THEN RAISE EXCEPTION 'Não permitido alterar tokens_7d'; END IF;
  IF NEW.tokens_monthly    IS DISTINCT FROM OLD.tokens_monthly    THEN RAISE EXCEPTION 'Não permitido alterar tokens_monthly'; END IF;
  IF NEW.tokens_annual     IS DISTINCT FROM OLD.tokens_annual     THEN RAISE EXCEPTION 'Não permitido alterar tokens_annual'; END IF;
  IF NEW.tokens_lifetime   IS DISTINCT FROM OLD.tokens_lifetime   THEN RAISE EXCEPTION 'Não permitido alterar tokens_lifetime'; END IF;
  IF NEW.tokens_daily      IS DISTINCT FROM OLD.tokens_daily      THEN RAISE EXCEPTION 'Não permitido alterar tokens_daily'; END IF;
  IF NEW.user_id           IS DISTINCT FROM OLD.user_id           THEN RAISE EXCEPTION 'Não permitido alterar user_id'; END IF;
  IF NEW.email             IS DISTINCT FROM OLD.email             THEN RAISE EXCEPTION 'Não permitido alterar email'; END IF;
  IF NEW.license_key       IS DISTINCT FROM OLD.license_key       THEN RAISE EXCEPTION 'Não permitido alterar license_key'; END IF;

  -- API key rotation logic
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