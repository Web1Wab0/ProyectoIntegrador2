-- =========================================================
-- AHORRAPE - SALIDA PUSH DESDE SUPABASE
-- Ejecutar DESPUÉS de comprehensive_expansion.sql y de publicar Vercel.
-- Sustituye los valores de ejemplo antes de ejecutar.
-- =========================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Ejecutar una sola vez con valores reales:
-- select vault.create_secret(
--   'https://app-web-productos.vercel.app/api/push/send',
--   'push_dispatch_url'
-- );
-- select vault.create_secret(
--   'REEMPLAZAR_CON_PUSH_DISPATCH_SECRET',
--   'push_dispatch_secret'
-- );

create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'push_dispatch_url'
  order by created_at desc
  limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'push_dispatch_secret'
  order by created_at desc
  limit 1;

  if v_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('notification_id', new.id)
  );

  return new;
exception when others then
  raise log 'AhorraPe push dispatch failed for notification %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists notification_push_dispatch on public.notifications;
create trigger notification_push_dispatch
after insert on public.notifications
for each row execute function public.dispatch_notification_push();
