create table if not exists public.expo_packages (
  id text primary key,
  expo_id text not null references public.expo_expos(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  price numeric(10, 2) not null check (price >= 0),
  currency text not null default 'MYR' check (currency = 'MYR'),
  description text not null default '',
  voucher_amount numeric(10, 2),
  voucher_quantity smallint,
  voucher_note text not null default '',
  image_path text not null check (btrim(image_path) <> ''),
  sort_order integer not null default 0,
  active boolean not null default true,
  copied_from_package_id text references public.expo_packages(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expo_packages_voucher_complete check (
    (voucher_amount is null and voucher_quantity is null)
    or (voucher_amount > 0 and voucher_quantity > 0)
  )
);

create index if not exists expo_packages_expo_active_order_idx
  on public.expo_packages (expo_id, active, sort_order);

create index if not exists expo_packages_copied_from_idx
  on public.expo_packages (copied_from_package_id)
  where copied_from_package_id is not null;

create or replace function public.set_expo_package_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists expo_packages_set_updated_at on public.expo_packages;
create trigger expo_packages_set_updated_at
before update on public.expo_packages
for each row execute function public.set_expo_package_updated_at();

alter table public.expo_packages enable row level security;
revoke all on table public.expo_packages from anon;
grant select, insert, update on table public.expo_packages to authenticated;

drop policy if exists "Approved users can read expo packages" on public.expo_packages;
create policy "Approved users can read expo packages"
on public.expo_packages for select to authenticated
using (public.expo_has_access());

drop policy if exists "Approved users can create expo packages" on public.expo_packages;
create policy "Approved users can create expo packages"
on public.expo_packages for insert to authenticated
with check (public.expo_has_access());

drop policy if exists "Approved users can update expo packages" on public.expo_packages;
create policy "Approved users can update expo packages"
on public.expo_packages for update to authenticated
using (public.expo_has_access())
with check (public.expo_has_access());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expo-package-images',
  'expo-package-images',
  false,
  10485760,
  array['image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Approved users can read package images" on storage.objects;
create policy "Approved users can read package images"
on storage.objects for select to authenticated
using (bucket_id = 'expo-package-images' and public.expo_has_access());

drop policy if exists "Approved users can upload package images" on storage.objects;
create policy "Approved users can upload package images"
on storage.objects for insert to authenticated
with check (bucket_id = 'expo-package-images' and public.expo_has_access());

drop policy if exists "Approved users can update package images" on storage.objects;
create policy "Approved users can update package images"
on storage.objects for update to authenticated
using (bucket_id = 'expo-package-images' and public.expo_has_access())
with check (bucket_id = 'expo-package-images' and public.expo_has_access());

drop policy if exists "Approved users can clean package images" on storage.objects;
create policy "Approved users can clean package images"
on storage.objects for delete to authenticated
using (bucket_id = 'expo-package-images' and public.expo_has_access());
