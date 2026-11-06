-- Drop existing policy
DROP POLICY IF EXISTS "Resellers can view their own data" ON public.resellers;

-- Create more permissive policy for viewing
CREATE POLICY "Resellers can view their own data" 
ON public.resellers 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  (auth.jwt() ->> 'email' = email AND user_id IS NULL)
);

-- Create policy for updating (linking)
CREATE POLICY "Resellers can link their account" 
ON public.resellers 
FOR UPDATE 
USING (
  (auth.jwt() ->> 'email' = email AND user_id IS NULL)
)
WITH CHECK (
  (auth.uid() = user_id)
);
