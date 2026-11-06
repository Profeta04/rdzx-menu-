-- 1. Tornar a função de RPC SECURITY DEFINER para evitar problemas de RLS durante a execução
-- e garantir que ela tenha permissão para inserir na tabela de licenças e atualizar revendedores.
CREATE OR REPLACE FUNCTION public.create_license_with_token(
    p_license_key text, 
    p_user_name text, 
    p_client_email text, 
    p_client_phone text, 
    p_duration_days numeric, 
    p_max_sessions integer
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id uuid;
    v_is_reseller boolean;
BEGIN
    -- Obter o ID do usuário autenticado
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado. Por favor, faça login novamente.';
    END IF;

    -- Verificar se o usuário é um revendedor ou admin
    SELECT EXISTS (
        SELECT 1 FROM public.resellers WHERE user_id = v_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin'
    ) INTO v_is_reseller;

    IF NOT v_is_reseller THEN
        RAISE EXCEPTION 'Acesso negado. Você não possui permissão para gerar licenças.';
    END IF;

    -- Inserir a licença
    -- A trigger deduct_reseller_credit cuidará da validação de tokens e duração mínima
    INSERT INTO public.licenses (
        license_key,
        user_name,
        client_email,
        client_phone,
        duration_days,
        max_sessions,
        created_by,
        status,
        lifetime,
        expires_at
    )
    VALUES (
        p_license_key,
        p_user_name,
        p_client_email,
        p_client_phone,
        p_duration_days,
        p_max_sessions,
        v_user_id,
        'active',
        (p_duration_days >= 9999),
        CASE 
            WHEN p_duration_days >= 9999 THEN NULL -- Lifetime
            ELSE now() + (p_duration_days || ' days')::interval
        END
    );
END;
$function$;

-- 2. Garantir índices para performance
CREATE INDEX IF NOT EXISTS idx_resellers_user_id ON public.resellers(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_created_by ON public.licenses(created_by);

-- 3. Pequeno ajuste na trigger para garantir mensagens de erro consistentes
CREATE OR REPLACE FUNCTION public.deduct_reseller_credit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    reseller_id_val uuid;
    reseller_tokens_7d integer;
    reseller_tokens_monthly integer;
    reseller_tokens_annual integer;
    reseller_tokens_lifetime integer;
    is_creator_admin boolean;
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
    SELECT id, tokens_7d, tokens_monthly, tokens_annual, tokens_lifetime 
    INTO reseller_id_val, reseller_tokens_7d, reseller_tokens_monthly, reseller_tokens_annual, reseller_tokens_lifetime
    FROM public.resellers 
    WHERE user_id = NEW.created_by;
    
    -- Se não encontrar revendedor e não for admin, bloquear (segurança extra)
    IF reseller_id_val IS NULL THEN
        RAISE EXCEPTION 'Revendedor não encontrado para o usuário atual.';
    END IF;

    -- Validação de duração mínima para revendedores
    IF NEW.duration_days < 7 AND NOT (NEW.duration_days >= 9999) THEN
        RAISE EXCEPTION 'Erro: Licenças para revenda devem ter no mínimo 7 dias. O sistema de Trial foi desativado.';
    END IF;

    -- Deduzir tokens
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
        RAISE EXCEPTION 'Duração de licença inválida ou abaixo do mínimo permitido (7 dias).';
    END IF;

    RETURN NEW;
END;
$function$;
