-- Function to deactivate previous sessions for the same license
CREATE OR REPLACE FUNCTION public.limit_single_active_session()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if the new session is being set to active
    IF NEW.is_active = true THEN
        -- Deactivate all other sessions for this license
        UPDATE public.sessions
        SET is_active = false
        WHERE license_id = NEW.license_id
          AND id != NEW.id -- In case of updates to an existing session
          AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to enforce single session before insert or update
DROP TRIGGER IF EXISTS trigger_limit_single_session ON public.sessions;
CREATE TRIGGER trigger_limit_single_session
BEFORE INSERT OR UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.limit_single_active_session();

-- Clean up current data: for each license, keep only the most recent heartbeat session active
UPDATE public.sessions s
SET is_active = false
WHERE is_active = true
  AND id NOT IN (
    SELECT DISTINCT ON (license_id) id
    FROM public.sessions
    WHERE is_active = true
    ORDER BY license_id, last_heartbeat DESC
  );
