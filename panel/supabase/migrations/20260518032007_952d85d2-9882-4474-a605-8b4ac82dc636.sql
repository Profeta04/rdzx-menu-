CREATE OR REPLACE FUNCTION public.deduct_reseller_credit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
    reseller_id_val uuid;
    reseller_tokens_7d integer;
    reseller_tokens_monthly integer;
    reseller_tokens_annual integer;
    reseller_tokens_lifetime integer;
    reseller_tokens_daily integer;
    is_creator_admin boolean;
    required_daily_tokens integer;
BEGIN
    IF NEW.created_by IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = NEW.created_by AND role = 'admin'
    ) INTO is_creator_admin;

    IF is_creator_admin THEN
        RETURN NEW;
    END IF;

    SELECT id, tokens_7d, tokens_monthly, tokens_annual, tokens_lifetime, COALESCE(tokens_daily, 0)
    INTO reseller_id_val, reseller_tokens_7d, reseller_tokens_monthly, reseller_tokens_annual, reseller_tokens_lifetime, reseller_tokens_daily
    FROM public.resellers
    WHERE user_id = NEW.created_by;

    IF reseller_id_val IS NULL THEN
        RAISE EXCEPTION 'Revendedor não encontrado para o usuário atual.';
    END IF;

    PERFORM set_config('app.allow_token_deduction', 'on', true);

    IF NEW.duration_days > 0 AND NEW.duration_days <= 0.021 THEN
        RETURN NEW;
    END IF;

    IF (NEW.is_daily = true) OR (NEW.duration_days >= 1 AND NEW.duration_days < 7) THEN
        required_daily_tokens := CEIL(NEW.duration_days)::integer;
        IF (NEW.is_daily = true) OR (NEW.duration_days < 7) THEN
            IF reseller_tokens_daily < required_daily_tokens THEN
                RAISE EXCEPTION 'Erro: Saldo insuficiente (Tokens Diários). Necessário: %, Disponível: %', required_daily_tokens, reseller_tokens_daily;
            END IF;
            UPDATE public.resellers SET tokens_daily = tokens_daily - required_daily_tokens WHERE id = reseller_id_val;
            RETURN NEW;
        END IF;
    END IF;

    IF NEW.lifetime = true OR NEW.duration_days >= 9999 THEN
        IF reseller_tokens_lifetime < 1 THEN
            RAISE EXCEPTION 'Erro: Saldo insuficiente (Tokens Vitalícios).';
        END IF;
        UPDATE public.resellers SET tokens_lifetime = tokens_lifetime - 1 WHERE id = reseller_id_val;
    ELSIF NEW.duration_days >= 365 THEN
        IF reseller_tokens_annual < 1 THEN
            RAISE EXCEPTION 'Erro: Saldo insuficiente (Tokens Anuais).';
        END IF;
        UPDATE public.resellers SET tokens_annual = tokens_annual - 1 WHERE id = reseller_id_val;
    ELSIF NEW.duration_days >= 30 THEN
        IF reseller_tokens_monthly < 1 THEN
            RAISE EXCEPTION 'Erro: Saldo insuficiente (Tokens Mensais).';
        END IF;
        UPDATE public.resellers SET tokens_monthly = tokens_monthly - 1 WHERE id = reseller_id_val;
    ELSIF NEW.duration_days >= 7 THEN
        IF reseller_tokens_7d < 1 THEN
            RAISE EXCEPTION 'Erro: Saldo insuficiente (Tokens de 7 Dias).';
        END IF;
        UPDATE public.resellers SET tokens_7d = tokens_7d - 1 WHERE id = reseller_id_val;
    ELSE
        RAISE EXCEPTION 'Duração de licença inválida. Use licenças diárias para 1-6 dias, ou planos padrão para 7+ dias.';
    END IF;

    RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.prevent_reseller_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_is_admin boolean;
  v_allow_rotation text;
  v_allow_deduction text;
  v_tokens_changed boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.is_admin();
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_allow_deduction := current_setting('app.allow_token_deduction', true);
  EXCEPTION WHEN OTHERS THEN
    v_allow_deduction := NULL;
  END;

  v_tokens_changed :=
       NEW.credits         IS DISTINCT FROM OLD.credits
    OR NEW.tokens_7d       IS DISTINCT FROM OLD.tokens_7d
    OR NEW.tokens_monthly  IS DISTINCT FROM OLD.tokens_monthly
    OR NEW.tokens_annual   IS DISTINCT FROM OLD.tokens_annual
    OR NEW.tokens_lifetime IS DISTINCT FROM OLD.tokens_lifetime
    OR NEW.tokens_daily    IS DISTINCT FROM OLD.tokens_daily;

  -- Quando o débito oficial (trigger deduct_reseller_credit) estiver ativo,
  -- permite somente alteração de tokens — outros campos sensíveis seguem bloqueados.
  IF v_allow_deduction IS NOT DISTINCT FROM 'on' AND v_tokens_changed THEN
    IF NEW.user_id     IS DISTINCT FROM OLD.user_id     THEN RAISE EXCEPTION 'Não permitido alterar user_id'; END IF;
    IF NEW.email       IS DISTINCT FROM OLD.email       THEN RAISE EXCEPTION 'Não permitido alterar email'; END IF;
    IF NEW.license_key IS DISTINCT FROM OLD.license_key THEN RAISE EXCEPTION 'Não permitido alterar license_key'; END IF;
    RETURN NEW;
  END IF;

  IF NEW.credits           IS DISTINCT FROM OLD.credits           THEN RAISE EXCEPTION 'Não permitido alterar credits'; END IF;
  IF NEW.tokens_7d         IS DISTINCT FROM OLD.tokens_7d         THEN RAISE EXCEPTION 'Não permitido alterar tokens_7d'; END IF;
  IF NEW.tokens_monthly    IS DISTINCT FROM OLD.tokens_monthly    THEN RAISE EXCEPTION 'Não permitido alterar tokens_monthly'; END IF;
  IF NEW.tokens_annual     IS DISTINCT FROM OLD.tokens_annual     THEN RAISE EXCEPTION 'Não permitido alterar tokens_annual'; END IF;
  IF NEW.tokens_lifetime   IS DISTINCT FROM OLD.tokens_lifetime   THEN RAISE EXCEPTION 'Não permitido alterar tokens_lifetime'; END IF;
  IF NEW.tokens_daily      IS DISTINCT FROM OLD.tokens_daily      THEN RAISE EXCEPTION 'Não permitido alterar tokens_daily'; END IF;
  IF NEW.user_id           IS DISTINCT FROM OLD.user_id           THEN RAISE EXCEPTION 'Não permitido alterar user_id'; END IF;
  IF NEW.email             IS DISTINCT FROM OLD.email             THEN RAISE EXCEPTION 'Não permitido alterar email'; END IF;
  IF NEW.license_key       IS DISTINCT FROM OLD.license_key       THEN RAISE EXCEPTION 'Não permitido alterar license_key'; END IF;

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
$fn$;