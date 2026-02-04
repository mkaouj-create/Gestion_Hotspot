
-- INITIALISATION DE LA BASE DE DONNÉES GESTION_HOTSPOT
-- SCRIPT CORRIGÉ : Compatible avec une base de données existante (Idempotent)

-- 1. Tables de base (Utilisation de IF NOT EXISTS)
-- Table des Tenants (Agences)
create table if not exists public.tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
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

-- 2. Sécurité (Row Level Security - RLS)
-- Activez RLS sur toutes les tables (Idempotent par nature)
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.ticket_profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.sales_history enable row level security;
alter table public.zones enable row level security;
alter table public.payments enable row level security;

-- Création des politiques simplifiées
-- On SUPPRIME d'abord les anciennes pour éviter l'erreur "Policy already exists"
drop policy if exists "Enable read access for authenticated users" on public.tenants;
drop policy if exists "Enable read access for authenticated users" on public.users;
drop policy if exists "Enable read access for authenticated users" on public.ticket_profiles;
drop policy if exists "Enable read access for authenticated users" on public.tickets;
drop policy if exists "Enable read access for authenticated users" on public.sales_history;
drop policy if exists "Enable read access for authenticated users" on public.zones;
drop policy if exists "Enable read access for authenticated users" on public.payments;

drop policy if exists "Enable write access for authenticated users" on public.tenants;
drop policy if exists "Enable write access for authenticated users" on public.users;
drop policy if exists "Enable write access for authenticated users" on public.ticket_profiles;
drop policy if exists "Enable write access for authenticated users" on public.tickets;
drop policy if exists "Enable write access for authenticated users" on public.sales_history;
drop policy if exists "Enable write access for authenticated users" on public.zones;
drop policy if exists "Enable write access for authenticated users" on public.payments;

-- Politique: Tout le monde peut lire (authentifié)
create policy "Enable read access for authenticated users" on public.tenants for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.users for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.ticket_profiles for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.tickets for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.sales_history for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.zones for select to authenticated using (true);
create policy "Enable read access for authenticated users" on public.payments for select to authenticated using (true);

-- Politique: Insert/Update/Delete pour les utilisateurs authentifiés
create policy "Enable write access for authenticated users" on public.tenants for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.users for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.ticket_profiles for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.tickets for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.sales_history for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.zones for all to authenticated using (true);
create policy "Enable write access for authenticated users" on public.payments for all to authenticated using (true);


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

  -- 1. Créer le tenant
  insert into public.tenants (name, subscription_status, subscription_end_at)
  values (p_agency_name, sub_status, sub_end_date)
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

  -- Supprimer les données (Cascade s'occupe de la plupart, mais on nettoie users)
  delete from public.users where tenant_id = target_tenant_id;
  delete from public.tenants where id = target_tenant_id;
end;
$$ language plpgsql security definer;

-- Fonction RPC: Supprimer un utilisateur (Utilisée dans Users.tsx)
create or replace function delete_user_fully(target_user_id uuid)
returns void as $$
begin
  delete from public.users where id = target_user_id;
  -- Note: En théorie il faudrait aussi supprimer de auth.users via une Edge Function admin
  -- car Postgres standard ne peut pas écrire dans auth.users directement sans permissions superuser.
end;
$$ language plpgsql security definer;
