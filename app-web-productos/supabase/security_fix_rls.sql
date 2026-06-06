-- =========================================================
-- AHORRAPE - RLS SECURITY FIX
-- Run this file in Supabase SQL Editor.
-- =========================================================

-- 1) Audit public tables with RLS disabled.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  pg_get_userbyid(c.relowner) as table_owner,
  (
    c.relname = 'spatial_ref_sys'
    or exists (
      select 1
      from pg_depend d
      join pg_extension e on e.oid = d.refobjid
      where d.classid = 'pg_class'::regclass
        and d.objid = c.oid
        and d.deptype = 'e'
    )
  ) as is_extension_or_reference_table
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by c.relname;

-- 2) Enable RLS on all application tables.
alter table if exists public.profiles enable row level security;
alter table if exists public.businesses enable row level security;
alter table if exists public.stores enable row level security;
alter table if exists public.categories enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.store_products enable row level security;
alter table if exists public.reservations enable row level security;
alter table if exists public.reservation_items enable row level security;

-- PostGIS can create public.spatial_ref_sys in public. It is reference data
-- and often belongs to an extension/admin role, so only touch it when the
-- current SQL user is the table owner.
do $$
declare
  spatial_owner text;
begin
  select pg_get_userbyid(c.relowner)
  into spatial_owner
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'spatial_ref_sys'
    and c.relkind = 'r';

  if spatial_owner is null then
    raise notice 'public.spatial_ref_sys does not exist; skipping.';
  elsif spatial_owner = current_user then
    execute 'alter table public.spatial_ref_sys enable row level security';
    execute 'drop policy if exists "spatial_ref_sys_public_select" on public.spatial_ref_sys';
    execute 'create policy "spatial_ref_sys_public_select" on public.spatial_ref_sys for select using (true)';
  else
    raise notice 'Skipping public.spatial_ref_sys because current_user "%" is not table owner "%". This PostGIS reference table is not app data.',
      current_user,
      spatial_owner;
  end if;
end $$;

-- =========================================================
-- PROFILES
-- =========================================================

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- =========================================================
-- BUSINESSES
-- =========================================================

drop policy if exists "businesses_select_owner" on public.businesses;
create policy "businesses_select_owner"
on public.businesses
for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "businesses_insert_owner" on public.businesses;
create policy "businesses_insert_owner"
on public.businesses
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "businesses_update_owner" on public.businesses;
create policy "businesses_update_owner"
on public.businesses
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "businesses_delete_owner" on public.businesses;
create policy "businesses_delete_owner"
on public.businesses
for delete
to authenticated
using (owner_user_id = auth.uid());

-- =========================================================
-- STORES
-- =========================================================

drop policy if exists "stores_select_policy" on public.stores;
create policy "stores_select_policy"
on public.stores
for select
using (
  (stores.is_active = true and stores.status = 'active')
  or exists (
    select 1
    from public.businesses b
    where b.id = stores.business_id
      and b.owner_user_id = auth.uid()
  )
);

drop policy if exists "stores_insert_owner" on public.stores;
create policy "stores_insert_owner"
on public.stores
for insert
to authenticated
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_user_id = auth.uid()
  )
);

drop policy if exists "stores_update_owner" on public.stores;
create policy "stores_update_owner"
on public.stores
for update
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = stores.business_id
      and b.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_user_id = auth.uid()
  )
);

drop policy if exists "stores_delete_owner" on public.stores;
create policy "stores_delete_owner"
on public.stores
for delete
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = stores.business_id
      and b.owner_user_id = auth.uid()
  )
);

-- =========================================================
-- CATEGORIES
-- =========================================================

drop policy if exists "categories_public_select" on public.categories;
create policy "categories_public_select"
on public.categories
for select
using (true);

-- =========================================================
-- PRODUCTS
-- =========================================================

drop policy if exists "products_public_select_policy" on public.products;
create policy "products_public_select_policy"
on public.products
for select
using (true);

drop policy if exists "products_authenticated_insert_policy" on public.products;
drop policy if exists "products_merchant_insert_policy" on public.products;
create policy "products_merchant_insert_policy"
on public.products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('merchant', 'admin')
  )
);

