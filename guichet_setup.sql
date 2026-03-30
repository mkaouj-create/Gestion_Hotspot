-- Activer l'extension pgcrypto pour le hachage des mots de passe
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Création de la table des codes d'accès (PIN)
CREATE TABLE IF NOT EXISTS public.sales_access_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Création de la table des sessions temporaires du guichet
CREATE TABLE IF NOT EXISTS public.guichet_sessions (
    token UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Fonction RPC pour vérifier le PIN et générer un token de session
CREATE OR REPLACE FUNCTION public.verify_guichet_pin(p_tenant_id UUID, p_pin TEXT)
RETURNS UUID AS $$
DECLARE
    v_hash TEXT;
    v_token UUID;
BEGIN
    -- Récupérer le hash du PIN pour ce tenant
    -- S'il y a plusieurs guichets, on vérifie si au moins un correspond
    SELECT pin_hash INTO v_hash
    FROM public.sales_access_codes
    WHERE tenant_id = p_tenant_id
    AND pin_hash = crypt(p_pin, pin_hash)
    LIMIT 1;

    -- Si aucun hash ne correspond, lever une erreur
    IF v_hash IS NULL THEN
        RAISE EXCEPTION 'Code PIN invalide ou accès refusé.';
    END IF;

    -- Créer une session valide pour 12 heures
    INSERT INTO public.guichet_sessions (tenant_id, expires_at)
    VALUES (p_tenant_id, NOW() + INTERVAL '12 hours')
    RETURNING token INTO v_token;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fonction pour extraire le tenant_id depuis le header personnalisé 'x-guichet-token'
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fonction pour créer un nouveau code de guichet (hachage du PIN)
CREATE OR REPLACE FUNCTION public.create_guichet_code(p_tenant_id UUID, p_name TEXT, p_pin TEXT)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Vérifier que l'utilisateur appelant a les droits (optionnel, mais recommandé si appelé depuis le client)
    -- Ici, on suppose que les RLS sur la table feront le travail, ou que c'est appelé par un admin.
    
    INSERT INTO public.sales_access_codes (tenant_id, name, pin_hash)
    VALUES (p_tenant_id, p_name, crypt(p_pin, gen_salt('bf')))
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Mise à jour des politiques RLS pour autoriser l'accès via le Guichet

-- Activer RLS sur les nouvelles tables (optionnel mais recommandé)
ALTER TABLE public.sales_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guichet_sessions ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent gérer les codes d'accès
CREATE POLICY "Admins can manage access codes" ON public.sales_access_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND (
                users.role = 'ADMIN_GLOBAL' 
                OR 
                (users.role = 'GESTIONNAIRE_WIFI_ZONE' AND users.tenant_id = sales_access_codes.tenant_id)
            )
        )
    );

-- Politiques pour les tickets
CREATE POLICY "Guichet can view tickets" ON public.tickets
    FOR SELECT USING (
        tenant_id = public.get_guichet_tenant_id() AND status = 'NEUF'
    );

CREATE POLICY "Guichet can update tickets" ON public.tickets
    FOR UPDATE USING (
        tenant_id = public.get_guichet_tenant_id()
    );

-- Politiques pour les profils de tickets
CREATE POLICY "Guichet can view ticket profiles" ON public.ticket_profiles
    FOR SELECT USING (
        tenant_id = public.get_guichet_tenant_id()
    );

-- Politiques pour l'historique des ventes
CREATE POLICY "Guichet can insert sales history" ON public.sales_history
    FOR INSERT WITH CHECK (
        tenant_id = public.get_guichet_tenant_id()
    );

CREATE POLICY "Guichet can view sales history" ON public.sales_history
    FOR SELECT USING (
        tenant_id = public.get_guichet_tenant_id()
    );

-- ==============================================================================
-- 7. GRANT PRIVILEGES TO ANON ROLE
-- ==============================================================================
-- Ensure the anon role can select from necessary tables for the Guichet interface
GRANT SELECT ON public.ticket_profiles TO anon;
GRANT SELECT, UPDATE ON public.tickets TO anon;
GRANT SELECT, INSERT ON public.sales_history TO anon;
GRANT SELECT ON public.tenants TO anon;

-- Note: Assurez-vous que la table sales_history permet l'insertion sans seller_id 
-- si le guichet est anonyme, ou modifiez la table pour accepter un seller_id null.
ALTER TABLE public.sales_history ALTER COLUMN seller_id DROP NOT NULL;

-- 6. Insertion d'un code de test (Optionnel)
-- Remplacez l'UUID du tenant par un vrai UUID pour tester
-- INSERT INTO public.sales_access_codes (tenant_id, name, pin_hash)
-- VALUES ('VOTRE_TENANT_ID', 'Guichet 1', crypt('1234', gen_salt('bf')));
