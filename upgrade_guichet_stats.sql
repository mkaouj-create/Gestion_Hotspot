-- Script de mise à jour pour les statistiques détaillées des guichets
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Ajouter la colonne guichet_id à guichet_sessions
ALTER TABLE public.guichet_sessions 
ADD COLUMN IF NOT EXISTS guichet_id UUID REFERENCES public.sales_access_codes(id) ON DELETE CASCADE;

-- 2. Mettre à jour la fonction de vérification du PIN pour stocker le guichet_id
CREATE OR REPLACE FUNCTION public.verify_guichet_pin(p_tenant_id UUID, p_pin TEXT)
RETURNS UUID AS $$
DECLARE
    v_guichet_id UUID;
    v_token UUID;
BEGIN
    -- Récupérer l'ID du guichet correspondant au PIN
    SELECT id INTO v_guichet_id
    FROM public.sales_access_codes
    WHERE tenant_id = p_tenant_id
    AND pin_hash = crypt(p_pin, pin_hash)
    LIMIT 1;

    -- Si aucun guichet ne correspond, lever une erreur
    IF v_guichet_id IS NULL THEN
        RAISE EXCEPTION 'Code PIN invalide ou accès refusé.';
    END IF;

    -- Créer une session valide pour 12 heures avec le guichet_id
    INSERT INTO public.guichet_sessions (tenant_id, guichet_id, expires_at)
    VALUES (p_tenant_id, v_guichet_id, NOW() + INTERVAL '12 hours')
    RETURNING token INTO v_token;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Créer une fonction pour récupérer les infos du guichet à partir du token
CREATE OR REPLACE FUNCTION public.get_guichet_info(p_token UUID)
RETURNS TABLE(tenant_id UUID, guichet_id UUID, name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT gs.tenant_id, gs.guichet_id, sac.name
    FROM public.guichet_sessions gs
    LEFT JOIN public.sales_access_codes sac ON gs.guichet_id = sac.id
    WHERE gs.token = p_token AND gs.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Donner les droits d'exécution au rôle anon
GRANT EXECUTE ON FUNCTION public.get_guichet_info(UUID) TO anon;
