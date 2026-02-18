
-- ... (Contenu existant du fichier schema.sql conservé)

-- AJOUT DU MODULE FINANCIER (JOURNAL COMPTABLE)

-- 1. Vue unifiée pour le journal comptable
-- Cette vue combine les ventes et les versements pour une analyse chronologique
create or replace view public.accounting_ledger as
select 
  s.id as id,
  s.sold_at as entry_date,
  'VENTE' as entry_type,
  s.amount_paid as amount,
  'Vente ticket: ' || t.username as description,
  u.full_name as party_name,
  'CASH' as method,
  'APPROVED' as status,
  s.tenant_id as tenant_id,
  t.username as reference,
  s.seller_id as user_id
from public.sales_history s
join public.tickets t on s.ticket_id = t.id
join public.users u on s.seller_id = u.id

union all

select 
  p.id as id,
  p.created_at as entry_date,
  'VERSEMENT' as entry_type,
  p.amount as amount,
  'Versement revendeur' as description,
  u.full_name as party_name,
  p.payment_method as method,
  p.status as status,
  p.tenant_id as tenant_id,
  p.phone_number as reference,
  p.reseller_id as user_id
from public.payments p
join public.users u on p.reseller_id = u.id;

-- 2. Fonction pour recalculer le solde d'un utilisateur (Audit)
create or replace function public.get_user_calculated_balance(target_user_id uuid)
returns numeric as $$
declare
  total_credits numeric;
  total_debits numeric;
begin
  -- Somme des versements approuvés (Augmente le solde)
  select coalesce(sum(amount), 0) into total_credits 
  from public.payments 
  where reseller_id = target_user_id and status = 'APPROVED';

  -- Somme des ventes effectuées (Diminue le solde car achat de stock)
  select coalesce(sum(amount_paid), 0) into total_debits 
  from public.sales_history 
  where seller_id = target_user_id;

  return total_credits - total_debits;
end;
$$ language plpgsql security definer;

-- 3. Mise à jour de create_new_agency pour inclure les paramètres par défaut
-- (Déjà présent dans le script précédent mais on s'assure de l'idempotence)
