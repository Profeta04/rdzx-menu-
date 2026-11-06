CREATE OR REPLACE FUNCTION public.increment_license_prompts(l_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.licenses
  SET prompts_count = COALESCE(prompts_count, 0) + 1
  WHERE license_key = l_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_license_editing_time(l_key TEXT, seconds INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.licenses
  SET editing_seconds = COALESCE(editing_seconds, 0) + seconds
  WHERE license_key = l_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;