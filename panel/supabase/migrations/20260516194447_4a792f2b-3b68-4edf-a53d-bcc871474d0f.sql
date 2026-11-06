REVOKE EXECUTE ON FUNCTION public.create_license_with_token_service(text, text, text, text, numeric, integer, uuid, boolean) FROM public;
REVOKE EXECUTE ON FUNCTION public.create_license_with_token_service(text, text, text, text, numeric, integer, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_license_with_token_service(text, text, text, text, numeric, integer, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_license_with_token_service(text, text, text, text, numeric, integer, uuid, boolean) TO service_role;
