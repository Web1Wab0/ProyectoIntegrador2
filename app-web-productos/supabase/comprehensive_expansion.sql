-- =========================================================
-- AHORRAPE - EXPANSION INTEGRAL
-- Ejecutar el archivo completo en Supabase SQL Editor.
-- Idempotente y compatible con datos existentes.
-- =========================================================

begin;

create extension if not exists pgcrypto;

-- ---------- Helpers de autorización ----------

create or replace function public.is_ahorrape_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role::text = 'admin'
  );
$$;

create or replace function public.owns_ahorrape_store(
  p_store_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.stores s
    join public.businesses b on b.id = s.business_id
    where s.id = p_store_id
      and b.owner_user_id = p_user_id
  ) or public.is_ahorrape_admin(p_user_id);
$$;

-- ---------- Perfiles y categorías ----------

alter table public.profiles
  add column if not exists analytics_opt_out boolean not null default false,
  add column if not exists adult_content_confirmed boolean not null default false;

alter table public.categories
  add column if not exists slug text,
  add column if not exists sort_order integer not null default 100,
  add column if not exists is_age_restricted boolean not null default false;

update public.categories
set name = case name
  when 'Abarrotes' then 'Abarrotes y despensa'
  when 'Snacks' then 'Snacks y golosinas'
  when 'Lácteos' then 'Lácteos y huevos'
  when 'Limpieza' then 'Limpieza del hogar'
  else name
end
where name in ('Abarrotes', 'Snacks', 'Lácteos', 'Limpieza');

with requested(name, slug, sort_order, is_age_restricted) as (
  values
    ('Abarrotes y despensa', 'abarrotes-y-despensa', 10, false),
    ('Bebidas', 'bebidas', 20, false),
    ('Snacks y golosinas', 'snacks-y-golosinas', 30, false),
    ('Panadería y pastelería', 'panaderia-y-pasteleria', 40, false),
    ('Lácteos y huevos', 'lacteos-y-huevos', 50, false),
    ('Carnes, pollo y embutidos', 'carnes-pollo-y-embutidos', 60, false),
    ('Frutas y verduras', 'frutas-y-verduras', 70, false),
    ('Congelados', 'congelados', 80, false),
    ('Cigarrillos y licores', 'cigarrillos-y-licores', 90, true),
    ('Cuidado personal e higiene', 'cuidado-personal-e-higiene', 100, false),
    ('Limpieza del hogar', 'limpieza-del-hogar', 110, false),
    ('Bebé', 'bebe', 120, false),
    ('Mascotas', 'mascotas', 130, false),
    ('Salud y farmacia', 'salud-y-farmacia', 140, false),
    ('Útiles escolares', 'utiles-escolares', 150, false),
    ('Papelería y oficina', 'papeleria-y-oficina', 160, false),
    ('Libros y revistas', 'libros-y-revistas', 170, false),
    ('Arte y manualidades', 'arte-y-manualidades', 180, false),
    ('Mochilas y cartucheras', 'mochilas-y-cartucheras', 190, false),
    ('Bazar y regalos', 'bazar-y-regalos', 200, false),
    ('Bisutería y accesorios', 'bisuteria-y-accesorios', 210, false),
    ('Decoración y menaje del hogar', 'decoracion-y-menaje-del-hogar', 220, false),
    ('Juguetes', 'juguetes', 230, false),
    ('Fiestas y temporada', 'fiestas-y-temporada', 240, false),
    ('Ferretería y electricidad', 'ferreteria-y-electricidad', 250, false),
    ('Tecnología y accesorios de celular', 'tecnologia-y-accesorios-de-celular', 260, false),
    ('Otros', 'otros', 999, false)
)
insert into public.categories (name, slug, sort_order, is_age_restricted)
select r.name, r.slug, r.sort_order, r.is_age_restricted
from requested r
where not exists (
  select 1 from public.categories c where lower(c.name) = lower(r.name)
);

