-- 1. Remover privilégios de execução pública (segurança padrão)
REVOKE EXECUTE ON FUNCTION public.create_license_with_token(text, text, text, text, numeric, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_reseller_credits(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_reseller_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_reseller_api_key(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_license_prompts(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_license_uses(text) FROM PUBLIC, anon;

-- 2. Conceder execução apenas para usuários autenticados (Revendedores e Admins)
-- Isso garante que a extensão e o painel continuem funcionando para quem está logado.
GRANT EXECUTE ON FUNCTION public.create_license_with_token(text, text, text, text, numeric, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_reseller_credits(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_reseller_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_reseller_api_key(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_license_prompts(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_license_uses(text) TO authenticated, service_role;

-- 3. Proteção adicional: Garantir que is_admin e outras funções de verificação sejam restritas
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
