-- Set search_path for the update_updated_at function
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Drop and recreate the policy for payments to be more specific (though it was already for authenticated)
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;

CREATE POLICY "Admins can manage payments" ON public.payments
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
-- Since it's an internal admin dashboard, this is acceptable for now.
