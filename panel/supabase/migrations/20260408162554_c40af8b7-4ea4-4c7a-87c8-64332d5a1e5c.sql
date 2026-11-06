-- Allow anon to insert licenses
CREATE POLICY "Allow anon insert licenses" 
ON public.licenses 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- Allow anon to update licenses
CREATE POLICY "Allow anon update licenses" 
ON public.licenses 
FOR UPDATE 
TO anon 
USING (true);

-- Also allow anon to delete notifications for the dashboard
CREATE POLICY "Allow anon delete notifications"
ON public.notifications
FOR DELETE
TO anon
USING (true);

-- Allow anon to insert notifications
CREATE POLICY "Allow anon insert notifications"
ON public.notifications
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to insert extension versions
CREATE POLICY "Allow anon insert extension_versions"
ON public.extension_versions
FOR INSERT
TO anon
WITH CHECK (true);
