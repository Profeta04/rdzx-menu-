
-- Restaurar GRANT EXECUTE nas funções RPC consumidas pelo Painel de Revenda e pela Edge Function reseller-api.
-- A reestruturação anterior removeu os privilégios padrão, fazendo o Postgres bloquear chamadas com
-- "permission denied for function ..." antes de qualquer lógica de negócio rodar.

-- 1) RPCs chamadas pelo painel (sessão Supabase Auth = role 'authenticated')
GRANT EXECUTE ON FUNCTION public.create_license_with_token(text, text, text, text, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_reseller_api_key(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reseller_stats() TO authenticated;

-- 2) RPCs chamadas pela Edge Function reseller-api (service_role)
GRANT EXECUTE ON FUNCTION public.create_license_with_token_service(text, text, text, text, numeric, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_reseller_by_api_key_hash(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_api_log(uuid, text, text, integer, text, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_reseller_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_reseller_credits(uuid, integer, text) TO service_role;

-- 3) Utilitários usados pela extensão / validação de licenças (service_role + authenticated)
GRANT EXECUTE ON FUNCTION public.increment_license_uses(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_license_prompts(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_license_editing_time(text, integer) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_real_active_session_count() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_expired_licenses() TO service_role;

-- 4) Helpers de segurança/rate-limit/nonce (service_role)
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_ip(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_nonce(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_fraud_event(text, text, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
