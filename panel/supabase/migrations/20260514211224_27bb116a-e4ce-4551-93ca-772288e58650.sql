-- Restore sessions active within the last week
UPDATE public.sessions
SET is_active = true
WHERE last_heartbeat >= (now() - interval '7 days');

-- Update the cleanup function to a 7-day window
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS void AS $$
BEGIN
    UPDATE public.sessions
    SET is_active = false
    WHERE is_active = true 
      AND last_heartbeat < (now() - interval '7 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update the counting function to a 7-day window
CREATE OR REPLACE FUNCTION public.get_real_active_session_count()
RETURNS integer AS $$
DECLARE
    session_count integer;
BEGIN
    SELECT count(*) INTO session_count
    FROM public.sessions
    WHERE is_active = true 
      AND last_heartbeat >= (now() - interval '7 days');
    RETURN session_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
