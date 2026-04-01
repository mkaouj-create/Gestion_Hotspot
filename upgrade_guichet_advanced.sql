-- Script pour les fonctionnalités avancées des Guichets (Kiosques)
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Ajouter la date de dernière collecte de caisse pour les guichets
ALTER TABLE public.sales_access_codes 
ADD COLUMN IF NOT EXISTS last_collection_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Ajouter un champ pour lier un guichet à un revendeur spécifique (optionnel)
ALTER TABLE public.sales_access_codes 
ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Ajouter un champ pour restreindre les profils de tickets vendables (optionnel)
ALTER TABLE public.sales_access_codes 
ADD COLUMN IF NOT EXISTS allowed_profiles UUID[] DEFAULT '{}';

-- 4. Mettre à jour la fonction de création pour inclure les nouveaux champs
CREATE OR REPLACE FUNCTION public.create_guichet_code(
    p_tenant_id UUID, 
    p_name TEXT, 
    p_pin TEXT,
    p_reseller_id UUID DEFAULT NULL,
    p_allowed_profiles UUID[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.sales_access_codes (tenant_id, name, pin_hash, reseller_id, allowed_profiles)
    VALUES (p_tenant_id, p_name, crypt(p_pin, gen_salt('bf')), p_reseller_id, p_allowed_profiles)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Créer une fonction pour collecter la caisse d'un guichet
CREATE OR REPLACE FUNCTION public.collect_guichet_cash(p_guichet_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    -- Mettre à jour la date de dernière collecte
    UPDATE public.sales_access_codes
    SET last_collection_at = NOW()
    WHERE id = p_guichet_id;
    
    -- Optionnel : on pourrait insérer une trace dans une table de versements_guichet
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Donner les droits d'exécution
GRANT EXECUTE ON FUNCTION public.collect_guichet_cash(UUID, NUMERIC) TO authenticated;
