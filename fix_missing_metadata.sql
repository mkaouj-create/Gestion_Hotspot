-- Script pour ajouter les colonnes manquantes nécessaires à la vente par guichet
DO $$ 
BEGIN 
    -- 1. Ajout de metadata à la table tickets (JSONB pour stocker les infos de vente du guichet)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tickets' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.tickets ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- 2. S'assurer que sold_at existe sur tickets
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tickets' 
        AND column_name = 'sold_at'
    ) THEN
        ALTER TABLE public.tickets ADD COLUMN sold_at TIMESTAMPTZ;
    END IF;

    -- 3. S'assurer que sold_by existe sur tickets
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tickets' 
        AND column_name = 'sold_by'
    ) THEN
        ALTER TABLE public.tickets ADD COLUMN sold_by UUID REFERENCES public.users(id);
    END IF;

    -- 4. S'assurer que metadata existe sur sales_history
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'sales_history' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.sales_history ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- S'assurer que les permissions sont correctes pour le guichet (anon)
-- Le guichet doit pouvoir mettre à jour le statut et les metadata du ticket lors de la vente
GRANT SELECT, UPDATE ON public.tickets TO anon;
GRANT SELECT, UPDATE ON public.tickets TO authenticated;
GRANT SELECT, UPDATE ON public.tickets TO service_role;

GRANT INSERT, SELECT ON public.sales_history TO anon;
GRANT INSERT, SELECT ON public.sales_history TO authenticated;
GRANT INSERT, SELECT ON public.sales_history TO service_role;

-- Notification pour confirmer que le script a tourné
COMMENT ON COLUMN public.tickets.metadata IS 'Metadata for ticket sales (source, guichet_id, etc.)';
