
-- Drop ALL policies referencing user_roles
DROP POLICY IF EXISTS "Usuários podem ver suas próprias roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can only insert user role for themselves" ON public.user_roles;
DROP POLICY IF EXISTS "Allow authenticated users to add themselves to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

DROP POLICY IF EXISTS "Apenas admins podem inserir versões" ON public.extension_versions;
DROP POLICY IF EXISTS "Apenas admins podem atualizar versões" ON public.extension_versions;
DROP POLICY IF EXISTS "Apenas admins podem deletar versões" ON public.extension_versions;
DROP POLICY IF EXISTS "Admins can delete versions" ON public.extension_versions;

DROP POLICY IF EXISTS "Apenas admins podem inserir licenças" ON public.licenses;
DROP POLICY IF EXISTS "Apenas admins podem atualizar licenças" ON public.licenses;
DROP POLICY IF EXISTS "Apenas admins podem deletar licenças" ON public.licenses;
DROP POLICY IF EXISTS "Admins can delete licenses" ON public.licenses;

DROP POLICY IF EXISTS "Apenas admins podem inserir notificações" ON public.notifications;
DROP POLICY IF EXISTS "Apenas admins podem deletar notificações" ON public.notifications;

DROP POLICY IF EXISTS "Apenas admins podem gerenciar pacotes" ON public.packages;

DROP POLICY IF EXISTS "Admins can view all logs" ON public.security_logs;

-- Clean orphaned rows BEFORE type change
DELETE FROM public.user_roles
WHERE user_id::uuid NOT IN (SELECT id FROM auth.users);

-- Alter column type
ALTER TABLE public.user_roles
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- Add FK
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Recreate policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert user role for themselves"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'user'::app_role);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Admins can insert versions"
ON public.extension_versions FOR INSERT TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admins can update versions"
ON public.extension_versions FOR UPDATE TO authenticated
USING (is_admin());

CREATE POLICY "Admins can delete versions"
ON public.extension_versions FOR DELETE TO authenticated
USING (is_admin());

CREATE POLICY "Admins can insert licenses"
ON public.licenses FOR INSERT TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admins can update licenses"
ON public.licenses FOR UPDATE TO authenticated
USING (is_admin());

CREATE POLICY "Admins can delete licenses"
ON public.licenses FOR DELETE TO authenticated
USING (is_admin());

CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete notifications"
ON public.notifications FOR DELETE TO authenticated
USING (is_admin());

CREATE POLICY "Admins can manage packages"
ON public.packages FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Admins can view all logs"
ON public.security_logs FOR SELECT TO authenticated
USING (is_admin());
