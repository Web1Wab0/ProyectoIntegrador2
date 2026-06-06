-- =========================================================
-- AHORRAPE - STORE OPENING HOURS
-- Run this file in Supabase SQL Editor before deploying/using the feature.
-- =========================================================

alter table if exists public.stores
add column if not exists opening_hours jsonb;

update public.stores
set opening_hours = '{
  "0": {"closed": false, "open": "08:00", "close": "20:00"},
  "1": {"closed": false, "open": "08:00", "close": "20:00"},
  "2": {"closed": false, "open": "08:00", "close": "20:00"},
  "3": {"closed": false, "open": "08:00", "close": "20:00"},
  "4": {"closed": false, "open": "08:00", "close": "20:00"},
  "5": {"closed": false, "open": "08:00", "close": "20:00"},
  "6": {"closed": false, "open": "08:00", "close": "20:00"}
}'::jsonb
where opening_hours is null;

alter table if exists public.stores
alter column opening_hours set default '{
  "0": {"closed": false, "open": "08:00", "close": "20:00"},
  "1": {"closed": false, "open": "08:00", "close": "20:00"},
  "2": {"closed": false, "open": "08:00", "close": "20:00"},
  "3": {"closed": false, "open": "08:00", "close": "20:00"},
  "4": {"closed": false, "open": "08:00", "close": "20:00"},
  "5": {"closed": false, "open": "08:00", "close": "20:00"},
  "6": {"closed": false, "open": "08:00", "close": "20:00"}
}'::jsonb;

alter table if exists public.stores
alter column opening_hours set not null;

create or replace function public.store_is_open_at(
  p_store_id uuid,
  p_pickup_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hours jsonb;
  v_day_key text;
  v_day_hours jsonb;
  v_open time;
  v_close time;
  v_pickup_time time;
begin
  if p_pickup_at is null then
    return false;
  end if;

  select s.opening_hours
  into v_hours
  from public.stores s
  where s.id = p_store_id;

  if v_hours is null then
    return false;
  end if;

  v_day_key := extract(dow from (p_pickup_at at time zone 'America/Lima'))::int::text;
  v_day_hours := v_hours -> v_day_key;

  if v_day_hours is null or coalesce((v_day_hours ->> 'closed')::boolean, false) then
    return false;
  end if;

  v_open := (v_day_hours ->> 'open')::time;
  v_close := (v_day_hours ->> 'close')::time;
  v_pickup_time := (p_pickup_at at time zone 'America/Lima')::time;

  if v_open is null or v_close is null or v_open >= v_close then
    return false;
  end if;

  return v_pickup_time >= v_open and v_pickup_time < v_close;
exception
  when others then
    return false;
end;
$$;

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
    join public.store_products sp on sp.store_id = ns.store_id
    where
      sp.is_available = true
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
  order by ss.distance_meters asc, ss.product_count desc
  limit p_limit;
$$;

drop function if exists public.search_nearby_products(
  text,
  double precision,
  double precision,
  integer,
  integer
);

create or replace function public.search_nearby_products(
  p_search text,
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer default 5000,
  p_limit integer default 30
)
returns table (
  store_product_id uuid,
  product_id uuid,
  product_name text,
  product_description text,
  brand text,
  category_name text,
  price numeric,
  stock integer,
  image_url text,
  store_id uuid,
  store_name text,
  address_text text,
  district text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  opening_hours jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sp.id as store_product_id,
    p.id as product_id,
    p.product_name,
    p.description as product_description,
    p.brand,
    c.name as category_name,
    sp.price,
    sp.stock,
    sp.image_url,
    s.id as store_id,
    s.store_name,
    s.address_text,
    s.district,
    s.latitude,
    s.longitude,
    st_distance(
      s.location,
      st_setsrid(st_makepoint(p_user_lng, p_user_lat), 4326)::geography
    ) as distance_meters,
    s.opening_hours
  from public.store_products sp
  join public.products p on p.id = sp.product_id
  join public.stores s on s.id = sp.store_id
  left join public.categories c on c.id = p.category_id
  where
    s.is_active = true
    and s.status = 'active'
    and sp.is_available = true
    and sp.stock > 0
    and (
      lower(p.product_name) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(p.description, '')) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(p.brand, '')) like '%' || lower(trim(p_search)) || '%'
    )
    and st_dwithin(
      s.location,
      st_setsrid(st_makepoint(p_user_lng, p_user_lat), 4326)::geography,
      p_radius_meters
    )
  order by distance_meters asc, sp.price asc
  limit p_limit;
$$;

