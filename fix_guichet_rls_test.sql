-- Test script to fix the RLS issue on tickets for the guichet
DROP POLICY IF EXISTS "Guichet can update tickets" ON public.tickets;

CREATE POLICY "Guichet can update tickets" ON public.tickets
    FOR UPDATE 
    USING (tenant_id = public.get_guichet_tenant_id())
    WITH CHECK (true);
