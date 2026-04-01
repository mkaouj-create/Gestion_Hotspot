-- Script pour finaliser les fonctionnalités avancées des Guichets
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Corriger la table des sessions pour lier la session à un guichet spécifique
ALTER TABLE public.guichet_sessions 
ADD COLUMN IF NOT EXISTS guichet_id UUID REFERENCES public.sales_access_codes(id) ON DELETE CASCADE;

-- 2. Mettre à jour la vérification du PIN pour enregistrer le guichet_id dans la session
CREATE OR REPLACE FUNCTION public.verify_guichet_pin(p_tenant_id UUID, p_pin TEXT)
RETURNS UUID AS $$
DECLARE
    v_guichet_id UUID;
    v_token UUID;
BEGIN
    -- Trouver le guichet correspondant au PIN
    SELECT id INTO v_guichet_id
    FROM public.sales_access_codes
    WHERE tenant_id = p_tenant_id
    AND pin_hash = crypt(p_pin, pin_hash)
    LIMIT 1;

    IF v_guichet_id IS NULL THEN
        RAISE EXCEPTION 'Code PIN invalide ou accès refusé.';
    END IF;

    -- Créer la session avec le guichet_id
    INSERT INTO public.guichet_sessions (tenant_id, guichet_id, expires_at)
    VALUES (p_tenant_id, v_guichet_id, NOW() + INTERVAL '12 hours')
    RETURNING token INTO v_token;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Mettre à jour la fonction get_guichet_info pour retourner les profils autorisés
DROP FUNCTION IF EXISTS public.get_guichet_info(UUID);
CREATE OR REPLACE FUNCTION public.get_guichet_info(p_token UUID)
RETURNS TABLE (tenant_id UUID, guichet_id UUID, name TEXT, allowed_profiles UUID[]) AS $$
BEGIN
    RETURN QUERY
    SELECT s.tenant_id, c.id, c.name, c.allowed_profiles
    FROM public.guichet_sessions s
    JOIN public.sales_access_codes c ON c.id = s.guichet_id
    WHERE s.token = p_token AND s.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Créer la table pour l'historique des collectes de caisse
CREATE TABLE IF NOT EXISTS public.guichet_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guichet_id UUID NOT NULL REFERENCES public.sales_access_codes(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    collected_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    collected_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.guichet_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view collections of their tenant" 
ON public.guichet_collections FOR SELECT 
USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert collections of their tenant" 
ON public.guichet_collections FOR INSERT 
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- 5. Mettre à jour la fonction de collecte pour insérer dans l'historique
CREATE OR REPLACE FUNCTION public.collect_guichet_cash(p_guichet_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Récupérer le tenant_id du guichet
    SELECT tenant_id INTO v_tenant_id FROM public.sales_access_codes WHERE id = p_guichet_id;

    -- Mettre à jour la date de dernière collecte
    UPDATE public.sales_access_codes
    SET last_collection_at = NOW()
    WHERE id = p_guichet_id;
    
    -- Insérer l'historique
    INSERT INTO public.guichet_collections (guichet_id, tenant_id, amount, collected_by)
    VALUES (p_guichet_id, v_tenant_id, p_amount, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fonction pour mettre à jour un guichet existant
CREATE OR REPLACE FUNCTION public.update_guichet_code(
    p_guichet_id UUID,
    p_name TEXT,
    p_reseller_id UUID DEFAULT NULL,
    p_allowed_profiles UUID[] DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.sales_access_codes
    SET name = p_name,
        reseller_id = p_reseller_id,
        allowed_profiles = p_allowed_profiles,
        updated_at = NOW()
    WHERE id = p_guichet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
