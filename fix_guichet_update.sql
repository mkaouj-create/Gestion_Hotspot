-- Correction des politiques RLS pour le Guichet Vente
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Supprimer l'ancienne politique de mise à jour des tickets
DROP POLICY IF EXISTS "Guichet can update tickets" ON public.tickets;

-- 2. Créer une nouvelle politique de mise à jour plus permissive pour le guichet
-- Le guichet doit pouvoir mettre à jour un ticket s'il appartient au bon tenant
-- ET il faut s'assurer que la clause USING (condition avant update) 
-- ET la clause WITH CHECK (condition après update) sont correctes.
CREATE POLICY "Guichet can update tickets" ON public.tickets
    FOR UPDATE 
    USING (tenant_id = public.get_guichet_tenant_id())
    WITH CHECK (tenant_id = public.get_guichet_tenant_id());

-- 3. Vérifier la politique d'insertion dans l'historique des ventes
DROP POLICY IF EXISTS "Guichet can insert sales history" ON public.sales_history;

CREATE POLICY "Guichet can insert sales history" ON public.sales_history
    FOR INSERT 
    WITH CHECK (tenant_id = public.get_guichet_tenant_id());

-- 4. S'assurer que le rôle anon a les droits nécessaires sur les séquences si applicable
-- (Généralement géré par les UUIDs, mais au cas où)
GRANT USAGE ON SCHEMA public TO anon;