with requested(name, slug, sort_order, is_age_restricted) as (
  values
    ('Abarrotes y despensa', 'abarrotes-y-despensa', 10, false),
    ('Bebidas', 'bebidas', 20, false),
    ('Snacks y golosinas', 'snacks-y-golosinas', 30, false),
    ('Panadería y pastelería', 'panaderia-y-pasteleria', 40, false),
    ('Lácteos y huevos', 'lacteos-y-huevos', 50, false),
    ('Carnes, pollo y embutidos', 'carnes-pollo-y-embutidos', 60, false),
    ('Frutas y verduras', 'frutas-y-verduras', 70, false),
    ('Congelados', 'congelados', 80, false),
    ('Cigarrillos y licores', 'cigarrillos-y-licores', 90, true),
    ('Cuidado personal e higiene', 'cuidado-personal-e-higiene', 100, false),
    ('Limpieza del hogar', 'limpieza-del-hogar', 110, false),
    ('Bebé', 'bebe', 120, false),
    ('Mascotas', 'mascotas', 130, false),
    ('Salud y farmacia', 'salud-y-farmacia', 140, false),
    ('Útiles escolares', 'utiles-escolares', 150, false),
    ('Papelería y oficina', 'papeleria-y-oficina', 160, false),
    ('Libros y revistas', 'libros-y-revistas', 170, false),
    ('Arte y manualidades', 'arte-y-manualidades', 180, false),
    ('Mochilas y cartucheras', 'mochilas-y-cartucheras', 190, false),
    ('Bazar y regalos', 'bazar-y-regalos', 200, false),
    ('Bisutería y accesorios', 'bisuteria-y-accesorios', 210, false),
    ('Decoración y menaje del hogar', 'decoracion-y-menaje-del-hogar', 220, false),
    ('Juguetes', 'juguetes', 230, false),
    ('Fiestas y temporada', 'fiestas-y-temporada', 240, false),
    ('Ferretería y electricidad', 'ferreteria-y-electricidad', 250, false),
    ('Tecnología y accesorios de celular', 'tecnologia-y-accesorios-de-celular', 260, false),
    ('Otros', 'otros', 999, false)
)
update public.categories c
set
  slug = r.slug,
  sort_order = r.sort_order,
  is_age_restricted = r.is_age_restricted
from requested r
where lower(c.name) = lower(r.name);

create unique index if not exists categories_slug_unique
  on public.categories (slug)
  where slug is not null;

alter table public.store_products
  add column if not exists low_stock_threshold integer not null default 3;

alter table public.store_products
  drop constraint if exists store_products_low_stock_threshold_check;

alter table public.store_products
  add constraint store_products_low_stock_threshold_check
  check (low_stock_threshold >= 0 and low_stock_threshold <= 9999);

-- ---------- Soporte y reclamos ----------

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.complaint_code_seq;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  complaint_type text not null
    check (complaint_type in ('reclamo', 'queja')),
  document_type text not null,
  document_number text not null,
  full_name text not null,
  address text not null,
  email text not null,
  phone text,
  good_or_service text not null
    check (good_or_service in ('producto', 'servicio')),
  amount numeric(12,2),
  detail text not null,
  consumer_request text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'answered', 'closed')),
  admin_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_requests_email_created_idx
  on public.support_requests (lower(email), created_at desc);

create index if not exists complaints_email_created_idx
  on public.complaints (lower(email), created_at desc);

alter table public.support_requests enable row level security;
alter table public.complaints enable row level security;

drop policy if exists support_requests_select_own_or_admin on public.support_requests;
create policy support_requests_select_own_or_admin
on public.support_requests for select to authenticated
using (user_id = auth.uid() or public.is_ahorrape_admin());

drop policy if exists support_requests_admin_update on public.support_requests;
create policy support_requests_admin_update
on public.support_requests for update to authenticated
using (public.is_ahorrape_admin())
with check (public.is_ahorrape_admin());

drop policy if exists complaints_select_own_or_admin on public.complaints;
create policy complaints_select_own_or_admin
on public.complaints for select to authenticated
using (user_id = auth.uid() or public.is_ahorrape_admin());

drop policy if exists complaints_admin_update on public.complaints;
create policy complaints_admin_update
on public.complaints for update to authenticated
using (public.is_ahorrape_admin())
with check (public.is_ahorrape_admin());

