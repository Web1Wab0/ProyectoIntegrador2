-- =========================================================
-- AHORRAPE - ACCESO SEGURO Y GUIADO A ANALITICA
-- Ejecutar completo en Supabase SQL Editor.
-- Idempotente y compatible con vendedores existentes.
-- =========================================================

begin;

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
    case
      when v_store_id is null then 0::bigint
      else (
        select count(*)::bigint
        from public.store_products sp
        where sp.store_id = v_store_id
      )
    end,
    case
      when v_store_id is null then 0::bigint
      else (
        select count(*)::bigint
        from public.reservations r
        where r.store_id = v_store_id
      )
    end,
    case
      when v_store_id is null then 0::bigint
      else (
        select count(*)::bigint
        from public.reservations r
        where r.store_id = v_store_id
          and r.status::text = 'completed'
      )
    end,
    case
      when v_store_id is null then 0::bigint
      else (
        select coalesce(sum(ri.quantity), 0)::bigint
        from public.reservations r
        join public.reservation_items ri on ri.reservation_id = r.id
        where r.store_id = v_store_id
          and r.status::text = 'completed'
      )
    end;
end;
$$;

revoke all on function public.get_my_merchant_setup_status() from public;
revoke all on function public.get_my_merchant_setup_status() from anon;
grant execute on function public.get_my_merchant_setup_status()
  to authenticated;

-- Los productos considerados vendidos/entregados deben proceder únicamente
-- de reservas completadas.
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

revoke all on function public.get_merchant_analytics(
  uuid, timestamptz, timestamptz
) from public;
revoke all on function public.get_merchant_analytics(
  uuid, timestamptz, timestamptz
) from anon;
grant execute on function public.get_merchant_analytics(
  uuid, timestamptz, timestamptz
) to authenticated;

commit;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'get_my_merchant_setup_status',
    'get_merchant_analytics'
  )
order by routine_name;
