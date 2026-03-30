-- Fonction robuste pour supprimer un utilisateur et nettoyer toutes ses dépendances
-- À exécuter dans l'éditeur SQL de Supabase

CREATE OR REPLACE FUNCTION public.delete_user_fully(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Permet de contourner les RLS pour le nettoyage
AS $$
DECLARE
    v_caller_role text;
    v_caller_tenant_id uuid;
    v_target_tenant_id uuid;
    v_target_role text;
BEGIN
    -- 1. Récupérer les infos de l'utilisateur qui fait la requête
    SELECT role, tenant_id INTO v_caller_role, v_caller_tenant_id
    FROM public.users
    WHERE id = auth.uid();

    -- 2. Récupérer les infos de l'utilisateur à supprimer
    SELECT role, tenant_id INTO v_target_role, v_target_tenant_id
    FROM public.users
    WHERE id = target_user_id;

    -- Si l'utilisateur cible n'existe pas dans public.users, on arrête (déjà supprimé ?)
    IF v_target_role IS NULL THEN
        RETURN;
    END IF;

    -- 3. Vérification des permissions
    IF v_caller_role = 'ADMIN_GLOBAL' THEN
        -- L'Admin global peut supprimer n'importe qui
        NULL;
    ELSIF v_caller_role = 'GESTIONNAIRE_WIFI_ZONE' THEN
        -- Le gestionnaire ne peut supprimer que dans son agence
        IF v_caller_tenant_id != v_target_tenant_id THEN
            RAISE EXCEPTION 'Non autorisé: Utilisateur n''appartient pas à votre agence.';
        END IF;
        -- Le gestionnaire ne peut pas supprimer un autre gestionnaire ou admin
        IF v_target_role IN ('ADMIN_GLOBAL', 'GESTIONNAIRE_WIFI_ZONE', 'ASSOCIE') THEN
            RAISE EXCEPTION 'Non autorisé: Impossible de supprimer un administrateur.';
        END IF;
    ELSE
        RAISE EXCEPTION 'Non autorisé: Droits insuffisants.';
    END IF;

    -- 4. Nettoyage des clés étrangères (Foreign Keys)
    
    -- A. Désassigner les tickets assignés à cet utilisateur
    UPDATE public.tickets
    SET assigned_to = NULL, status = 'NEUF'
    WHERE assigned_to = target_user_id AND status = 'ASSIGNE';

    -- B. Rendre anonyme le vendeur sur les tickets vendus
    UPDATE public.tickets
    SET sold_by = NULL
    WHERE sold_by = target_user_id;

    -- C. Supprimer l'historique des ventes de cet utilisateur
    DELETE FROM public.sales_history
    WHERE seller_id = target_user_id;

    -- D. Supprimer les paiements liés (en tant que revendeur ou créateur)
    DELETE FROM public.payments
    WHERE reseller_id = target_user_id OR created_by = target_user_id;

    -- 5. Supprimer l'utilisateur de la table public.users
    DELETE FROM public.users
    WHERE id = target_user_id;

    -- Note : La suppression dans auth.users nécessite l'API Admin Supabase.
    -- L'utilisateur est maintenant un "fantôme" (il existe dans auth.users mais n'a plus de profil public.users).
    -- S'il essaie de se reconnecter, il n'aura accès à rien car les RLS bloqueront tout.
END;
$$;

-- S'assurer que les utilisateurs authentifiés peuvent appeler cette fonction
GRANT EXECUTE ON FUNCTION public.delete_user_fully(uuid) TO authenticated;
