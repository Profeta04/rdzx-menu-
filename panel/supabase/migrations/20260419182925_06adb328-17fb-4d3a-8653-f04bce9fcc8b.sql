-- Permitir que usuários anônimos (extensão) façam upload para a pasta uploads/
CREATE POLICY "Allow public uploads to uploads folder"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'files' 
  AND (storage.foldername(name))[1] = 'uploads'
);

-- Garantir que a leitura pública está ativa para o bucket files
-- (Já deve existir, mas reforçamos para os links funcionarem na Lovable)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access Files'
    ) THEN
        CREATE POLICY "Public Access Files"
        ON storage.objects
        FOR SELECT
        TO public
        USING (bucket_id = 'files');
    END IF;
END $$;