create or replace function public.create_reservation_with_items(
  p_store_id uuid,
  p_items jsonb,
  p_pickup_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_reservation_id uuid;
  v_total numeric(10,2);
  v_item_count integer;
  v_store_exists boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_pickup_at is null then
    raise exception 'Debes indicar fecha y hora de recojo';
  end if;

  if p_pickup_at <= now() then
    raise exception 'La fecha y hora de recojo debe ser futura';
  end if;

  select exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.is_active = true
      and s.status = 'active'
  )
  into v_store_exists;

  if not v_store_exists then
    raise exception 'El local seleccionado no esta disponible';
  end if;

  if not public.store_is_open_at(p_store_id, p_pickup_at) then
    raise exception 'La tienda esta cerrada en la fecha y hora de recojo seleccionada';
  end if;

  with requested_items as (
    select
      store_product_id,
      sum(quantity)::int as quantity
    from jsonb_to_recordset(p_items) as x(store_product_id uuid, quantity int)
    group by store_product_id
  )
  select count(*)
  into v_item_count
  from requested_items;

  if v_item_count = 0 then
    raise exception 'No hay productos para reservar';
  end if;

  if exists (
    with requested_items as (
      select
        store_product_id,
        sum(quantity)::int as quantity
      from jsonb_to_recordset(p_items) as x(store_product_id uuid, quantity int)
      group by store_product_id
    )
    select 1
    from requested_items
    where quantity is null or quantity <= 0
  ) then
    raise exception 'Las cantidades deben ser mayores a 0';
  end if;

  if exists (
    with requested_items as (
      select
        store_product_id,
        sum(quantity)::int as quantity
      from jsonb_to_recordset(p_items) as x(store_product_id uuid, quantity int)
      group by store_product_id
    )
    select 1
    from requested_items ri
    left join public.store_products sp on sp.id = ri.store_product_id
    where sp.id is null
       or sp.store_id <> p_store_id
       or sp.is_available = false
  ) then
    raise exception 'Uno o mas productos no pertenecen al local seleccionado o no estan disponibles';
  end if;

  perform 1
  from public.store_products sp
  where sp.store_id = p_store_id
    and sp.id in (
      select distinct x.store_product_id
      from jsonb_to_recordset(p_items) as x(store_product_id uuid, quantity int)
    )
  for update;

  if exists (
    with requested_items as (
      select
        store_product_id,
        sum(quantity)::int as quantity
      from jsonb_to_recordset(p_items) as x(store_product_id uuid, quantity int)
      group by store_product_id
    )
    select 1
    from requested_items ri
    join public.store_products sp on sp.id = ri.store_product_id
    where sp.stock < ri.quantity
  ) then
    raise exception 'Stock insuficiente para uno o mas productos';
  end if;

  with requested_items as (
    select
      store_product_id,
      sum(quantity)::int as quantity
    from jsonb_to_recordset(p_items) as x(store_product_id uuid, quantity int)
    group by store_product_id
  )
  select coalesce(sum(sp.price * ri.quantity), 0)::numeric(10,2)
  into v_total
  from requested_items ri
  join public.store_products sp on sp.id = ri.store_product_id;

  insert into public.reservations (
    customer_user_id,
    store_id,
    status,
    pickup_code,
    total_amount,
    notes,
    pickup_at,
    reserved_at,
    expires_at
  )
  values (
    v_user_id,
    p_store_id,
    'pending',
    upper(substr(md5(gen_random_uuid()::text), 1, 6)),
    v_total,
    p_notes,
    p_pickup_at,
    now(),
    p_pickup_at + interval '2 hours'
  )
  returning id into v_reservation_id;

  insert into public.reservation_items (
    reservation_id,
    store_product_id,
    quantity,
    unit_price,
    subtotal
  )
  with requested_items as (
    select
      store_product_id,
      sum(quantity)::int as quantity
    from jsonb_to_recordset(p_items) as x(store_product_id uuid, quantity int)
    group by store_product_id
  )
  select
    v_reservation_id,
    sp.id,
    ri.quantity,
    sp.price,
    (sp.price * ri.quantity)::numeric(10,2)
  from requested_items ri
  join public.store_products sp on sp.id = ri.store_product_id;

  update public.store_products sp
  set
    stock = sp.stock - ri.quantity,
    is_available = (sp.stock - ri.quantity) > 0
  from (
    select
      store_product_id,
      sum(quantity)::int as quantity
    from jsonb_to_recordset(p_items) as x(store_product_id uuid, quantity int)
    group by store_product_id
  ) ri
  where sp.id = ri.store_product_id;

  return v_reservation_id;
end;
$$;

grant execute on function public.search_nearby_stores(
  double precision,
  double precision,
  integer,
  integer
) to anon, authenticated;

grant execute on function public.search_nearby_products(
  text,
  double precision,
  double precision,
  integer,
  integer
) to anon, authenticated;

grant execute on function public.create_reservation_with_items(
  uuid,
  jsonb,
  timestamptz,
  text
) to authenticated;