create or replace function public.submit_support_request(
  p_full_name text,
  p_email text,
  p_subject text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_email text := lower(btrim(p_email));
begin
  if char_length(btrim(p_full_name)) < 3
    or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    or char_length(btrim(p_subject)) < 3
    or char_length(btrim(p_message)) < 10 then
    raise exception 'Completa correctamente todos los campos.';
  end if;

  if (
    select count(*)
    from public.support_requests
    where lower(email) = v_email
      and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Alcanzaste el límite temporal de solicitudes. Intenta más tarde.';
  end if;

  insert into public.support_requests (
    user_id, full_name, email, subject, message
  )
  values (
    auth.uid(), btrim(p_full_name), v_email, btrim(p_subject), btrim(p_message)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.submit_complaint(
  p_complaint_type text,
  p_document_type text,
  p_document_number text,
  p_full_name text,
  p_address text,
  p_email text,
  p_phone text,
  p_good_or_service text,
  p_amount numeric,
  p_detail text,
  p_consumer_request text
)
returns table (complaint_id uuid, complaint_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_email text := lower(btrim(p_email));
begin
  if p_complaint_type not in ('reclamo', 'queja')
    or p_good_or_service not in ('producto', 'servicio')
    or char_length(btrim(p_document_number)) < 5
    or char_length(btrim(p_full_name)) < 3
    or char_length(btrim(p_address)) < 5
    or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    or char_length(btrim(p_detail)) < 10
    or char_length(btrim(p_consumer_request)) < 5 then
    raise exception 'Completa correctamente los datos del reclamo.';
  end if;

  if (
    select count(*)
    from public.complaints
    where lower(email) = v_email
      and created_at > now() - interval '1 day'
  ) >= 3 then
    raise exception 'Alcanzaste el límite temporal de registros. Intenta más tarde.';
  end if;

  v_code := 'LR-' || to_char(now() at time zone 'America/Lima', 'YYYY')
    || '-' || lpad(nextval('public.complaint_code_seq')::text, 6, '0');

  insert into public.complaints (
    code, user_id, complaint_type, document_type, document_number,
    full_name, address, email, phone, good_or_service, amount,
    detail, consumer_request
  )
  values (
    v_code, auth.uid(), p_complaint_type, btrim(p_document_type),
    btrim(p_document_number), btrim(p_full_name), btrim(p_address),
    v_email, nullif(btrim(p_phone), ''), p_good_or_service,
    case when p_amount is null or p_amount < 0 then null else p_amount end,
    btrim(p_detail), btrim(p_consumer_request)
  )
  returning id into v_id;

  return query select v_id, v_code;
end;
$$;

grant execute on function public.submit_support_request(text, text, text, text)
  to anon, authenticated;
grant execute on function public.submit_complaint(
  text, text, text, text, text, text, text, text, numeric, text, text
) to anon, authenticated;

-- ---------- Reseñas verificadas ----------

create table if not exists public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_id, user_id)
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  store_product_id uuid not null references public.store_products(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_id, store_product_id, user_id)
);

create or replace function public.can_review_store(
  p_reservation_id uuid,
  p_store_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.reservations r
    where r.id = p_reservation_id
      and r.store_id = p_store_id
      and r.customer_user_id = p_user_id
      and r.status::text = 'completed'
  );
$$;

create or replace function public.can_review_product(
  p_reservation_id uuid,
  p_store_product_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.reservations r
    join public.reservation_items ri on ri.reservation_id = r.id
    where r.id = p_reservation_id
      and r.customer_user_id = p_user_id
      and r.status::text = 'completed'
      and ri.store_product_id = p_store_product_id
  );
$$;

alter table public.store_reviews enable row level security;
alter table public.product_reviews enable row level security;

drop policy if exists store_reviews_public_read on public.store_reviews;
create policy store_reviews_public_read
on public.store_reviews for select to public
using (is_published = true or user_id = auth.uid() or public.is_ahorrape_admin());

drop policy if exists store_reviews_insert_verified on public.store_reviews;
create policy store_reviews_insert_verified
on public.store_reviews for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_review_store(reservation_id, store_id)
);

drop policy if exists store_reviews_update_own on public.store_reviews;
create policy store_reviews_update_own
on public.store_reviews for update to authenticated
using (user_id = auth.uid() or public.is_ahorrape_admin())
with check (
  (user_id = auth.uid() and public.can_review_store(reservation_id, store_id))
  or public.is_ahorrape_admin()
);

drop policy if exists product_reviews_public_read on public.product_reviews;
create policy product_reviews_public_read
on public.product_reviews for select to public
using (is_published = true or user_id = auth.uid() or public.is_ahorrape_admin());

drop policy if exists product_reviews_insert_verified on public.product_reviews;
create policy product_reviews_insert_verified
on public.product_reviews for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_review_product(reservation_id, store_product_id)
);

