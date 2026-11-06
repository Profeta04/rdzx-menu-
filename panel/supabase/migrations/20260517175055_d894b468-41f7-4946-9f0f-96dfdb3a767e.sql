-- Table to track rate limits per license_key
CREATE TABLE IF NOT EXISTS public.rate_limits_license (
    license_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (license_key, event_type)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_license_lookup ON public.rate_limits_license(license_key, event_type);

-- Function to check and increment rate limit for a license key
CREATE OR REPLACE FUNCTION public.check_rate_limit_license(
    p_license_key TEXT,
    p_event_type TEXT,
    p_limit INTEGER,
    p_window_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_now TIMESTAMP WITH TIME ZONE := now();
BEGIN
    -- Cleanup old entries (optional, could be a cron job, but doing it here for simplicity in this context)
    -- DELETE FROM public.rate_limits_license WHERE window_start < v_now - (p_window_minutes || ' minutes')::INTERVAL;

    SELECT request_count, window_start INTO v_count, v_window_start
    FROM public.rate_limits_license
    WHERE license_key = p_license_key AND event_type = p_event_type;

    IF NOT FOUND OR v_window_start < v_now - (p_window_minutes || ' minutes')::INTERVAL THEN
        INSERT INTO public.rate_limits_license (license_key, event_type, request_count, window_start)
        VALUES (p_license_key, p_event_type, 1, v_now)
        ON CONFLICT (license_key, event_type)
        DO UPDATE SET request_count = 1, window_start = v_now;
        RETURN FALSE;
    ELSE
        IF v_count >= p_limit THEN
            RETURN TRUE; -- Blocked
        ELSE
            UPDATE public.rate_limits_license
            SET request_count = request_count + 1
            WHERE license_key = p_license_key AND event_type = p_event_type;
            RETURN FALSE;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
