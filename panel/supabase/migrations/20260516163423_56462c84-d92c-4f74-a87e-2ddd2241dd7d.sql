-- Revogar acesso público e anônimo da função service
REVOKE ALL ON FUNCTION public.create_license_with_token_service FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_license_with_token_service FROM anon;
REVOKE ALL ON FUNCTION public.create_license_with_token_service FROM authenticated;

-- Garantir que apenas o service_role possa executar
GRANT EXECUTE ON FUNCTION public.create_license_with_token_service TO service_role;