drop policy if exists product_reviews_update_own on public.product_reviews;
create policy product_reviews_update_own
on public.product_reviews for update to authenticated
using (user_id = auth.uid() or public.is_ahorrape_admin())
with check (
  (user_id = auth.uid() and public.can_review_product(reservation_id, store_product_id))
  or public.is_ahorrape_admin()
);

create or replace view public.store_review_summaries
with (security_invoker = true)
as
select
  store_id,
  round(avg(rating)::numeric, 2) as rating_average,
  count(*)::bigint as review_count
from public.store_reviews
where is_published = true
group by store_id;

create or replace view public.product_review_summaries
with (security_invoker = true)
as
select
  store_product_id,
  round(avg(rating)::numeric, 2) as rating_average,
  count(*)::bigint as review_count
from public.product_reviews
where is_published = true
group by store_product_id;

grant select on public.store_review_summaries to anon, authenticated;
grant select on public.product_review_summaries to anon, authenticated;

-- ---------- Favoritos ----------

create table if not exists public.favorite_stores (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

create table if not exists public.favorite_products (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_product_id uuid not null references public.store_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_product_id)
);

alter table public.favorite_stores enable row level security;
alter table public.favorite_products enable row level security;

drop policy if exists favorite_stores_own_all on public.favorite_stores;
create policy favorite_stores_own_all
on public.favorite_stores for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists favorite_products_own_all on public.favorite_products;
create policy favorite_products_own_all
on public.favorite_products for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------- Analítica pseudónima ----------

