ALTER TABLE public.resellers DISABLE TRIGGER USER;
UPDATE public.resellers SET email = lower(email) WHERE email IS NOT NULL AND email <> lower(email);
ALTER TABLE public.resellers ENABLE TRIGGER USER;