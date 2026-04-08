create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reseller_id uuid references public.users(id) on delete cascade,
  guichet_id uuid references public.sales_access_codes(id) on delete cascade,
  sender_type text not null check (sender_type in ('ADMIN', 'RESELLER')),
  content text not null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.messages enable row level security;

-- Policies for authenticated users
create policy "Users can view their tenant messages"
  on public.messages for select
  using (
    tenant_id = (select tenant_id from public.users where id = auth.uid())
    and (
      (select role from public.users where id = auth.uid()) in ('ADMIN_GLOBAL', 'GESTIONNAIRE_WIFI_ZONE')
      or
      reseller_id = auth.uid()
    )
  );

create policy "Users can insert messages"
  on public.messages for insert
  with check (
    tenant_id = (select tenant_id from public.users where id = auth.uid())
  );

create policy "Users can update their tenant messages"
  on public.messages for update
  using (
    tenant_id = (select tenant_id from public.users where id = auth.uid())
  );

-- RPC for Guichet Token Access (since Guichet uses token, not auth.uid() directly)
create or replace function get_guichet_messages(p_token uuid)
returns table (
  id uuid,
  sender_type text,
  content text,
  is_read boolean,
  created_at timestamp with time zone
)
language plpgsql
security definer
as $$
declare
  v_guichet_id uuid;
  v_tenant_id uuid;
begin
  select g.id, g.tenant_id into v_guichet_id, v_tenant_id
  from public.sales_access_codes g
  where g.access_token = p_token and g.status = 'ACTIVE';

  if v_guichet_id is null then
    raise exception 'Invalid or inactive token';
  end if;

  return query
  select m.id, m.sender_type, m.content, m.is_read, m.created_at
  from public.messages m
  where m.guichet_id = v_guichet_id
  order by m.created_at asc;
end;
$$;

create or replace function send_guichet_message(p_token uuid, p_content text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_guichet_id uuid;
  v_tenant_id uuid;
  v_reseller_id uuid;
  v_message_id uuid;
begin
  select g.id, g.tenant_id, g.assigned_to into v_guichet_id, v_tenant_id, v_reseller_id
  from public.sales_access_codes g
  where g.access_token = p_token and g.status = 'ACTIVE';

  if v_guichet_id is null then
    raise exception 'Invalid or inactive token';
  end if;

  insert into public.messages (tenant_id, reseller_id, guichet_id, sender_type, content)
  values (v_tenant_id, v_reseller_id, v_guichet_id, 'RESELLER', p_content)
  returning messages.id into v_message_id;

  return v_message_id;
end;
$$;

create or replace function mark_guichet_messages_read(p_token uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_guichet_id uuid;
begin
  select g.id into v_guichet_id
  from public.sales_access_codes g
  where g.access_token = p_token and g.status = 'ACTIVE';

  if v_guichet_id is null then
    raise exception 'Invalid or inactive token';
  end if;

  update public.messages
  set is_read = true
  where guichet_id = v_guichet_id and sender_type = 'ADMIN' and is_read = false;
end;
$$;
