-- Política para permitir que revendedores excluam sessões de suas licenças
CREATE POLICY "Resellers can delete sessions of their licenses" 
ON public.sessions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.licenses 
    WHERE licenses.id = sessions.license_id 
    AND licenses.created_by = auth.uid()
  )
);

-- Política para permitir que revendedores atualizem suas próprias licenças
-- Isso é necessário para limpar o device_id ao liberar uma sessão
CREATE POLICY "Resellers can update their own licenses" 
ON public.licenses 
FOR UPDATE 
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);
