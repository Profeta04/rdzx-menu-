ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS livepix_id TEXT,
ADD COLUMN IF NOT EXISTS pix_payload TEXT,
ADD COLUMN IF NOT EXISTS pix_qr_code TEXT;

-- Update RLS policies to allow public insertion if needed, 
-- though it's better to do it via an edge function for security.
-- For now, let's keep it restricted and use the service role in the edge function.
