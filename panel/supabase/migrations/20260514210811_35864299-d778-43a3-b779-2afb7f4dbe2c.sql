-- Update stale sessions immediately (older than 5 minutes)
UPDATE public.sessions
SET is_active = false
WHERE is_active = true 
  AND last_heartbeat < (now() - interval '5 minutes');

-- Function to cleanup stale sessions
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS void AS $$
BEGIN
    UPDATE public.sessions
    SET is_active = false
    WHERE is_active = true 
      AND last_heartbeat < (now() - interval '5 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get accurate count of really active sessions (with heartbeat in last 5 min)
CREATE OR REPLACE FUNCTION public.get_real_active_session_count()
RETURNS integer AS $$
DECLARE
    session_count integer;
BEGIN
    SELECT count(*) INTO session_count
    FROM public.sessions
    WHERE is_active = true 
      AND last_heartbeat >= (now() - interval '5 minutes');
    RETURN session_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
