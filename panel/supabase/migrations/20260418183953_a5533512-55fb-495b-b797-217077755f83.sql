-- Update deduct_reseller_credit function to check for sufficient credits
CREATE OR REPLACE FUNCTION public.deduct_reseller_credit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    current_credits integer;
BEGIN
    -- Only proceed if created_by is set (reseller license)
    IF NEW.created_by IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get current credits
    SELECT credits INTO current_credits FROM public.resellers WHERE user_id = NEW.created_by;
    
    -- If no reseller found or not enough credits, abort
    IF current_credits IS NULL OR current_credits < 1 THEN
        RAISE EXCEPTION 'Créditos insuficientes para gerar esta licença.';
    END IF;

    -- Update credits
    UPDATE public.resellers
    SET credits = credits - 1
    WHERE user_id = NEW.created_by;
    
    RETURN NEW;
END;
$function$;

-- Function to set expires_at on activation
CREATE OR REPLACE FUNCTION public.handle_license_activation()
RETURNS TRIGGER AS $$
BEGIN
    -- If device_id is being set (activation) and activated_at is set
    -- and expires_at is NOT set, and duration_days IS set
    IF (OLD.device_id IS NULL AND NEW.device_id IS NOT NULL) 
       AND NEW.activated_at IS NOT NULL 
       AND NEW.expires_at IS NULL 
       AND NEW.duration_days IS NOT NULL THEN
        
        NEW.expires_at = NEW.activated_at + (NEW.duration_days || ' days')::interval;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for license activation
DROP TRIGGER IF EXISTS tr_handle_license_activation ON public.licenses;
CREATE TRIGGER tr_handle_license_activation
BEFORE UPDATE ON public.licenses
FOR EACH ROW
EXECUTE FUNCTION public.handle_license_activation();

-- Ensure RLS for resellers to create licenses
-- The policies already exist but let's make sure they are robust
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'licenses' AND policyname = 'Resellers can insert their own licenses'
    ) THEN
        CREATE POLICY "Resellers can insert their own licenses" 
        ON public.licenses 
        FOR INSERT 
        WITH CHECK (auth.uid() = created_by);
    END IF;
END $$;
