-- Add new token columns to resellers
ALTER TABLE public.resellers 
ADD COLUMN tokens_7d INTEGER DEFAULT 0,
ADD COLUMN tokens_monthly INTEGER DEFAULT 0,
ADD COLUMN tokens_annual INTEGER DEFAULT 0,
ADD COLUMN tokens_lifetime INTEGER DEFAULT 0;

-- Update existing resellers: move 'credits' to 'tokens_monthly'
UPDATE public.resellers SET tokens_monthly = credits;

-- Add token_type to packages
ALTER TABLE public.reseller_credit_packages
ADD COLUMN token_type TEXT DEFAULT 'monthly' CHECK (token_type IN ('7d', 'monthly', 'annual', 'lifetime'));

-- Update existing packages to be 'monthly'
UPDATE public.reseller_credit_packages SET token_type = 'monthly';

-- Update the deduction function
CREATE OR REPLACE FUNCTION public.deduct_reseller_credit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    reseller_id_val uuid;
    reseller_tokens_7d integer;
    reseller_tokens_monthly integer;
    reseller_tokens_annual integer;
    reseller_tokens_lifetime integer;
    token_column text;
BEGIN
    -- Only proceed if created_by is set (reseller license)
    IF NEW.created_by IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get current credits for the reseller
    SELECT id, tokens_7d, tokens_monthly, tokens_annual, tokens_lifetime 
    INTO reseller_id_val, reseller_tokens_7d, reseller_tokens_monthly, reseller_tokens_annual, reseller_tokens_lifetime
    FROM public.resellers 
    WHERE user_id = NEW.created_by;
    
    -- If no reseller found, abort
    IF reseller_id_val IS NULL THEN
        RETURN NEW;
    END IF;

    -- Determine which token to use based on license duration
    -- duration_days: 7, 30, 365, 36500 (lifetime)
    IF NEW.lifetime = true OR NEW.duration_days >= 36500 THEN
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
    ELSIF NEW.duration_days >= 7 THEN
        IF reseller_tokens_7d < 1 THEN
            RAISE EXCEPTION 'Tokens de 7 Dias insuficientes.';
        END IF;
        UPDATE public.resellers SET tokens_7d = tokens_7d - 1 WHERE id = reseller_id_val;
    ELSE
        -- Fallback for shorter durations or trials (maybe cost nothing or use 7d token)
        -- For now, we'll allow it or use monthly if it's a "normal" license
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$function$;

-- Update increment function to handle different token types
CREATE OR REPLACE FUNCTION public.increment_reseller_credits(reseller_uuid UUID, amount_to_add INTEGER, type_of_token TEXT DEFAULT 'monthly')
RETURNS VOID AS $$
BEGIN
  IF type_of_token = '7d' THEN
    UPDATE public.resellers SET tokens_7d = COALESCE(tokens_7d, 0) + amount_to_add, updated_at = now() WHERE id = reseller_uuid;
  ELSIF type_of_token = 'monthly' THEN
    UPDATE public.resellers SET tokens_monthly = COALESCE(tokens_monthly, 0) + amount_to_add, updated_at = now() WHERE id = reseller_uuid;
  ELSIF type_of_token = 'annual' THEN
    UPDATE public.resellers SET tokens_annual = COALESCE(tokens_annual, 0) + amount_to_add, updated_at = now() WHERE id = reseller_uuid;
  ELSIF type_of_token = 'lifetime' THEN
    UPDATE public.resellers SET tokens_lifetime = COALESCE(tokens_lifetime, 0) + amount_to_add, updated_at = now() WHERE id = reseller_uuid;
  ELSE
    UPDATE public.resellers SET tokens_monthly = COALESCE(tokens_monthly, 0) + amount_to_add, updated_at = now() WHERE id = reseller_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public;
