-- Aumentar o limite de 5 minutos para 2 horas
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS void AS $$
BEGIN
    UPDATE public.sessions
    SET is_active = false
    WHERE is_active = true 
      AND last_heartbeat < (now() - interval '2 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_real_active_session_count()
RETURNS integer AS $$
DECLARE
    session_count integer;
BEGIN
    SELECT count(*) INTO session_count
    FROM public.sessions
    WHERE is_active = true 
      AND last_heartbeat >= (now() - interval '2 hours');
    RETURN session_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Reativar sessões que estão marcadas como inativas mas tiveram atividade nas últimas 2 horas
UPDATE public.sessions
SET is_active = true
WHERE is_active = false 
  AND last_heartbeat >= (now() - interval '2 hours');
