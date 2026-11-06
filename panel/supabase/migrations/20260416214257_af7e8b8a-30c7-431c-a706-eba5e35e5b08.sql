
-- 1. LICENSES: remove public anon read policy
DROP POLICY IF EXISTS "Allow anon read licenses" ON public.licenses;

-- 2. SESSIONS: remove public anon read policy
DROP POLICY IF EXISTS "Allow anon read sessions" ON public.sessions;

-- 3. PROFILES: revoke column-level access to admin_key from client roles.
-- Service role bypasses RLS and column grants, so edge functions still work.
REVOKE SELECT (admin_key) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (admin_key) ON public.profiles FROM anon, authenticated;
REVOKE INSERT (admin_key) ON public.profiles FROM anon, authenticated;

-- Grant SELECT on all other columns explicitly so users can still read their profile
GRANT SELECT (id, full_name, avatar_url, bio, created_at, updated_at) ON public.profiles TO anon, authenticated;
GRANT INSERT (id, full_name, avatar_url, bio, created_at, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, bio, updated_at) ON public.profiles TO authenticated;

-- 4. STORAGE: tighten 'files' bucket update/delete policies with ownership check
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'files'
  AND (
    public.is_admin()
    OR (auth.uid()::text = (storage.foldername(name))[1])
  )
);

CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'files'
  AND (
    public.is_admin()
    OR (auth.uid()::text = (storage.foldername(name))[1])
  )
);
