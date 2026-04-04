-- Mise à jour de la fonction get_guichet_info pour inclure le reseller_id
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

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION public.get_guichet_info(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_guichet_info(UUID) TO authenticated;
