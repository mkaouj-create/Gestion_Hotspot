
-- INITIALISATION DE LA BASE DE DONNÉES GESTION_HOTSPOT
-- SCRIPT CORRIGÉ : Compatible avec une base de données existante (Idempotent)

-- 1. Tables de base (Utilisation de IF NOT EXISTS)
-- Table des Tenants (Agences)
create table if not exists public.tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  currency text default 'GNF', -- Ajout de la devise par défaut
  whatsapp_header text default 'Bienvenue sur notre réseau WiFi', -- En-tête reçu
  contact_support text, -- Contact support affiché
  subscription_status text default 'EN_ATTENTE', -- EN_ATTENTE, ACTIF, SUSPENDU
  subscription_end_at timestamptz,
  created_at timestamptz default now()
);

-- Table des Utilisateurs (Extension de auth.users)
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  role text default 'CLIENT', -- ADMIN_GLOBAL, GESTIONNAIRE_WIFI_ZONE, ADMIN, REVENDEUR, AGENT, CLIENT
  tenant_id uuid references public.tenants(id),
  balance numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Table des Profils de Tickets (Forfaits)
create table if not exists public.ticket_profiles (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text not null,
  price numeric not null,
  created_at timestamptz default now()
);

-- Table des Tickets
create table if not exists public.tickets (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  profile_id uuid references public.ticket_profiles(id) not null,
  username text not null,
  password text,
  status text default 'NEUF', -- NEUF, VENDU, UTILISE, EXPIRE, ASSIGNE
  imported_at timestamptz default now(),
  sold_at timestamptz,
  sold_by uuid references public.users(id),
  assigned_to uuid references public.users(id)
);

-- Table Historique des Ventes
create table if not exists public.sales_history (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) not null,
  seller_id uuid references public.users(id),
  ticket_id uuid references public.tickets(id),
  amount_paid numeric not null,
  sold_at timestamptz default now(),
  metadata jsonb
);

-- Table Zones WiFi
create table if not exists public.zones (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text not null,
  location text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Table Paiements (Rechargement Revendeurs)
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) not null,
  reseller_id uuid references public.users(id),
  amount numeric not null,
  payment_method text, -- CASH, MOMO, OM
  phone_number text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- NOUVELLE TABLE : Configuration Globale SaaS
create table if not exists public.saas_settings (
  id uuid default gen_random_uuid() primary key,
  monthly_subscription_price numeric default 150000, -- Prix par défaut en GNF
  trial_period_days integer default 30,
  support_phone_number text default '224625976411',
  currency text default 'GNF',
  is_maintenance_mode boolean default false,
  updated_at timestamptz default now()
);

-- Initialisation de la config SaaS si vide
insert into public.saas_settings (monthly_subscription_price)
select 150000
where not exists (select 1 from public.saas_settings);


-- 2. Sécurité (Row Level Security - RLS)
-- Activez RLS sur toutes les tables (Idempotent par nature)
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.ticket_profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.sales_history enable row level security;
alter table public.zones enable row level security;
alter table public.payments enable row level security;
alter table public.saas_settings enable row level security;

-- Création des politiques simplifiées
-- On SUPPRIME d'abord les anciennes pour éviter l'erreur "Policy already exists"
drop policy if exists "Enable read access for authenticated users" on public.tenants;
drop policy if exists "Enable read access for authenticated users" on public.users;
drop policy if exists "Enable read access for authenticated users" on public.ticket_profiles;
drop policy if exists "Enable read access for authenticated users" on public.tickets;
drop policy if exists "Enable read access for authenticated users" on public.sales_history;
drop policy if exists "Enable read access for authenticated users" on public.zones;
drop policy if exists "Enable read access for authenticated users" on public.payments;
drop policy if exists "Enable read access for authenticated users" on public.saas_settings;

drop policy if exists "Enable write access for authenticated users" on public.tenants;
drop policy if exists "Enable write access for authenticated users" on public.users;
drop policy if exists "Enable write access for authenticated users" on public.ticket_profiles;
drop policy if exists "Enable write access for authenticated users" on public.tickets;
drop policy if exists "Enable write access for authenticated users" on public.sales_history;
drop policy if exists "Enable write access for authenticated users" on public.zones;
drop policy if exists "Enable write access for authenticated users" on public.payments;
drop policy if exists "Enable write access for authenticated users" on public.saas_settings;


-- Politique: Tout le monde peut lire (authentifié)
create policy "Enable read access for authenticated users" on public.tenants for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.users for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.ticket_profiles for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.tickets for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.sales_history for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.zones for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.payments for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.saas_settings for select to authenticated using (true);

-- Politique: Insert/Update/Delete pour les utilisateurs authentifiés
create policy "Enable write access for authenticated users" on public.tenants for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.users for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.ticket_profiles for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.tickets for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.sales_history for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.zones for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.payments for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.saas_settings for all to authenticated using (true);


