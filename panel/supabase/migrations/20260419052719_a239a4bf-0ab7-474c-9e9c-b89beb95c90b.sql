-- 1. CRÍTICO: Remover políticas inseguras do bucket 'files'
DROP POLICY IF EXISTS "Public Upload Files" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Files" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Files" ON storage.objects;

-- Restringir bucket 'files' apenas para admins gerenciarem
CREATE POLICY "Admins can manage files bucket"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'files' AND public.is_admin())
WITH CHECK (bucket_id = 'files' AND public.is_admin());

-- Manter leitura pública limitada (necessário para extensão baixar arquivos)
CREATE POLICY "Public can read individual files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'files');

-- 2. CRÍTICO: Bloquear inserção direta em user_roles (escalação de privilégio)
DROP POLICY IF EXISTS "Users can only insert user role for themselves" ON public.user_roles;

-- Apenas admins podem gerenciar roles (já existe a policy "Admins can manage all roles")

-- 3. Restringir security_logs apenas para autenticados
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.security_logs;

CREATE POLICY "Authenticated users can insert their own logs"
ON public.security_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Restringir listagem do bucket 'images' (uploads/leitura individual ok, listagem não)
DROP POLICY IF EXISTS "Public Upload Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Images" ON storage.objects;

CREATE POLICY "Admins can manage images bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images' AND public.is_admin());

CREATE POLICY "Admins can update images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'images' AND public.is_admin());

CREATE POLICY "Admins can delete images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'images' AND public.is_admin());