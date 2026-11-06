-- Remover política genérica se existir
DROP POLICY IF EXISTS "Public Access Files" ON storage.objects;

-- Criar política de leitura pública restrita à pasta uploads/
CREATE POLICY "Public Access Files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'files' AND (storage.foldername(name))[1] = 'uploads');
