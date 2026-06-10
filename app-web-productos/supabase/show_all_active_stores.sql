-- =========================================================
-- AHORRAPE - SHOW ALL ACTIVE STORES ON MAP
-- Run this complete file in Supabase SQL Editor.
-- It publishes existing pending stores and updates search_nearby_stores so
-- stores can appear on the map even before products are added.
-- =========================================================

begin;

update public.stores
set
  status = 'active',
  is_active = true
where is_active = true
  and status = 'pending';

drop function if exists public.search_nearby_stores(
  double precision,
  double precision,
  integer,
  integer
);

create or replace function public.search_nearby_stores(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer default 3000,
  p_limit integer default 50
)
returns table (
  store_id uuid,
  store_name text,
  address_text text,
  district text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  product_count bigint,
  categories jsonb,
  opening_hours jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with nearby_stores as (
    select
      s.id as store_id,
      s.store_name,
      s.address_text,
      s.district,
      s.latitude,
      s.longitude,
      s.opening_hours,
      st_distance(
        s.location,
        st_setsrid(st_makepoint(p_user_lng, p_user_lat), 4326)::geography
      ) as distance_meters
    from public.stores s
    where
      s.is_active = true
      and s.status = 'active'
      and st_dwithin(
        s.location,
        st_setsrid(st_makepoint(p_user_lng, p_user_lat), 4326)::geography,
        p_radius_meters
      )
  ),
  store_summaries as (
    select
      ns.store_id,
      ns.store_name,
      ns.address_text,
      ns.district,
      ns.latitude,
      ns.longitude,
      ns.opening_hours,
      ns.distance_meters,
      count(sp.id) as product_count
    from nearby_stores ns
    left join public.store_products sp
      on sp.store_id = ns.store_id
      and sp.is_available = true
      and sp.stock > 0
    group by
      ns.store_id,
      ns.store_name,
      ns.address_text,
      ns.district,
      ns.latitude,
      ns.longitude,
      ns.opening_hours,
      ns.distance_meters
  )
  select
    ss.store_id,
    ss.store_name,
    ss.address_text,
    ss.district,
    ss.latitude,
    ss.longitude,
    ss.distance_meters,
    ss.product_count,
    coalesce(category_summary.categories, '[]'::jsonb) as categories,
    ss.opening_hours
  from store_summaries ss
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'category_id', category_rows.category_id,
        'category_name', category_rows.category_name,
        'product_count', category_rows.product_count
      )
      order by category_rows.category_name
    ) as categories
    from (
      select
        c.id as category_id,
        coalesce(c.name, 'Sin categoria') as category_name,
        count(sp.id) as product_count
      from public.store_products sp
      join public.products p on p.id = sp.product_id
      left join public.categories c on c.id = p.category_id
      where
        sp.store_id = ss.store_id
        and sp.is_available = true
        and sp.stock > 0
      group by c.id, c.name
    ) category_rows
  ) category_summary on true
  order by ss.distance_meters asc, ss.product_count desc, ss.store_name asc
  limit p_limit;
$$;

revoke all on function public.search_nearby_stores(
  double precision,
  double precision,
  integer,
  integer
) from public;

grant execute on function public.search_nearby_stores(
  double precision,
  double precision,
  integer,
  integer
) to anon, authenticated;

commit;

select
  status,
  is_active,
  count(*) as store_count
from public.stores
group by status, is_active
order by status, is_active;
