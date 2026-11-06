-- Adicionar colunas email e license_key à tabela resellers
ALTER TABLE public.resellers ADD COLUMN email TEXT;
ALTER TABLE public.resellers ADD COLUMN license_key TEXT;

-- Tornar user_id opcional
ALTER TABLE public.resellers ALTER COLUMN user_id DROP NOT NULL;

-- Criar índice único para a chave de licença
CREATE UNIQUE INDEX idx_resellers_license_key ON public.resellers(license_key);
CREATE UNIQUE INDEX idx_resellers_email ON public.resellers(email);
