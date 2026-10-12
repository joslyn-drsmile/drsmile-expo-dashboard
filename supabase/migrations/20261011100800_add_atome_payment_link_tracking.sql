create table public.expo_atome_payment_links (
  payment_id text primary key,
  payment_link text not null default '',
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  currency text not null default 'MYR' check (currency = 'MYR'),
  order_id text not null default '',
  outlet_name text not null default 'DRSMILE WHITENING',
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'DISABLED')),
  transaction_id text not null default '',
  expiry_time_formatted text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_by_email text not null default '',
  created_at timestamp with time zone not null default now(),
  status_updated_at timestamp with time zone not null default now()
);

comment on table public.expo_atome_payment_links is
  'Only Atome payment links created from the Expo Dashboard. Atome remains the source of truth for payment status.';
comment on column public.expo_atome_payment_links.payment_link is
  'Customer-facing Atome URL; restricted to approved dashboard users by RLS.';

create index expo_atome_payment_links_status_idx
  on public.expo_atome_payment_links (status, created_at desc);

alter table public.expo_atome_payment_links enable row level security;

revoke all on table public.expo_atome_payment_links from anon;
grant select, insert, update on table public.expo_atome_payment_links to authenticated;

create policy expo_atome_payment_links_team_select
  on public.expo_atome_payment_links
  for select
  to authenticated
  using (public.expo_has_access());

create policy expo_atome_payment_links_team_insert
  on public.expo_atome_payment_links
  for insert
  to authenticated
  with check (
    public.expo_has_access()
    and created_by = (select auth.uid())
  );

create policy expo_atome_payment_links_team_update
  on public.expo_atome_payment_links
  for update
  to authenticated
  using (public.expo_has_access())
  with check (public.expo_has_access());

insert into public.expo_atome_payment_links (
  payment_id,
  amount,
  order_id,
  created_by,
  created_by_name,
  created_by_email,
  created_at
)
select
  record_id,
  coalesce(nullif(substring(summary from '([0-9]+[.][0-9]+) MYR'), '')::numeric, 0),
  coalesce(substring(summary from 'Order ID (.+)$'), ''),
  actor_id,
  coalesce(actor_name, ''),
  coalesce(actor_email, ''),
  created_at
from public.expo_audit_logs
where entity = 'atome_payment_link'
  and action = 'create'
  and record_id <> ''
  and actor_id is not null
on conflict (payment_id) do nothing;
