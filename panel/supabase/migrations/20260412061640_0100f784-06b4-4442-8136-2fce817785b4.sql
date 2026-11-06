-- Create security_logs table
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success' or 'failure'
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own logs" 
ON public.security_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs" 
ON public.security_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid()::text AND role = 'admin'::public.app_role -- Assuming app_role is the custom enum
    )
);

-- Function to check if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id UUID, 
    p_event_type TEXT, 
    p_limit INTEGER, 
    p_window_minutes INTEGER
) 
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.security_logs
    WHERE user_id = p_user_id
      AND event_type = p_event_type
      AND status = 'failure'
      AND created_at > now() - (p_window_minutes || ' minutes')::interval;
    
    RETURN v_count >= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
