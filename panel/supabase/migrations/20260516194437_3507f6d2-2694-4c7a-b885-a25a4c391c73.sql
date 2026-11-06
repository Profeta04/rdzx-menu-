-- Drop the old function first since we are changing the signature (adding a parameter)
DROP FUNCTION IF EXISTS public.create_license_with_token_service(text, text, text, text, numeric, integer, uuid);

CREATE OR REPLACE FUNCTION public.create_license_with_token_service(
    p_license_key text,
    p_user_name text,
    p_client_email text,
    p_client_phone text,
    p_duration_days numeric,
    p_max_sessions integer,
    p_created_by uuid,
    p_is_daily boolean DEFAULT false
)
RETURNS void AS $$
BEGIN
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
        p_created_by,
        'active',
        (p_duration_days >= 9999 AND p_is_daily = false),
        CASE 
            WHEN (p_duration_days >= 9999 AND p_is_daily = false) THEN NULL -- Lifetime
            ELSE now() + (p_duration_days || ' days')::interval
        END,
        p_is_daily
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
