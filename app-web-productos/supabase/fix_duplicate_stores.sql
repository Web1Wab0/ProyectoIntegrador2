-- =========================================================
-- FIX: duplicate stores per business
-- =========================================================
-- AhorraPe v1 supports one store per business. This script merges duplicated
-- stores without deleting reservations or products, then enforces the rule.

begin;

-- Audit before cleanup.
select
  b.id as business_id,
  b.business_name,
  count(s.id) as store_count,
  jsonb_agg(
    jsonb_build_object(
      'store_id', s.id,
      'store_name', s.store_name,
      'status', s.status,
      'is_active', s.is_active,
      'updated_at', s.updated_at,
      'created_at', s.created_at
    )
    order by s.updated_at desc, s.created_at desc, s.id desc
  ) as stores
from public.businesses b
join public.stores s on s.business_id = b.id
group by b.id, b.business_name
having count(s.id) > 1
order by store_count desc, b.business_name;

create temp table _store_keep on commit drop as
select
  s.business_id,
  (array_agg(s.id order by s.updated_at desc, s.created_at desc, s.id desc))[1]
    as keep_store_id,
  bool_or(s.status = 'active' and s.is_active = true) as has_public_store,
  count(*) as store_count
from public.stores s
group by s.business_id
having count(*) > 1;

create temp table _duplicate_store_map on commit drop as
select
  s.business_id,
  sk.keep_store_id,
  s.id as remove_store_id
from public.stores s
join _store_keep sk on sk.business_id = s.business_id
where s.id <> sk.keep_store_id;

-- If any duplicate store in the group was public, keep the surviving store
-- public too.
update public.stores s
set
  status = 'active',
  is_active = true,
  updated_at = now()
from _store_keep sk
where
  s.id = sk.keep_store_id
  and sk.has_public_store = true
  and (s.status <> 'active' or s.is_active = false);

-- Resolve duplicated store_products by business/product. Prefer an existing
-- row already attached to the surviving store; otherwise move the newest row.
create temp table _store_product_resolution on commit drop as
select
  sp.id as store_product_id,
  sk.keep_store_id,
  first_value(sp.id) over (
    partition by st.business_id, sp.product_id
    order by
      (sp.store_id = sk.keep_store_id) desc,
      sp.updated_at desc,
      sp.created_at desc,
      sp.id desc
  ) as keep_store_product_id,
  least(
    sum(sp.stock) over (partition by st.business_id, sp.product_id),
    2147483647::bigint
  )::integer as total_stock,
  bool_or(sp.is_available) over (
    partition by st.business_id, sp.product_id
  ) as any_available,
  first_value(sp.price) over (
    partition by st.business_id, sp.product_id
    order by sp.updated_at desc, sp.created_at desc, sp.id desc
  ) as latest_price
from public.store_products sp
join public.stores st on st.id = sp.store_id
join _store_keep sk on sk.business_id = st.business_id;

-- Reservation items must point at the surviving store_product before deleting
-- duplicate store_product rows.
update public.reservation_items ri
set store_product_id = spr.keep_store_product_id
from _store_product_resolution spr
where
  ri.store_product_id = spr.store_product_id
  and spr.store_product_id <> spr.keep_store_product_id;

-- Consolidate stock/availability and move the surviving store_product to the
-- surviving store if it came from a duplicate store.
update public.store_products sp
set
  store_id = consolidated.keep_store_id,
  stock = consolidated.total_stock,
  is_available = consolidated.any_available,
  price = consolidated.latest_price,
  updated_at = now()
from (
  select distinct
    keep_store_product_id,
    keep_store_id,
    total_stock,
    any_available,
    latest_price
  from _store_product_resolution
) consolidated
where sp.id = consolidated.keep_store_product_id;

delete from public.store_products sp
using _store_product_resolution spr
where
  sp.id = spr.store_product_id
  and spr.store_product_id <> spr.keep_store_product_id;

-- Move reservations after store_products are consolidated.
update public.reservations r
set
  store_id = dsm.keep_store_id,
  updated_at = now()
from _duplicate_store_map dsm
where r.store_id = dsm.remove_store_id;

delete from public.stores s
using _duplicate_store_map dsm
where s.id = dsm.remove_store_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stores'::regclass
      and conname = 'stores_business_id_unique'
  ) then
    alter table public.stores
      add constraint stores_business_id_unique unique (business_id);
  end if;
end $$;

-- Audit after cleanup. This should return zero rows.
select
  business_id,
  count(*) as store_count
from public.stores
group by business_id
having count(*) > 1;

commit;
