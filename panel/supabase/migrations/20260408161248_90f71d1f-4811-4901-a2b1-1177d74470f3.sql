
-- Create enum for license status
CREATE TYPE public.license_status AS ENUM ('active', 'trial', 'expired', 'revoked');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'reseller', 'user');

-- Licenses table
CREATE TABLE public.licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key TEXT NOT NULL UNIQUE,
  user_name TEXT,
  user_id TEXT,
  status license_status NOT NULL DEFAULT 'active',
  device_id TEXT,
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_sessions INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sessions table
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  device_id TEXT,
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Extension versions table
CREATE TABLE public.extension_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  changelog TEXT,
  file_path TEXT,
  is_alert_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (referencing licenses)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Packages table
CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  duration_days INTEGER,
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Read policies (anon can read for extension usage)
CREATE POLICY "Allow anon read licenses" ON public.licenses FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read notifications" ON public.notifications FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read extension_versions" ON public.extension_versions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read user_roles" ON public.user_roles FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read packages" ON public.packages FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read sessions" ON public.sessions FOR SELECT TO anon USING (true);

-- Service role has full access by default (bypasses RLS)
-- No write policies for anon - all writes go through edge functions with service_role key

-- Create indexes
CREATE INDEX idx_licenses_key ON public.licenses(license_key);
CREATE INDEX idx_sessions_license ON public.sessions(license_id);
CREATE INDEX idx_sessions_active ON public.sessions(is_active, last_heartbeat);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_licenses_updated_at
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
