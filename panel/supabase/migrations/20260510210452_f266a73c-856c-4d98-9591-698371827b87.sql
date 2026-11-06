-- Create a table for Burp requests
CREATE TABLE IF NOT EXISTS public.burp_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL,
  payload JSONB,
  headers JSONB,
  response_status INTEGER,
  response_body TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.burp_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own burp requests" 
ON public.burp_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own burp requests" 
ON public.burp_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
