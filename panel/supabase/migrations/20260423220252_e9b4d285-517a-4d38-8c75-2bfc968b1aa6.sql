CREATE OR REPLACE FUNCTION public.set_reseller_api_key(p_hash TEXT, p_prefix TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reseller_id UUID;
BEGIN
    -- Get the reseller ID for the current authenticated user
    SELECT id INTO v_reseller_id FROM public.resellers WHERE user_id = auth.uid();
    
    IF v_reseller_id IS NULL THEN
        RAISE EXCEPTION 'User is not a registered reseller.';
    END IF;

    -- Update the reseller with the new key hash and prefix, and set status to active
    UPDATE public.resellers 
    SET 
        api_key_hash = p_hash,
        api_key_prefix = p_prefix,
        api_status = 'active',
        updated_at = now()
    WHERE id = v_reseller_id;
END;
$$;