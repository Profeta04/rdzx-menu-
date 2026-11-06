-- Add API columns to resellers table
ALTER TABLE public.resellers 
ADD COLUMN IF NOT EXISTS api_key_hash TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS api_key_prefix TEXT,
ADD COLUMN IF NOT EXISTS api_status TEXT DEFAULT 'inactive' CHECK (api_status IN ('active', 'inactive', 'suspended'));

-- Create table for API logs
CREATE TABLE IF NOT EXISTS public.reseller_api_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reseller_id UUID REFERENCES public.resellers(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    tokens INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on logs
ALTER TABLE public.reseller_api_logs ENABLE ROW LEVEL SECURITY;

-- Resellers can view their own logs
CREATE POLICY "Resellers can view their own logs" 
ON public.reseller_api_logs 
FOR SELECT 
USING (
    auth.uid() IN (
        SELECT user_id FROM public.resellers WHERE id = reseller_id
    )
);

-- Function to find reseller by API key hash
CREATE OR REPLACE FUNCTION public.find_reseller_by_api_key_hash(p_hash TEXT)
RETURNS SETOF public.resellers
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.resellers 
    WHERE api_key_hash = p_hash 
    AND api_status = 'active';
$$;

-- Function to insert API log
CREATE OR REPLACE FUNCTION public.insert_api_log(
    p_reseller_id UUID,
    p_action TEXT,
    p_endpoint TEXT,
    p_tokens INTEGER,
    p_status TEXT,
    p_error TEXT DEFAULT NULL,
    p_meta JSONB DEFAULT '{}'::jsonb,
    p_ip TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.reseller_api_logs (
        reseller_id, action, endpoint, tokens, status, error, metadata, ip
    ) VALUES (
        p_reseller_id, p_action, p_endpoint, p_tokens, p_status, p_error, p_meta, p_ip
    );
END;
$$;