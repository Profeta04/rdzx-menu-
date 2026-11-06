-- RPC para criação de licença via Service Role (Edge Function)
-- Pula a verificação de auth.uid() pois é chamada por um processo confiável
CREATE OR REPLACE FUNCTION public.create_license_with_token_service(
    p_license_key text, 
    p_user_name text, 
    p_client_email text, 
    p_client_phone text, 
    p_duration_days numeric, 
    p_max_sessions integer,
    p_created_by uuid
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        expires_at
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
        (p_duration_days >= 9999),
        CASE 
            WHEN p_duration_days >= 9999 THEN NULL -- Lifetime
            ELSE now() + (p_duration_days || ' days')::interval
        END
    );
END;
$function$;
