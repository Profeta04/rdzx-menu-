ALTER TABLE public.resellers DISABLE TRIGGER USER;
UPDATE public.resellers SET tokens_monthly=20, tokens_7d=10, updated_at=now() WHERE lower(email)='douglasmartins2501@gmail.com';
ALTER TABLE public.resellers ENABLE TRIGGER USER;