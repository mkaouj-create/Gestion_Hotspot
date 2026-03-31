-- S'assurer que les rôles anon et authenticated peuvent exécuter les fonctions du guichet
GRANT EXECUTE ON FUNCTION public.verify_guichet_pin(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guichet_tenant_id() TO anon, authenticated;

-- S'assurer que les tables sous-jacentes peuvent être lues/modifiées par les fonctions SECURITY DEFINER
-- Même si SECURITY DEFINER contourne RLS, il est parfois nécessaire de s'assurer que les droits de base sont là
-- pour le propriétaire de la fonction (postgres)
-- On va ajouter des politiques RLS pour guichet_sessions pour être sûr à 100%
ALTER TABLE public.guichet_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert guichet sessions" ON public.guichet_sessions;
CREATE POLICY "Anyone can insert guichet sessions" ON public.guichet_sessions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read guichet sessions" ON public.guichet_sessions;
CREATE POLICY "Anyone can read guichet sessions" ON public.guichet_sessions
    FOR SELECT USING (true);

-- S'assurer que sales_access_codes peut être lu par la fonction
DROP POLICY IF EXISTS "Guichet function can read access codes" ON public.sales_access_codes;
CREATE POLICY "Guichet function can read access codes" ON public.sales_access_codes
    FOR SELECT USING (true);
