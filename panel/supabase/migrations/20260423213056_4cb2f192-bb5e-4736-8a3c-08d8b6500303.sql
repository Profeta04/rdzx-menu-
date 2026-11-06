-- Drop the existing function first to change parameter type
DROP FUNCTION IF EXISTS public.create_license_with_token(text, text, text, text, integer, integer);

-- Recreate with numeric p_duration_days
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
BEGIN
    -- Insert the new license
    -- The trigger tr_deduct_reseller_credit on the licenses table 
    -- will automatically handle the token deduction from the resellers table
    -- based on the duration_days and the current user (auth.uid())
    INSERT INTO public.licenses (
        license_key,
        user_name,
        client_email,
        client_phone,
        duration_days,
        max_sessions,
        created_by,
        status,
        expires_at
    )
    VALUES (
        p_license_key,
        p_user_name,
        p_client_email,
        p_client_phone,
        p_duration_days,
        p_max_sessions,
        auth.uid(),
        'active',
        CASE 
            WHEN p_duration_days >= 9999 THEN NULL -- Lifetime
            ELSE now() + (p_duration_days || ' days')::interval
        END
    );
END;
$function$;
