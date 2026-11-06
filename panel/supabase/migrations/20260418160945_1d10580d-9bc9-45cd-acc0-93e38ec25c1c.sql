ALTER TABLE public.resellers 
ADD CONSTRAINT resellers_credits_check CHECK (credits >= 0);
