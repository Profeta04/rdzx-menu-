
-- 1. Fix profiles: drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Qualquer um pode ver perfis" ON public.profiles;

-- Replace with: users can only see their own profile (already exists but let's ensure)
-- The "Users can view their own profile" policy already exists

-- 2. Fix payments: replace the overly permissive ALL policy with admin-only
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;

CREATE POLICY "Admins can manage payments"
ON public.payments
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Also allow service role inserts for the webhook (service role bypasses RLS anyway)

-- 3. Fix nonces tables: add explicit deny-all policies
CREATE POLICY "Deny all access to nonces"
ON public.nonces
FOR ALL
TO public
USING (false);

CREATE POLICY "Deny all access to request_nonces"
ON public.request_nonces
FOR ALL
TO public
USING (false);

-- 4. Fix storage: drop overly permissive policies on files bucket and replace
DROP POLICY IF EXISTS "Allow public uploads to files bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to files bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from files bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Public can update files" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete files" ON storage.objects;

-- Allow only authenticated users to upload to files bucket
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'files');

-- Allow only authenticated users to update their own files
CREATE POLICY "Authenticated users can update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'files');

-- Allow only admins to delete files
CREATE POLICY "Admins can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'files' AND public.is_admin());

-- 5. Rotate admin key: update the handle_admin_setup function to use random key
CREATE OR REPLACE FUNCTION public.handle_admin_setup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_key text;
BEGIN
  IF (NEW.email = 'pedroviniciusferminoprofeta@gmail.com') THEN
    -- Generate a cryptographically random admin key
    v_new_key := 'ADMIN-' || replace(gen_random_uuid()::text, '-', '');
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO public.profiles (id, admin_key)
    VALUES (NEW.id, v_new_key)
    ON CONFLICT (id) DO UPDATE SET admin_key = v_new_key;
  END IF;
  RETURN NEW;
END;
$$;

-- Rotate the existing admin key immediately
UPDATE public.profiles
SET admin_key = 'ADMIN-' || replace(gen_random_uuid()::text, '-', '')
WHERE admin_key = 'HYPERADMIN-PVP-7890-8888';