drop policy if exists "products_authenticated_update_policy" on public.products;
drop policy if exists "products_merchant_update_policy" on public.products;
create policy "products_merchant_update_policy"
on public.products
for update
to authenticated
using (
  exists (
    select 1
    from public.store_products sp
    join public.stores s on s.id = sp.store_id
    join public.businesses b on b.id = s.business_id
    where sp.product_id = products.id
      and b.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.store_products sp
    join public.stores s on s.id = sp.store_id
    join public.businesses b on b.id = s.business_id
    where sp.product_id = products.id
      and b.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "products_authenticated_delete_policy" on public.products;
drop policy if exists "products_merchant_delete_policy" on public.products;

-- =========================================================
-- STORE_PRODUCTS
-- =========================================================

drop policy if exists "store_products_select_policy" on public.store_products;
create policy "store_products_select_policy"
on public.store_products
for select
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_products.store_id
      and s.is_active = true
      and s.status = 'active'
      and store_products.is_available = true
      and store_products.stock > 0
  )
  or exists (
    select 1
    from public.stores s
    join public.businesses b on b.id = s.business_id
    where s.id = store_products.store_id
      and b.owner_user_id = auth.uid()
  )
);

drop policy if exists "store_products_insert_owner" on public.store_products;
create policy "store_products_insert_owner"
on public.store_products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.stores s
    join public.businesses b on b.id = s.business_id
    where s.id = store_id
      and b.owner_user_id = auth.uid()
  )
);

drop policy if exists "store_products_update_owner" on public.store_products;
create policy "store_products_update_owner"
on public.store_products
for update
to authenticated
using (
  exists (
    select 1
    from public.stores s
    join public.businesses b on b.id = s.business_id
    where s.id = store_products.store_id
      and b.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.stores s
    join public.businesses b on b.id = s.business_id
    where s.id = store_id
      and b.owner_user_id = auth.uid()
  )
);

drop policy if exists "store_products_delete_owner" on public.store_products;
create policy "store_products_delete_owner"
on public.store_products
for delete
to authenticated
using (
  exists (
    select 1
    from public.stores s
    join public.businesses b on b.id = s.business_id
    where s.id = store_products.store_id
      and b.owner_user_id = auth.uid()
  )
);

-- =========================================================
-- RESERVATIONS
-- =========================================================

drop policy if exists "reservations_select_policy" on public.reservations;
create policy "reservations_select_policy"
on public.reservations
for select
to authenticated
using (
  customer_user_id = auth.uid()
  or exists (
    select 1
    from public.stores s
    join public.businesses b on b.id = s.business_id
    where s.id = reservations.store_id
      and b.owner_user_id = auth.uid()
  )
);

-- Inserts and updates are intentionally handled by security definer RPCs.
drop policy if exists "reservations_insert_policy" on public.reservations;
drop policy if exists "reservations_update_policy" on public.reservations;
drop policy if exists "reservations_delete_policy" on public.reservations;

-- =========================================================
-- RESERVATION_ITEMS
-- =========================================================

drop policy if exists "reservation_items_select_policy" on public.reservation_items;
create policy "reservation_items_select_policy"
on public.reservation_items
for select
to authenticated
using (
  exists (
    select 1
    from public.reservations r
    where r.id = reservation_items.reservation_id
      and r.customer_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.reservations r
    join public.stores s on s.id = r.store_id
    join public.businesses b on b.id = s.business_id
    where r.id = reservation_items.reservation_id
      and b.owner_user_id = auth.uid()
  )
);

-- Inserts and updates are intentionally handled by security definer RPCs.
drop policy if exists "reservation_items_insert_policy" on public.reservation_items;
drop policy if exists "reservation_items_update_policy" on public.reservation_items;
drop policy if exists "reservation_items_delete_policy" on public.reservation_items;

-- 3) Re-run this query after the fixes. It should return zero rows or only
-- intentionally public extension/reference tables with explicit policies.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  pg_get_userbyid(c.relowner) as table_owner,
  (
    c.relname = 'spatial_ref_sys'
    or exists (
      select 1
      from pg_depend d
      join pg_extension e on e.oid = d.refobjid
      where d.classid = 'pg_class'::regclass
        and d.objid = c.oid
        and d.deptype = 'e'
    )
  ) as is_extension_or_reference_table
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by c.relname;
