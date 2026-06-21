-- =========================================================
-- AHORRAPE - NOTIFICACIONES PERSISTENTES DE RESERVAS
-- Ejecutar el archivo completo en Supabase SQL Editor.
-- No genera notificaciones retroactivas.
-- =========================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  event_key text not null,
  type text not null default 'info'
    check (type in ('success', 'info', 'warning', 'error')),
  title text not null,
  message text not null,
  href text not null,
  viewed_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_user_reservation_event_unique
    unique (user_id, reservation_id, event_key)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at)
  where read_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon;
revoke all on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (viewed_at, read_at) on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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
        user_id,
        reservation_id,
        event_key,
        type,
        title,
        message,
        href
      )
      values (
        v_merchant_id,
        new.id,
        'reservation_created',
        'info',
        'Nueva reserva recibida',
        'Tienes una nueva reserva en ' || coalesce(v_store_name, 'tu tienda') || '.',
        '/merchant/reservations?reservation=' || new.id::text
      )
      on conflict (user_id, reservation_id, event_key) do nothing;
    end if;

    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  v_status := new.status::text;
  v_cancelled_by := coalesce(new.cancelled_by::text, '');

  if v_status = 'cancelled' and v_cancelled_by = 'customer' then
    if v_merchant_id is not null then
      insert into public.notifications (
        user_id,
        reservation_id,
        event_key,
        type,
        title,
        message,
        href
      )
      values (
        v_merchant_id,
        new.id,
        'customer_cancelled',
        'warning',
        'Reserva cancelada por el cliente',
        'El cliente canceló una reserva de ' || coalesce(v_store_name, 'tu tienda') || '.',
        '/merchant/reservations?reservation=' || new.id::text
      )
      on conflict (user_id, reservation_id, event_key) do nothing;
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
    user_id,
    reservation_id,
    event_key,
    type,
    title,
    message,
    href
  )
  values (
    new.customer_user_id,
    new.id,
    'status_' || v_status,
    v_type,
    v_title,
    v_message,
    '/customer/reservations?reservation=' || new.id::text
  )
  on conflict (user_id, reservation_id, event_key) do nothing;

  return new;
end;
$$;

drop trigger if exists reservation_notifications_trigger
  on public.reservations;

create trigger reservation_notifications_trigger
after insert or update of status on public.reservations
for each row execute function public.create_reservation_notification();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

commit;

select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'notifications';

select
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'notifications'
order by policyname;
