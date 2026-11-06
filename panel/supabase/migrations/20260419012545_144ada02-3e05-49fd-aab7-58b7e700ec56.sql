-- Adicionar colunas faltantes na tabela de licenças
ALTER TABLE public.licenses 
ADD COLUMN IF NOT EXISTS client_email TEXT,
ADD COLUMN IF NOT EXISTS client_phone TEXT;

-- Atualizar a função de desconto de créditos para ser compatível com o dashboard
CREATE OR REPLACE FUNCTION public.deduct_reseller_credit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    reseller_id_val uuid;
    reseller_tokens_7d integer;
    reseller_tokens_monthly integer;
    reseller_tokens_annual integer;
    reseller_tokens_lifetime integer;
BEGIN
    -- Only proceed if created_by is set (reseller license)
    IF NEW.created_by IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get current tokens for the reseller
    SELECT id, tokens_7d, tokens_monthly, tokens_annual, tokens_lifetime 
    INTO reseller_id_val, reseller_tokens_7d, reseller_tokens_monthly, reseller_tokens_annual, reseller_tokens_lifetime
    FROM public.resellers 
    WHERE user_id = NEW.created_by;
    
    -- If no reseller found, something is wrong
    IF reseller_id_val IS NULL THEN
        RETURN NEW;
    END IF;

    -- Determine which token to use based on license duration
    -- Support 9999 or 36500 for lifetime
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
    ELSIF NEW.duration_days >= 7 THEN
        IF reseller_tokens_7d < 1 THEN
            RAISE EXCEPTION 'Tokens de 7 Dias insuficientes.';
        END IF;
        UPDATE public.resellers SET tokens_7d = tokens_7d - 1 WHERE id = reseller_id_val;
    ELSE
        -- Fallback for trials
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$function$;

-- Garantir que os revendedores podem atualizar seus próprios tokens (embora o gatilho já faça isso com SECURITY DEFINER)
-- Isso evita erros de permissão se o dashboard tentar fazer manualmente
DROP POLICY IF EXISTS "Resellers can update their own data" ON public.resellers;
CREATE POLICY "Resellers can update their own data" 
ON public.resellers 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Garantir que a tabela de licenças tem RLS habilitado e políticas corretas
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Resellers can insert their own licenses" ON public.licenses;
CREATE POLICY "Resellers can insert their own licenses" 
ON public.licenses 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Resellers can view their own licenses" ON public.licenses;
CREATE POLICY "Resellers can view their own licenses" 
ON public.licenses 
FOR SELECT 
USING (auth.uid() = created_by);