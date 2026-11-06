DROP FUNCTION IF EXISTS public.create_license_with_token(text, text, text, text, numeric, integer);

CREATE OR REPLACE FUNCTION public.create_license_with_token(
    p_license_key text,
    p_user_name text,
    p_client_email text,
    p_client_phone text,
    p_duration_days numeric,
    p_max_sessions integer,
    p_is_daily boolean DEFAULT false
)
RETURNS void AS $$
DECLARE
    v_user_id uuid;
    v_is_reseller boolean;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.resellers WHERE user_id = v_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin'
    ) INTO v_is_reseller;

    IF NOT v_is_reseller THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

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
        expires_at,
        is_daily
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
        (p_duration_days >= 9999 AND p_is_daily = false),
        CASE 
            WHEN (p_duration_days >= 9999 AND p_is_daily = false) THEN NULL
            ELSE now() + (p_duration_days || ' days')::interval
        END,
        p_is_daily
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER; -- This function uses auth.uid() so it should be invoker
