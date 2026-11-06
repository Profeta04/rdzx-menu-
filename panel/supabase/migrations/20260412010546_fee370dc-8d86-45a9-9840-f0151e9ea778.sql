-- Add admin_key to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_key TEXT;

-- Update RLS for licenses to allow deletion by admins
-- First, ensure delete is allowed for admins
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'licenses' AND policyname = 'Admins can delete licenses'
    ) THEN
        CREATE POLICY "Admins can delete licenses" ON public.licenses
        FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = auth.uid()::text AND role = 'admin'
            )
        );
    END IF;
END $$;

-- Update RLS for extension_versions to allow deletion by admins
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'extension_versions' AND policyname = 'Admins can delete versions'
    ) THEN
        CREATE POLICY "Admins can delete versions" ON public.extension_versions
        FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = auth.uid()::text AND role = 'admin'
            )
        );
    END IF;
END $$;

-- Policy to only allow user to see their own admin_key (though they shouldn't see it via select normally if they don't have it, but it's good for verification)
-- Actually, we'll use it to verify the key on login
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Profiles are already enabled usually, but let's make sure.

-- If there's no policy for reading own profile, add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile'
    ) THEN
        CREATE POLICY "Users can view their own profile" ON public.profiles
        FOR SELECT USING (auth.uid() = id);
    END IF;
END $$;
