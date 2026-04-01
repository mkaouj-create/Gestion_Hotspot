-- Script pour corriger le conflit de fonctions create_guichet_code
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Supprimer toutes les versions existantes de la fonction
DROP FUNCTION IF EXISTS public.create_guichet_code(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_guichet_code(UUID, TEXT, TEXT, UUID, UUID[]);

-- 2. Recréer la fonction avec la signature complète
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
