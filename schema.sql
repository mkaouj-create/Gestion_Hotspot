
-- INITIALISATION DE LA BASE DE DONNÉES GESTION_HOTSPOT

-- 1. Tables de base
-- Table des Tenants (Agences)
create table public.tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  subscription_status text default 'EN_ATTENTE', -- EN_ATTENTE, ACTIF, SUSPENDU
  subscription_end_at timestamptz,
  created_at timestamptz default now()
);

-- Table des Utilisateurs (Extension de auth.users)
create table public.users (
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
create table public.ticket_profiles (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text not null,
  price numeric not null,
  created_at timestamptz default now()
);

-- Table des Tickets
create table public.tickets (
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
create table public.sales_history (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) not null,
  seller_id uuid references public.users(id),
  ticket_id uuid references public.tickets(id),
  amount_paid numeric not null,
  sold_at timestamptz default now(),
  metadata jsonb
);

-- Table Zones WiFi
create table public.zones (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text not null,
  location text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Table Paiements (Rechargement Revendeurs)
create table public.payments (
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
-- Activez RLS sur toutes les tables
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.ticket_profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.sales_history enable row level security;
alter table public.zones enable row level security;
alter table public.payments enable row level security;

-- Création des politiques simplifiées (Pour le démarrage)
-- Note: En production, il faudrait affiner ces politiques pour isoler strictement les tenants.

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

-- Trigger pour l'inscription
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Fonction RPC: Créer une nouvelle agence (Utilisée dans CompleteSetup.tsx)
create or replace function create_new_agency(p_agency_name text)
returns void as $$
declare
  new_tenant_id uuid;
begin
  -- 1. Créer le tenant
  insert into public.tenants (name, subscription_status)
  values (p_agency_name, 'EN_ATTENTE')
  returning id into new_tenant_id;

  -- 2. Mettre à jour l'utilisateur courant pour qu'il soit le gestionnaire
  update public.users
  set tenant_id = new_tenant_id,
      role = 'GESTIONNAIRE_WIFI_ZONE'
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

-- CRÉATION DE L'ADMINISTRATEUR GLOBAL (Optionnel pour le démarrage)
-- Remplacez 'VOTRE_EMAIL_ADMIN' par l'email que vous utiliserez pour vous connecter la première fois
-- Vous devrez modifier manuellement le rôle en 'ADMIN_GLOBAL' dans la table public.users après votre première connexion
-- si vous ne le faites pas via ce script.

