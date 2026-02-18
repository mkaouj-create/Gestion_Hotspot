
-- ... (Conserver le reste du fichier)

-- RECRÉATION DE LA VUE COMPTABLE AVEC PLUS DE FLEXIBILITÉ
drop view if exists public.accounting_ledger;

create or replace view public.accounting_ledger as
select 
  s.id as id,
  s.sold_at as entry_date,
  'VENTE' as entry_type,
  s.amount_paid as amount,
  'Vente ticket: ' || coalesce(t.username, 'ID#' || s.ticket_id) as description,
  coalesce(u.full_name, 'Utilisateur supprimé') as party_name,
  'CASH' as method,
  'APPROVED' as status,
  s.tenant_id as tenant_id,
  coalesce(t.username, s.ticket_id::text) as reference,
  s.seller_id as user_id
from public.sales_history s
left join public.tickets t on s.ticket_id = t.id
left join public.users u on s.seller_id = u.id

union all

select 
  p.id as id,
  p.created_at as entry_date,
  'VERSEMENT' as entry_type,
  p.amount as amount,
  'Versement revendeur' as description,
  coalesce(u.full_name, 'Utilisateur supprimé') as party_name,
  p.payment_method as method,
  p.status as status,
  p.tenant_id as tenant_id,
  p.phone_number as reference,
  p.reseller_id as user_id
from public.payments p
left join public.users u on p.reseller_id = u.id;

-- TRÈS IMPORTANT : Autoriser les utilisateurs authentifiés à lire cette vue
grant select on public.accounting_ledger to authenticated;
grant select on public.accounting_ledger to service_role;