create table if not exists public.store_events (
  id bigint generated always as identity primary key,
  session_hash text not null,
  event_type text not null
    check (event_type in ('store_view', 'product_view', 'favorite_store', 'favorite_product')),
  store_id uuid not null references public.stores(id) on delete cascade,
  store_product_id uuid references public.store_products(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists store_events_store_created_idx
  on public.store_events (store_id, created_at desc);
create index if not exists store_events_product_created_idx
  on public.store_events (store_product_id, created_at desc);

alter table public.store_events enable row level security;

drop policy if exists store_events_owner_read on public.store_events;
create policy store_events_owner_read
on public.store_events for select to authenticated
using (public.owns_ahorrape_store(store_id));

create or replace function public.record_store_event(
  p_session_hash text,
  p_event_type text,
  p_store_id uuid,
  p_store_product_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_event_type not in ('store_view', 'product_view', 'favorite_store', 'favorite_product')
    or char_length(p_session_hash) < 12 then
    return false;
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id = p_store_id
      and s.is_active = true
      and s.status::text = 'active'
  ) then
    return false;
  end if;

  if p_store_product_id is not null and not exists (
    select 1 from public.store_products sp
    where sp.id = p_store_product_id
      and sp.store_id = p_store_id
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.store_events e
    where e.session_hash = p_session_hash
      and e.event_type = p_event_type
      and e.store_id = p_store_id
      and e.store_product_id is not distinct from p_store_product_id
      and e.created_at > now() - interval '10 minutes'
  ) then
    return true;
  end if;

  insert into public.store_events (
    session_hash, event_type, store_id, store_product_id
  )
  values (
    left(p_session_hash, 128), p_event_type, p_store_id, p_store_product_id
  );

  return true;
end;
$$;

grant execute on function public.record_store_event(text, text, uuid, uuid)
  to anon, authenticated;

create or replace function public.get_my_merchant_setup_status()
returns table (
  user_role text,
  business_id uuid,
  store_id uuid,
  store_name text,
  store_status text,
  store_is_active boolean,
  product_count bigint,
  reservation_count bigint,
  completed_reservation_count bigint,
  completed_units bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_business_id uuid;
  v_store_id uuid;
  v_store_name text;
  v_store_status text;
  v_store_is_active boolean;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesion para consultar esta informacion.'
      using errcode = '42501';
  end if;

  select p.role::text
    into v_role
  from public.profiles p
  where p.id = v_user_id;

  select
    b.id,
    s.id,
    s.store_name,
    s.status::text,
    s.is_active
  into
    v_business_id,
    v_store_id,
    v_store_name,
    v_store_status,
    v_store_is_active
  from public.businesses b
  join public.stores s on s.business_id = b.id
  where b.owner_user_id = v_user_id
  order by
    s.updated_at desc nulls last,
    s.created_at desc nulls last,
    s.id
  limit 1;

  if v_business_id is null then
    select b.id
      into v_business_id
    from public.businesses b
    where b.owner_user_id = v_user_id
    order by b.id
    limit 1;
  end if;

  return query
  select
    v_role,
    v_business_id,
    v_store_id,
    v_store_name,
    v_store_status,
    coalesce(v_store_is_active, false),
    case when v_store_id is null then 0::bigint else (
      select count(*)::bigint from public.store_products sp
      where sp.store_id = v_store_id
    ) end,
    case when v_store_id is null then 0::bigint else (
      select count(*)::bigint from public.reservations r
      where r.store_id = v_store_id
    ) end,
    case when v_store_id is null then 0::bigint else (
      select count(*)::bigint from public.reservations r
      where r.store_id = v_store_id and r.status::text = 'completed'
    ) end,
    case when v_store_id is null then 0::bigint else (
      select coalesce(sum(ri.quantity), 0)::bigint
      from public.reservations r
      join public.reservation_items ri on ri.reservation_id = r.id
      where r.store_id = v_store_id and r.status::text = 'completed'
    ) end;
end;
$$;

revoke all on function public.get_my_merchant_setup_status() from public;
revoke all on function public.get_my_merchant_setup_status() from anon;
grant execute on function public.get_my_merchant_setup_status()
  to authenticated;

create or replace function public.get_merchant_analytics(
  p_store_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.owns_ahorrape_store(p_store_id) then
    raise exception 'No tienes acceso a esta tienda.'
      using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'El rango de fechas no es valido.'
      using errcode = '22007';
  end if;

  select jsonb_build_object(
    'store_views', (
      select count(*) from public.store_events
      where store_id = p_store_id and event_type = 'store_view'
        and created_at >= p_from and created_at < p_to
    ),
    'product_views', (
      select count(*) from public.store_events
      where store_id = p_store_id and event_type = 'product_view'
        and created_at >= p_from and created_at < p_to
    ),
    'reservations', (
      select count(*) from public.reservations
      where store_id = p_store_id
        and reserved_at >= p_from and reserved_at < p_to
    ),
    'estimated_revenue', (
      select coalesce(sum(total_amount), 0) from public.reservations
      where store_id = p_store_id and status::text = 'completed'
        and reserved_at >= p_from and reserved_at < p_to
    ),
    'cancelled', (
      select count(*) from public.reservations
      where store_id = p_store_id and status::text = 'cancelled'
        and reserved_at >= p_from and reserved_at < p_to
    ),
    'daily_series', coalesce((
      select jsonb_agg(row_to_json(x) order by x.day)
      from (
        select
          d::date as day,
          (
            select count(*) from public.store_events e
            where e.store_id = p_store_id
              and e.event_type = 'store_view'
              and e.created_at >= d
              and e.created_at < d + interval '1 day'
          ) as visits,
          (
            select count(*) from public.reservations r
            where r.store_id = p_store_id
              and r.reserved_at >= d
              and r.reserved_at < d + interval '1 day'
          ) as reservations
        from generate_series(
          date_trunc('day', p_from),
          date_trunc('day', p_to - interval '1 second'),
          interval '1 day'
        ) d
      ) x
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(row_to_json(x) order by x.quantity desc)
      from (
        select
          p.product_name,
          sum(ri.quantity)::bigint as quantity,
          sum(ri.subtotal)::numeric as amount
        from public.reservation_items ri
        join public.reservations r on r.id = ri.reservation_id
        join public.store_products sp on sp.id = ri.store_product_id
        join public.products p on p.id = sp.product_id
        where r.store_id = p_store_id
          and r.reserved_at >= p_from and r.reserved_at < p_to
          and r.status::text = 'completed'
        group by p.product_name
        order by quantity desc
        limit 8
      ) x
    ), '[]'::jsonb),
    'peak_hours', coalesce((
      select jsonb_agg(row_to_json(x) order by x.hour)
      from (
        select
          extract(hour from pickup_at at time zone 'America/Lima')::integer as hour,
          count(*)::bigint as reservations
        from public.reservations
        where store_id = p_store_id
          and pickup_at is not null
          and reserved_at >= p_from and reserved_at < p_to
        group by 1
        order by 1
      ) x
    ), '[]'::jsonb),
    'calendar', coalesce((
      select jsonb_agg(row_to_json(x) order by x.pickup_at)
      from (
        select id, pickup_code, status::text as status, total_amount, pickup_at
        from public.reservations
        where store_id = p_store_id
          and pickup_at >= p_from and pickup_at < p_to
        order by pickup_at
      ) x
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_merchant_reservation_report(
  p_store_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  reservation_id uuid,
  pickup_code text,
  status text,
  reserved_at timestamptz,
  pickup_at timestamptz,
  product_name text,
  quantity integer,
  unit_price numeric,
  subtotal numeric,
  total_amount numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.owns_ahorrape_store(p_store_id) then
    raise exception 'No tienes acceso a esta tienda.';
  end if;

  return query
  select
    r.id,
    r.pickup_code::text,
    r.status::text,
    r.reserved_at,
    r.pickup_at,
    p.product_name,
    ri.quantity,
    ri.unit_price,
    ri.subtotal,
    r.total_amount
  from public.reservations r
  join public.reservation_items ri on ri.reservation_id = r.id
  join public.store_products sp on sp.id = ri.store_product_id
  join public.products p on p.id = sp.product_id
  where r.store_id = p_store_id
    and r.reserved_at >= p_from
    and r.reserved_at < p_to
  order by r.reserved_at desc, p.product_name;
end;
$$;

revoke all on function public.get_merchant_analytics(
  uuid, timestamptz, timestamptz
) from public;
revoke all on function public.get_merchant_analytics(
  uuid, timestamptz, timestamptz
) from anon;
grant execute on function public.get_merchant_analytics(
  uuid, timestamptz, timestamptz
) to authenticated;
grant execute on function public.get_merchant_reservation_report(uuid, timestamptz, timestamptz)
  to authenticated;

-- ---------- Preferencias y Web Push ----------

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app boolean not null default true,
  push_enabled boolean not null default false,
  reservation_updates boolean not null default true,
  reservation_reminders boolean not null default true,
  price_drop boolean not null default true,
  back_in_stock boolean not null default true,
  low_stock boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists notification_preferences_own_all on public.notification_preferences;
create policy notification_preferences_own_all
on public.notification_preferences for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists push_subscriptions_own_all on public.push_subscriptions;
create policy push_subscriptions_own_all
on public.push_subscriptions for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------- Notificaciones generales ----------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete cascade,
  event_key text not null,
  type text not null default 'info'
    check (type in ('success', 'info', 'warning', 'error')),
  title text not null,
  message text not null,
  href text not null default '/',
  viewed_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications
  alter column reservation_id drop not null,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid;

alter table public.notifications
  drop constraint if exists notifications_user_reservation_event_unique;

alter table public.notifications enable row level security;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at)
  where read_at is null;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

update public.notifications
set event_key = event_key || ':' || reservation_id::text
where reservation_id is not null
  and event_key not like '%' || reservation_id::text;

create unique index if not exists notifications_user_event_unique
  on public.notifications (user_id, event_key);

create or replace function public.create_reservation_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_merchant_id uuid;
  v_store_name text;
  v_status text;
  v_cancelled_by text;
  v_title text;
  v_message text;
  v_type text := 'info';
begin
  select b.owner_user_id, s.store_name
    into v_merchant_id, v_store_name
  from public.stores s
  join public.businesses b on b.id = s.business_id
  where s.id = new.store_id;

  if tg_op = 'INSERT' then
    if v_merchant_id is not null then
      insert into public.notifications (
        user_id, reservation_id, event_key, type, title, message, href,
        entity_type, entity_id
      )
      values (
        v_merchant_id, new.id, 'reservation_created:' || new.id::text,
        'info', 'Nueva reserva recibida',
        'Tienes una nueva reserva en ' || coalesce(v_store_name, 'tu tienda') || '.',
        '/merchant/reservations?reservation=' || new.id::text,
        'reservation', new.id
      )
      on conflict (user_id, event_key) do nothing;
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then return new; end if;

  v_status := new.status::text;
  v_cancelled_by := coalesce(new.cancelled_by::text, '');

  if v_status = 'cancelled' and v_cancelled_by = 'customer' then
    if v_merchant_id is not null then
      insert into public.notifications (
        user_id, reservation_id, event_key, type, title, message, href,
        entity_type, entity_id
      )
      values (
        v_merchant_id, new.id, 'customer_cancelled:' || new.id::text,
        'warning', 'Reserva cancelada por el cliente',
        'El cliente canceló una reserva de ' || coalesce(v_store_name, 'tu tienda') || '.',
        '/merchant/reservations?reservation=' || new.id::text,
        'reservation', new.id
      )
      on conflict (user_id, event_key) do nothing;
    end if;
    return new;
  end if;

  v_title := case v_status
    when 'confirmed' then 'Reserva confirmada'
    when 'ready' then 'Tu reserva está lista'
    when 'completed' then 'Reserva completada'
    when 'cancelled' then 'Reserva cancelada'
    else 'Reserva actualizada'
  end;

  v_message := case v_status
    when 'confirmed' then coalesce(v_store_name, 'La tienda') || ' confirmó tu reserva.'
    when 'ready' then 'Tu pedido en ' || coalesce(v_store_name, 'la tienda') || ' ya está listo para recoger.'
    when 'completed' then 'La reserva en ' || coalesce(v_store_name, 'la tienda') || ' fue marcada como completada.'
    when 'cancelled' then coalesce(v_store_name, 'La tienda') || ' canceló tu reserva.'
    else 'El estado de tu reserva cambió a ' || v_status || '.'
  end;

  v_type := case
    when v_status in ('confirmed', 'ready', 'completed') then 'success'
    when v_status = 'cancelled' then 'error'
    else 'info'
  end;

  insert into public.notifications (
    user_id, reservation_id, event_key, type, title, message, href,
    entity_type, entity_id
  )
  values (
    new.customer_user_id, new.id,
    'status_' || v_status || ':' || new.id::text,
    v_type, v_title, v_message,
    '/customer/reservations?reservation=' || new.id::text,
    'reservation', new.id
  )
  on conflict (user_id, event_key) do nothing;

  return new;
end;
$$;

create or replace function public.notify_favorite_product_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_name text;
  v_product_name text;
  v_owner_id uuid;
begin
  select s.store_name, p.product_name, b.owner_user_id
    into v_store_name, v_product_name, v_owner_id
  from public.store_products sp
  join public.stores s on s.id = sp.store_id
  join public.businesses b on b.id = s.business_id
  join public.products p on p.id = sp.product_id
  where sp.id = new.id;

  if new.price < old.price then
    insert into public.notifications (
      user_id, event_key, type, title, message, href, entity_type, entity_id
    )
    select
      fp.user_id,
      'price_drop:' || new.id::text || ':' || new.price::text,
      'success',
      'Bajó el precio de un favorito',
      v_product_name || ' ahora cuesta S/ ' || trim(to_char(new.price, '999999990.00'))
        || ' en ' || v_store_name || '.',
      '/stores/' || new.store_id::text || '?product=' || new.id::text,
      'store_product',
      new.id
    from public.favorite_products fp
    left join public.notification_preferences np on np.user_id = fp.user_id
    where fp.store_product_id = new.id
      and coalesce(np.price_drop, true)
    on conflict (user_id, event_key) do nothing;
  end if;

  if old.stock <= 0 and new.stock > 0 then
    insert into public.notifications (
      user_id, event_key, type, title, message, href, entity_type, entity_id
    )
    select
      fp.user_id,
      'back_in_stock:' || new.id::text || ':' || extract(epoch from now())::bigint,
      'info',
      'Producto disponible nuevamente',
      v_product_name || ' volvió a tener stock en ' || v_store_name || '.',
      '/stores/' || new.store_id::text || '?product=' || new.id::text,
      'store_product',
      new.id
    from public.favorite_products fp
    left join public.notification_preferences np on np.user_id = fp.user_id
    where fp.store_product_id = new.id
      and coalesce(np.back_in_stock, true)
    on conflict (user_id, event_key) do nothing;
  end if;

  if new.stock <= new.low_stock_threshold
    and old.stock > old.low_stock_threshold
    and v_owner_id is not null then
    if coalesce((
      select low_stock from public.notification_preferences
      where user_id = v_owner_id
    ), true) then
      insert into public.notifications (
        user_id, event_key, type, title, message, href, entity_type, entity_id
      )
      values (
        v_owner_id,
        'low_stock:' || new.id::text || ':' || new.stock::text || ':' || extract(epoch from now())::bigint,
        'warning',
        'Stock bajo',
        v_product_name || ' tiene ' || new.stock::text || ' unidades disponibles.',
        '/merchant/products?product=' || new.id::text,
        'store_product',
        new.id
      )
      on conflict (user_id, event_key) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists favorite_product_change_notifications
  on public.store_products;
create trigger favorite_product_change_notifications
after update of price, stock on public.store_products
for each row execute function public.notify_favorite_product_changes();

create or replace function public.enqueue_reservation_reminders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer;
begin
  insert into public.notifications (
    user_id, reservation_id, event_key, type, title, message, href,
    entity_type, entity_id
  )
  select
    r.customer_user_id,
    r.id,
    'pickup_reminder:' || r.id::text,
    'info',
    'Tu reserva es dentro de una hora',
    'Recuerda recoger tu reserva en ' || s.store_name || '.',
    '/customer/reservations?reservation=' || r.id::text,
    'reservation',
    r.id
  from public.reservations r
  join public.stores s on s.id = r.store_id
  left join public.notification_preferences np on np.user_id = r.customer_user_id
  where r.status::text in ('pending', 'confirmed', 'ready')
    and r.pickup_at > now() + interval '50 minutes'
    and r.pickup_at <= now() + interval '70 minutes'
    and coalesce(np.reservation_reminders, true)
  on conflict (user_id, event_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- ---------- Restricción de edad en servidor ----------

create or replace function public.enforce_age_restricted_reservation_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_restricted boolean;
  v_confirmed boolean;
begin
  select r.customer_user_id
    into v_customer_id
  from public.reservations r
  where r.id = new.reservation_id;

  select coalesce(c.is_age_restricted, false)
    into v_restricted
  from public.store_products sp
  join public.products p on p.id = sp.product_id
  left join public.categories c on c.id = p.category_id
  where sp.id = new.store_product_id;

  if v_restricted then
    select coalesce(adult_content_confirmed, false)
      into v_confirmed
    from public.profiles
    where id = v_customer_id;

    if not coalesce(v_confirmed, false) then
      raise exception 'Debes confirmar que eres mayor de edad para reservar este producto.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservation_item_age_check on public.reservation_items;
create trigger reservation_item_age_check
before insert or update of store_product_id on public.reservation_items
for each row execute function public.enforce_age_restricted_reservation_item();

-- ---------- Grants ----------

grant select on public.store_reviews, public.product_reviews to anon, authenticated;
grant insert, update on public.store_reviews, public.product_reviews to authenticated;
grant select, insert, delete on public.favorite_stores, public.favorite_products to authenticated;
grant select, insert, update, delete on public.notification_preferences, public.push_subscriptions to authenticated;
grant select on public.store_events to authenticated;
grant select on public.support_requests, public.complaints to authenticated;
grant update on public.support_requests, public.complaints to authenticated;

commit;

-- ---------- Programación opcional de recordatorios ----------
-- Se intenta configurar pg_cron sin abortar el resto si el proyecto no lo
-- tiene disponible. El recordatorio in-app funciona al ejecutar manualmente
-- public.enqueue_reservation_reminders().

do $$
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception when others then
    raise notice 'pg_cron no disponible: %', sqlerrm;
  end;

  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    if not exists (
      select 1 from cron.job where jobname = 'ahorrape-reservation-reminders'
    ) then
      perform cron.schedule(
        'ahorrape-reservation-reminders',
        '*/5 * * * *',
        'select public.enqueue_reservation_reminders();'
      );
    end if;
  end if;
exception when others then
  raise notice 'No se pudo programar el recordatorio: %', sqlerrm;
end;
$$;

-- Auditoría final.
select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'support_requests', 'complaints', 'store_reviews', 'product_reviews',
    'favorite_stores', 'favorite_products', 'store_events',
    'notification_preferences', 'push_subscriptions', 'notifications'
  )
order by tablename;
