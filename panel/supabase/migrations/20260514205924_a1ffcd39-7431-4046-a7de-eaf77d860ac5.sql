-- First, update all licenses that are already expired
UPDATE public.licenses
SET status = 'expired'
WHERE status = 'active' 
  AND expires_at < now();

-- Function to check and update expiration status
CREATE OR REPLACE FUNCTION public.update_license_status_on_expiry()
RETURNS TRIGGER AS $$
BEGIN
    -- If the expiration date is in the past, force status to expired
    IF NEW.expires_at IS NOT NULL AND NEW.expires_at < now() THEN
        NEW.status := 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check expiration on insert or update
DROP TRIGGER IF EXISTS trigger_update_license_status_on_expiry ON public.licenses;
CREATE TRIGGER trigger_update_license_status_on_expiry
BEFORE INSERT OR UPDATE ON public.licenses
FOR EACH ROW
EXECUTE FUNCTION public.update_license_status_on_expiry();

-- We also want a way to "poll" for expirations that happen without an update
-- Note: In Supabase, we can use pg_cron if enabled, or just rely on the frontend 
-- to reflect the truth, but let's create a function that can be called by a cron job or manual action.
CREATE OR REPLACE FUNCTION public.sync_expired_licenses()
RETURNS void AS $$
BEGIN
    UPDATE public.licenses
    SET status = 'expired'
    WHERE status = 'active' 
      AND expires_at < now();
END;
$$ LANGUAGE plpgsql;
