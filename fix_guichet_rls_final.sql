-- Correction des politiques RLS pour le Guichet Vente (Mode Kiosque)
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Supprimer l'ancienne politique de mise à jour des tickets
DROP POLICY IF EXISTS "Guichet can update tickets" ON public.tickets;

-- 2. Créer une nouvelle politique de mise à jour pour le guichet
-- Le guichet doit pouvoir mettre à jour un ticket s'il appartient au bon tenant
-- La clause USING vérifie la condition avant la mise à jour
-- La clause WITH CHECK vérifie la condition après la mise à jour
CREATE POLICY "Guichet can update tickets" ON public.tickets
    FOR UPDATE 
    USING (tenant_id = public.get_guichet_tenant_id())
    WITH CHECK (tenant_id = public.get_guichet_tenant_id());

-- 3. Vérifier la politique d'insertion dans l'historique des ventes
DROP POLICY IF EXISTS "Guichet can insert sales history" ON public.sales_history;

-- Le guichet doit pouvoir insérer dans l'historique des ventes
-- On s'assure que le tenant_id correspond à celui du guichet
CREATE POLICY "Guichet can insert sales history" ON public.sales_history
    FOR INSERT 
    WITH CHECK (tenant_id = public.get_guichet_tenant_id());

-- 4. S'assurer que le rôle anon a les droits nécessaires
-- Le guichet utilise le rôle anon avec un token personnalisé
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, UPDATE ON public.tickets TO anon;
GRANT SELECT, INSERT ON public.sales_history TO anon;
GRANT SELECT ON public.ticket_profiles TO anon;
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT ON public.guichet_sessions TO anon;
GRANT SELECT ON public.sales_access_codes TO anon;
