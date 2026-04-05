-- Solution de sécurité renforcée pour le Guichet Vente
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. On s'assure que la fonction get_guichet_tenant_id est robuste et STABLE
CREATE OR REPLACE FUNCTION public.get_guichet_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_token TEXT;
    v_tenant_id UUID;
BEGIN
    -- Lecture du token depuis les headers
    v_token := current_setting('request.headers', true)::json->>'x-guichet-token';
    
    IF v_token IS NULL THEN
        RETURN NULL;
    END IF;

    -- Vérification de la session
    SELECT tenant_id INTO v_tenant_id
    FROM public.guichet_sessions
    WHERE token = v_token::UUID AND expires_at > NOW();

    RETURN v_tenant_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. On durcit les politiques RLS pour les tickets
DROP POLICY IF EXISTS "Guichet can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Guichet can view tickets" ON public.tickets;

-- Politique de lecture : Uniquement les tickets du tenant lié au guichet
CREATE POLICY "Guichet can view tickets" ON public.tickets
    FOR SELECT 
    USING (
        auth.role() = 'authenticated' 
        OR 
        (auth.role() = 'anon' AND tenant_id = public.get_guichet_tenant_id())
    );

-- Politique de mise à jour : Uniquement les tickets du tenant lié au guichet
CREATE POLICY "Guichet can update tickets" ON public.tickets
    FOR UPDATE 
    USING (
        auth.role() = 'authenticated' 
        OR 
        (auth.role() = 'anon' AND tenant_id = public.get_guichet_tenant_id())
    )
    WITH CHECK (
        auth.role() = 'authenticated' 
        OR 
        (auth.role() = 'anon' AND tenant_id = public.get_guichet_tenant_id())
    );

-- 3. On durcit l'insertion dans l'historique des ventes
DROP POLICY IF EXISTS "Guichet can insert sales history" ON public.sales_history;

CREATE POLICY "Guichet can insert sales history" ON public.sales_history
    FOR INSERT 
    WITH CHECK (
        auth.role() = 'authenticated' 
        OR 
        (auth.role() = 'anon' AND tenant_id = public.get_guichet_tenant_id())
    );

-- 4. On s'assure que l'historique des ventes est lisible par le guichet
DROP POLICY IF EXISTS "Guichet can view sales history" ON public.sales_history;

CREATE POLICY "Guichet can view sales history" ON public.sales_history
    FOR SELECT 
    USING (
        auth.role() = 'authenticated' 
        OR 
        (auth.role() = 'anon' AND tenant_id = public.get_guichet_tenant_id())
    );

-- 5. On s'assure que les profils sont lisibles
DROP POLICY IF EXISTS "Guichet can view ticket profiles" ON public.ticket_profiles;

CREATE POLICY "Guichet can view ticket profiles" ON public.ticket_profiles
    FOR SELECT 
    USING (
        auth.role() = 'authenticated' 
        OR 
        (auth.role() = 'anon' AND tenant_id = public.get_guichet_tenant_id())
    );

-- 6. On redonne les droits d'exécution
GRANT EXECUTE ON FUNCTION public.get_guichet_tenant_id() TO anon;
GRANT EXECUTE ON FUNCTION public.get_guichet_tenant_id() TO authenticated;
