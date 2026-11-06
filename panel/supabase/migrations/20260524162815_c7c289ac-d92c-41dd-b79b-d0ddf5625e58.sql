-- Split increment_license_prompts into counter-only + optional log RPC.
-- Backward compatible: original function kept but no longer used by /pc.

CREATE OR REPLACE FUNCTION public.increment_license_prompts_counter(l_key text)
RETURNS void
LANGUAGE sql
SET search_path TO 'public'
AS $$
  UPDATE public.licenses
  SET prompts_count = COALESCE(prompts_count, 0) + 1
  WHERE license_key = l_key;
$$;

CREATE OR REPLACE FUNCTION public.log_prompt_usage(l_key text, p_status text DEFAULT 'success', p_message text DEFAULT 'Prompt enviado')
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_reseller_id UUID;
BEGIN
  SELECT r.id INTO v_reseller_id
  FROM public.resellers r
  JOIN public.licenses l ON l.created_by = r.user_id
  WHERE l.license_key = l_key
  LIMIT 1;

  INSERT INTO public.usage_logs (client_license, reseller_id, status, message)
  VALUES (l_key, v_reseller_id, p_status, p_message);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_license_prompts_counter(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_prompt_usage(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_license_prompts_counter(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_prompt_usage(text, text, text) TO service_role;

-- Ensure efficient purge
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON public.usage_logs (created_at);