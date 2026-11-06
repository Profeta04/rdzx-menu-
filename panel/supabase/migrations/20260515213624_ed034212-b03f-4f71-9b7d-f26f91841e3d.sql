
-- Harden storage INSERT policies: enforce per-user folder scoping
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Uploads" ON storage.objects;

CREATE POLICY "Users can upload files to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'files'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = (auth.uid())::text
  )
);

CREATE POLICY "Users can upload images to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'images'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = (auth.uid())::text
  )
);
