-- Permite que revendedores vejam as sessões das licenças que eles criaram
CREATE POLICY "Resellers can view sessions of their licenses" 
ON public.sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.licenses 
    WHERE licenses.id = sessions.license_id 
    AND licenses.created_by = auth.uid()
  )
);

-- Permite que revendedores atualizem (derrubem) as sessões das licenças que eles criaram
CREATE POLICY "Resellers can update sessions of their licenses" 
ON public.sessions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.licenses 
    WHERE licenses.id = sessions.license_id 
    AND licenses.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.licenses 
    WHERE licenses.id = sessions.license_id 
    AND licenses.created_by = auth.uid()
  )
);