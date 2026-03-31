-- Ajout de la politique de suppression pour les sessions de guichet
-- À exécuter dans l'éditeur SQL de Supabase

DROP POLICY IF EXISTS "Admins can manage guichet sessions" ON public.guichet_sessions;

CREATE POLICY "Admins can manage guichet sessions" ON public.guichet_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND (
                users.role = 'ADMIN_GLOBAL' 
                OR 
                (users.role = 'GESTIONNAIRE_WIFI_ZONE' AND users.tenant_id = guichet_sessions.tenant_id)
            )
        )
    );
