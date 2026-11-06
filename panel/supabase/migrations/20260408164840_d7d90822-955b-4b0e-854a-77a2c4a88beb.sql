-- Create extension_versions table
CREATE TABLE IF NOT EXISTS public.extension_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL,
    changelog TEXT,
    file_path TEXT,
    is_alert_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.extension_versions ENABLE ROW LEVEL SECURITY;

-- Policies for extension_versions
DROP POLICY IF EXISTS "Public read access for extension_versions" ON public.extension_versions;
CREATE POLICY "Public read access for extension_versions" ON public.extension_versions FOR SELECT USING (true);

-- Ensure packages table exists
CREATE TABLE IF NOT EXISTS public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    duration_days INTEGER NOT NULL,
    features TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Policies for packages
DROP POLICY IF EXISTS "Public read access for packages" ON public.packages;
CREATE POLICY "Public read access for packages" ON public.packages FOR SELECT USING (true);

-- Ensure notifications table exists
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for notifications
DROP POLICY IF EXISTS "Public read access for notifications" ON public.notifications;
CREATE POLICY "Public read access for notifications" ON public.notifications FOR SELECT USING (true);

-- Ensure user_roles table exists
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for user_roles
DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT USING (true);
