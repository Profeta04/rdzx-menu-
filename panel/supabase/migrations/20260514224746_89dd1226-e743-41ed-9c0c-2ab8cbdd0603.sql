
-- 1. Create private admin_credentials table
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  user_id uuid PRIMARY KEY,
  admin_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role can access (bypasses RLS).

-- 2. Migrate existing admin_keys
INSERT INTO public.admin_credentials (user_id, admin_key)
SELECT id, admin_key FROM public.profiles WHERE admin_key IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET admin_key = EXCLUDED.admin_key;

-- 3. Drop admin_key column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS admin_key;

-- 4. Update handle_admin_setup trigger to write to new table
CREATE OR REPLACE FUNCTION public.handle_admin_setup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_key text;
BEGIN
  IF (NEW.email = 'pedroviniciusferminoprofeta@gmail.com') THEN
    v_new_key := 'ADMIN-' || replace(gen_random_uuid()::text, '-', '');

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.admin_credentials (user_id, admin_key)
    VALUES (NEW.id, v_new_key)
    ON CONFLICT (user_id) DO UPDATE SET admin_key = v_new_key, updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Remove dangerous reseller email-claim policy
DROP POLICY IF EXISTS "Users can link their reseller record" ON public.resellers;
DROP POLICY IF EXISTS "Users can view their own reseller record" ON public.resellers;
CREATE POLICY "Resellers view own record by user_id"
ON public.resellers FOR SELECT
USING (auth.uid() = user_id);

-- 6. Tighten storage policies on 'files' bucket
DROP POLICY IF EXISTS "Allow public uploads to uploads folder" ON storage.objects;
DROP POLICY IF EXISTS "Public can read individual files" ON storage.objects;
-- Keep "Public Access Files" which only exposes the uploads/ folder for SELECT.
-- Keep "Authenticated users can upload files" for INSERT.

-- 7. Fix mutable search_path on remaining functions
ALTER FUNCTION public.deduct_reseller_credit() SET search_path = 'public';
ALTER FUNCTION public.sync_expired_licenses() SET search_path = 'public';
ALTER FUNCTION public.update_license_status_on_expiry() SET search_path = 'public';
