
REVOKE EXECUTE ON FUNCTION public.consume_nonce(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_fraud_event(text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit_ip(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_nonce(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_fraud_event(text, text, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_ip(text, text, integer, integer) TO service_role;
