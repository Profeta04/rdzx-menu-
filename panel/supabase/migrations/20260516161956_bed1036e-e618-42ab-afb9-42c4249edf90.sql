-- Update the create_license_with_token function to be more robust
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
SECURITY INVOKER -- Changed from DEFINER to ensure auth.uid() is caught correctly
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Explicitly get the user ID
    v_user_id := auth.uid();
    
    -- Safety check: don't allow anonymous creation
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado. Por favor, faça login novamente.';
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
$$;