-- 3. Fonctions et Triggers
-- Fonction pour créer automatiquement un user public lors de l'inscription Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, role, tenant_id)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'CLIENT'),
    (new.raw_user_meta_data->>'tenant_id')::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger pour l'inscription (Suppression avant recréation pour éviter erreur)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Fonction RPC: Créer une nouvelle agence (Utilisée dans CompleteSetup.tsx)
-- MISE A JOUR: Retour à la logique de validation manuelle par l'ADMIN_GLOBAL
create or replace function create_new_agency(p_agency_name text)
returns void as $$
declare
  new_tenant_id uuid;
  is_first_agency boolean;
  user_role text;
  sub_status text;
  sub_end_date timestamptz;
begin
  -- Vérifier s'il existe déjà des agences dans la table tenants
  select not exists(select 1 from public.tenants) into is_first_agency;

  if is_first_agency then
    -- Le tout premier utilisateur est ADMIN_GLOBAL (pas d'expiration)
    user_role := 'ADMIN_GLOBAL';
    sub_status := 'ACTIF';
    sub_end_date := null; 
  else
    -- Les suivants sont des gestionnaires et doivent être validés par l'ADMIN_GLOBAL
    user_role := 'GESTIONNAIRE_WIFI_ZONE';
    sub_status := 'EN_ATTENTE'; -- Statut par défaut
    sub_end_date := null; -- Sera défini lors de l'activation
  end if;

  -- 1. Créer le tenant (Currency par défaut GNF)
  insert into public.tenants (name, subscription_status, subscription_end_at, currency, whatsapp_header)
  values (p_agency_name, sub_status, sub_end_date, 'GNF', 'Bienvenue sur notre réseau WiFi')
  returning id into new_tenant_id;

  -- 2. Mettre à jour l'utilisateur courant
  update public.users
  set tenant_id = new_tenant_id,
      role = user_role
  where id = auth.uid();
end;
$$ language plpgsql security definer;

-- Fonction RPC: Supprimer complètement un tenant (Utilisée dans Agencies.tsx)
create or replace function delete_tenant_fully(target_tenant_id uuid)
returns void as $$
begin
  -- Vérifier que l'utilisateur est ADMIN_GLOBAL (sécurité basique)
  if not exists (select 1 from public.users where id = auth.uid() and role = 'ADMIN_GLOBAL') then
    raise exception 'Accès refusé';
  end if;

  -- 1. Supprimer l'historique des ventes (Dépend de Tickets et Users)
  delete from public.sales_history where tenant_id = target_tenant_id;

  -- 2. Supprimer les paiements (Dépend de Users)
  delete from public.payments where tenant_id = target_tenant_id;

  -- 3. Supprimer les tickets (stock et vendus) (Dépend de Ticket Profiles et Users)
  delete from public.tickets where tenant_id = target_tenant_id;

  -- 4. Supprimer les profils de tickets (Dépend de Tenant)
  delete from public.ticket_profiles where tenant_id = target_tenant_id;

  -- 5. Supprimer les zones (Dépend de Tenant)
  delete from public.zones where tenant_id = target_tenant_id;

  -- 6. Supprimer TOUS les utilisateurs associés (depuis auth.users)
  -- Cela déclenchera la suppression en cascade dans public.users
  delete from auth.users 
  where id in (select id from public.users where tenant_id = target_tenant_id);

  -- 7. Supprimer l'agence elle-même
  delete from public.tenants where id = target_tenant_id;
end;
$$ language plpgsql security definer;

-- Fonction RPC: Supprimer un utilisateur et toutes ses données (Utilisée dans Users.tsx)
create or replace function delete_user_fully(target_user_id uuid)
returns void as $$
begin
  -- 0. Détacher les paiements créés par cet utilisateur (pour ne pas bloquer la suppression si c'est un admin)
  update public.payments set created_by = null where created_by = target_user_id;

  -- 1. Nettoyer l'historique des paiements reçus par ce revendeur
  delete from public.payments where reseller_id = target_user_id;

  -- 2. Nettoyer l'historique des ventes effectuées par ce revendeur
  delete from public.sales_history where seller_id = target_user_id;

  -- 3. Désassigner les tickets stock (remettre en NEUF)
  update public.tickets 
  set assigned_to = null, status = 'NEUF' 
  where assigned_to = target_user_id and status = 'ASSIGNÉ';

  -- 4. Anonymiser les tickets vendus (retirer la référence vendeur)
  update public.tickets 
  set sold_by = null 
  where sold_by = target_user_id;

  -- 5. IMPORTANT : Supprimer l'utilisateur de la table d'authentification 
  -- Cela déclenchera automatiquement la suppression de public.users via le 'ON DELETE CASCADE'
  delete from auth.users where id = target_user_id;
end;
$$ language plpgsql security definer;

-- MISE A JOUR MANUELLE: Ajoutez cette ligne si la colonne n'existe pas
-- ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS currency text DEFAULT 'GNF';
-- ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS whatsapp_header text DEFAULT 'Bienvenue sur notre réseau WiFi';
-- ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS contact_support text;
