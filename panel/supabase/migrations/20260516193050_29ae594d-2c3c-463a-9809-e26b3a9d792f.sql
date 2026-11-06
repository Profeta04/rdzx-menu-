-- Add tokens_daily to resellers
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS tokens_daily integer DEFAULT 0;

-- Update transaction type constraint
DO $$ 
BEGIN 
    ALTER TABLE public.reseller_credit_transactions 
    DROP CONSTRAINT IF EXISTS reseller_credit_transactions_token_type_check;
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.reseller_credit_transactions 
ADD CONSTRAINT reseller_credit_transactions_token_type_check 
CHECK (token_type = ANY (ARRAY['7d'::text, 'monthly'::text, 'annual'::text, 'lifetime'::text, 'daily'::text]));

-- Update the deduction function
CREATE OR REPLACE FUNCTION public.deduct_reseller_credit()
RETURNS TRIGGER AS $$
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
    -- Só prosseguir se created_by estiver definido
    IF NEW.created_by IS NULL THEN
        RETURN NEW;
    END IF;

    -- Ignorar se for admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = NEW.created_by AND role = 'admin'
    ) INTO is_creator_admin;

    IF is_creator_admin THEN
        RETURN NEW;
    END IF;

    -- Buscar revendedor
    SELECT id, tokens_7d, tokens_monthly, tokens_annual, tokens_lifetime, COALESCE(tokens_daily, 0)
    INTO reseller_id_val, reseller_tokens_7d, reseller_tokens_monthly, reseller_tokens_annual, reseller_tokens_lifetime, reseller_tokens_daily
    FROM public.resellers
    WHERE user_id = NEW.created_by;

    -- Se não encontrar revendedor e não for admin, bloquear
    IF reseller_id_val IS NULL THEN
        RAISE EXCEPTION 'Revendedor não encontrado para o usuário atual.';
    END IF;

    -- 30 Minute Free Test License (up to 31 minutes = ~0.0215 days)
    IF NEW.duration_days > 0 AND NEW.duration_days <= 0.0215 THEN
        -- Free test license, no deduction
        RETURN NEW;
    END IF;

    -- Daily License Logic (1 to 6 days)
    IF NEW.duration_days >= 1 AND NEW.duration_days < 7 THEN
        required_daily_tokens := CEIL(NEW.duration_days)::integer;
        IF reseller_tokens_daily < required_daily_tokens THEN
            RAISE EXCEPTION 'Erro: Saldo insuficiente (Tokens Diários). Necessário: %, Disponível: %', required_daily_tokens, reseller_tokens_daily;
        END IF;
        UPDATE public.resellers SET tokens_daily = tokens_daily - required_daily_tokens WHERE id = reseller_id_val;
        RETURN NEW;
    END IF;

    -- Legacy Logic for 7d, Monthly, Annual, Lifetime
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
        RAISE EXCEPTION 'Duração de licença inválida. Use 1-6 dias para diárias, 7+ para planos padrão, ou <= 30 min para teste grátis.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;