-- Drop existing policies on resellers to clean up
DROP POLICY IF EXISTS "Resellers can view their own data" ON public.resellers;
DROP POLICY IF EXISTS "Resellers can link their account" ON public.resellers;
DROP POLICY IF EXISTS "Admins can view all resellers" ON public.resellers;
DROP POLICY IF EXISTS "Admins can insert resellers" ON public.resellers;
DROP POLICY IF EXISTS "Admins can update resellers" ON public.resellers;
DROP POLICY IF EXISTS "Admins can delete resellers" ON public.resellers;

-- 1. Add foreign key if it's not there
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_resellers_user_id') THEN
        ALTER TABLE public.resellers 
        ADD CONSTRAINT fk_resellers_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Define Policies

-- Admins can do everything
CREATE POLICY "Admins can view all resellers" 
ON public.resellers 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins can insert resellers" 
ON public.resellers 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update resellers" 
ON public.resellers 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete resellers" 
ON public.resellers 
FOR DELETE 
USING (is_admin());

-- Individual resellers can still view their own data
CREATE POLICY "Users can view their own reseller record" 
ON public.resellers 
FOR SELECT 
USING (
    auth.uid() = user_id 
    OR (
        (auth.jwt() ->> 'email'::text) = email 
        AND user_id IS NULL
    )
);

-- Individual users can link their reseller record if email matches and user_id is null
CREATE POLICY "Users can link their reseller record" 
ON public.resellers 
FOR UPDATE 
USING (
    (auth.jwt() ->> 'email'::text) = email 
    AND user_id IS NULL
)
WITH CHECK (
    auth.uid() = user_id
);
