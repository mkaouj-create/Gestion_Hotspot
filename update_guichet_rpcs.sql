-- Mise à jour des fonctions RPC pour supporter les profils autorisés
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Mise à jour de create_guichet_code
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
    INSERT INTO public.sales_access_codes (
        tenant_id, 
        name, 
        pin_hash, 
        reseller_id, 
        allowed_profiles
    )
    VALUES (
        p_tenant_id, 
        p_name, 
        crypt(p_pin, gen_salt('bf')), 
        p_reseller_id, 
        p_allowed_profiles
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Mise à jour de update_guichet_code (déjà fait dans guichet_features_final.sql mais on s'assure)
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

-- 3. S'assurer que les permissions sont là
GRANT EXECUTE ON FUNCTION public.create_guichet_code(UUID, TEXT, TEXT, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_guichet_code(UUID, TEXT, UUID, UUID[]) TO authenticated;
