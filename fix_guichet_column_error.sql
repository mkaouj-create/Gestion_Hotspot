-- Script de correction pour l'erreur "column s.guichet_id does not exist"
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. S'assurer que la colonne guichet_id existe dans guichet_sessions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'guichet_sessions' 
        AND column_name = 'guichet_id'
    ) THEN
        ALTER TABLE public.guichet_sessions 
        ADD COLUMN guichet_id UUID REFERENCES public.sales_access_codes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Recréer la fonction de vérification du PIN pour garantir l'enregistrement du guichet_id
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

-- 3. Recréer la fonction get_guichet_info avec les bonnes colonnes et l'inclusion du reseller_id
DROP FUNCTION IF EXISTS public.get_guichet_info(UUID);

CREATE OR REPLACE FUNCTION public.get_guichet_info(p_token UUID)
RETURNS TABLE (
    tenant_id UUID, 
    guichet_id UUID, 
    name TEXT, 
    allowed_profiles UUID[], 
    reseller_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.tenant_id, 
        c.id, 
        c.name, 
        c.allowed_profiles, 
        c.reseller_id
    FROM public.guichet_sessions s
    JOIN public.sales_access_codes c ON c.id = s.guichet_id
    WHERE s.token = p_token AND s.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Accorder les permissions nécessaires
GRANT EXECUTE ON FUNCTION public.get_guichet_info(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_guichet_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_guichet_pin(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_guichet_pin(UUID, TEXT) TO authenticated;
