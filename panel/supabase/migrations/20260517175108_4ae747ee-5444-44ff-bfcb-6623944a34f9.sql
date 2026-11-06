-- Fix RLS
ALTER TABLE public.rate_limits_license ENABLE ROW LEVEL SECURITY;

-- Fix search_path and execution permissions
ALTER FUNCTION public.check_rate_limit_license(TEXT, TEXT, INTEGER, INTEGER) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit_license(TEXT, TEXT, INTEGER, INTEGER) FROM public;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit_license(TEXT, TEXT, INTEGER, INTEGER) FROM anon;

-- Also fix log_fraud_event and other security functions while we are at it
ALTER FUNCTION public.log_fraud_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.log_fraud_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM public;
REVOKE EXECUTE ON FUNCTION public.log_fraud_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;

ALTER FUNCTION public.check_rate_limit_ip(TEXT, TEXT, INTEGER, INTEGER) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit_ip(TEXT, TEXT, INTEGER, INTEGER) FROM public;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit_ip(TEXT, TEXT, INTEGER, INTEGER) FROM anon;
