-- Mise à jour des politiques RLS pour le Guichet
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Supprimer les anciennes politiques pour les recréer proprement
DROP POLICY IF EXISTS "Guichet can view tickets" ON public.tickets;
DROP POLICY IF EXISTS "Guichet can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Guichet can view ticket profiles" ON public.ticket_profiles;
DROP POLICY IF EXISTS "Guichet can insert sales history" ON public.sales_history;
DROP POLICY IF EXISTS "Guichet can view sales history" ON public.sales_history;

-- 2. Recréer les politiques avec une logique plus souple pour le statut
-- Le guichet doit pouvoir voir les tickets NEUFS (pour les vendre) 
-- ET les tickets ASSIGNES (si le guichet est utilisé par un revendeur)
CREATE POLICY "Guichet can view tickets" ON public.tickets
    FOR SELECT USING (
        tenant_id = public.get_guichet_tenant_id() 
        AND status IN ('NEUF', 'ASSIGNE')
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

-- S'assurer que le rôle anon a bien les droits de base
GRANT SELECT ON public.ticket_profiles TO anon;
GRANT SELECT, UPDATE ON public.tickets TO anon;
GRANT SELECT, INSERT ON public.sales_history TO anon;
GRANT SELECT ON public.tenants TO anon;
