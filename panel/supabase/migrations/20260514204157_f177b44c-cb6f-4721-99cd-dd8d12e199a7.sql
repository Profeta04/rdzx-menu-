CREATE OR REPLACE FUNCTION public.deduct_reseller_credit()
RETURNS TRIGGER AS $$
DECLARE
    reseller_id_val uuid;
    reseller_tokens_7d integer;
    reseller_tokens_monthly integer;
    reseller_tokens_annual integer;
    reseller_tokens_lifetime integer;
    is_creator_admin boolean;
BEGIN
    -- Only proceed if created_by is set
    IF NEW.created_by IS NULL THEN
        RETURN NEW;
    END IF;

    -- Skip token deduction if the creator is an admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = NEW.created_by AND role = 'admin'
    ) INTO is_creator_admin;

    IF is_creator_admin THEN
        RETURN NEW;
    END IF;

    -- Get current tokens for the reseller
    SELECT id, tokens_7d, tokens_monthly, tokens_annual, tokens_lifetime 
    INTO reseller_id_val, reseller_tokens_7d, reseller_tokens_monthly, reseller_tokens_annual, reseller_tokens_lifetime
    FROM public.resellers 
    WHERE user_id = NEW.created_by;
    
    -- If no reseller found, the creator is neither admin nor reseller; skip deduction
    IF reseller_id_val IS NULL THEN
        RETURN NEW;
    END IF;

    -- Determine which token to use based on license duration
    IF NEW.lifetime = true OR NEW.duration_days >= 9999 THEN
        IF reseller_tokens_lifetime < 1 THEN
            RAISE EXCEPTION 'Tokens Vitalícios insuficientes.';
        END IF;
        UPDATE public.resellers SET tokens_lifetime = tokens_lifetime - 1 WHERE id = reseller_id_val;
    ELSIF NEW.duration_days >= 365 THEN
        IF reseller_tokens_annual < 1 THEN
            RAISE EXCEPTION 'Tokens Anuais insuficientes.';
        END IF;
        UPDATE public.resellers SET tokens_annual = tokens_annual - 1 WHERE id = reseller_id_val;
    ELSIF NEW.duration_days >= 30 THEN
        IF reseller_tokens_monthly < 1 THEN
            RAISE EXCEPTION 'Tokens Mensais insuficientes.';
        END IF;
        UPDATE public.resellers SET tokens_monthly = tokens_monthly - 1 WHERE id = reseller_id_val;
    ELSIF NEW.duration_days >= 0.001 THEN -- Anything above 0 (and below 30) now consumes 7D token or is blocked
        -- Block anything less than 7 days for resellers
        IF NEW.duration_days < 7 THEN
            RAISE EXCEPTION 'O sistema de Trial (licenças gratuitas < 7 dias) foi desativado.';
        END IF;

        IF reseller_tokens_7d < 1 THEN
            RAISE EXCEPTION 'Tokens de 7 Dias insuficientes.';
        END IF;
        UPDATE public.resellers SET tokens_7d = tokens_7d - 1 WHERE id = reseller_id_val;
    ELSE
        -- Fallback (shouldn't be reached with 0.001 check, but for safety)
        RAISE EXCEPTION 'Duração de licença inválida.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
