ALTER TABLE public.licenses 
ADD COLUMN prompts_count INTEGER DEFAULT 0,
ADD COLUMN editing_seconds INTEGER DEFAULT 0;