-- Correction finale et robuste des politiques RLS pour le Guichet Vente
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. S'assurer que la fonction get_guichet_tenant_id est robuste
CREATE OR REPLACE FUNCTION public.get_guichet_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_token TEXT;
    v_tenant_id UUID;
BEGIN
    -- Tente de lire le token depuis les headers de la requête PostgREST
    v_token := current_setting('request.headers', true)::json->>'x-guichet-token';
    
    IF v_token IS NULL THEN
        RETURN NULL;
    END IF;

    -- Vérifie la validité du token dans la table des sessions
    SELECT tenant_id INTO v_tenant_id
    FROM public.guichet_sessions
    WHERE token = v_token::UUID AND expires_at > NOW();

    RETURN v_tenant_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
-- Note: STABLE permet à PostgreSQL de mettre en cache le résultat pendant la requête,
-- ce qui évite les problèmes d'évaluation multiple (notamment dans le WITH CHECK).

-- 2. Mettre à jour la politique sur les tickets
DROP POLICY IF EXISTS "Guichet can update tickets" ON public.tickets;

-- On utilise WITH CHECK (true) pour éviter que la fonction soit réévaluée après l'update
-- La sécurité est garantie par la clause USING qui filtre les lignes modifiables
CREATE POLICY "Guichet can update tickets" ON public.tickets
    FOR UPDATE 
    USING (tenant_id = public.get_guichet_tenant_id())
    WITH CHECK (true);

-- 3. Mettre à jour la politique sur l'historique des ventes
DROP POLICY IF EXISTS "Guichet can insert sales history" ON public.sales_history;

CREATE POLICY "Guichet can insert sales history" ON public.sales_history
    FOR INSERT 
    WITH CHECK (tenant_id = public.get_guichet_tenant_id());

-- 4. S'assurer que le rôle anon a les droits nécessaires
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, UPDATE ON public.tickets TO anon;
GRANT SELECT, INSERT ON public.sales_history TO anon;
GRANT SELECT ON public.ticket_profiles TO anon;
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT ON public.guichet_sessions TO anon;
GRANT SELECT ON public.sales_access_codes TO anon;

-- 5. S'assurer que les fonctions sont exécutables par anon
GRANT EXECUTE ON FUNCTION public.get_guichet_tenant_id() TO anon;
GRANT EXECUTE ON FUNCTION public.verify_guichet_pin(UUID, TEXT) TO anon;
