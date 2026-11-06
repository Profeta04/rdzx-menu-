
-- Drop ALL existing update/delete policies for images
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Recreate with ownership verification
CREATE POLICY "Users can update their own images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'images' AND (storage.foldername(name))[1] = auth.uid()::text);
