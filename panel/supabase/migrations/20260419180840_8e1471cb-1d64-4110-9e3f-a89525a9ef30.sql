CREATE OR REPLACE FUNCTION public.increment_license_prompts(l_key TEXT)
RETURNS VOID AS $$
DECLARE
  v_reseller_id UUID;
BEGIN
  -- Update the license count and get the creator's reseller ID if it exists
  UPDATE public.licenses
  SET prompts_count = COALESCE(prompts_count, 0) + 1
  WHERE license_key = l_key;

  -- Get the reseller_id associated with this license (if created by a reseller)
  SELECT r.id INTO v_reseller_id
  FROM public.resellers r
  JOIN public.licenses l ON l.created_by = r.user_id
  WHERE l.license_key = l_key
  LIMIT 1;

  -- Log the usage in usage_logs
  INSERT INTO public.usage_logs (client_license, reseller_id, status, message)
  VALUES (l_key, v_reseller_id, 'success', 'Prompt enviado');
END;
$$ LANGUAGE plpgsql SET search_path = public;