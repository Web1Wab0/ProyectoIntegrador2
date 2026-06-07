-- =========================================================
-- AHORRAPE - FIX AUTH SIGNUP PROFILE TRIGGER
-- Run this complete file in Supabase SQL Editor.
-- It fixes "Database error saving new user" caused by stale or duplicated
-- auth.users triggers that fail while creating public.profiles rows.
-- =========================================================

-- 1) Audit current auth.users triggers before changing anything.
select
  'before' as audit_stage,
  t.tgname as trigger_name,
  p.proname as function_name,
  n.nspname as function_schema,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = p.pronamespace
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal
order by t.tgname;

begin;

-- 2) Make sure the profile table/columns expected by the app exist.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists first_name text;

alter table public.profiles
add column if not exists last_name text;

alter table public.profiles
add column if not exists full_name text;

alter table public.profiles
add column if not exists phone text;

alter table public.profiles
add column if not exists role text not null default 'customer';

-- Keep existing data compatible with the newer first/last-name UI.
update public.profiles
set
  first_name = coalesce(
    nullif(btrim(first_name), ''),
    nullif(split_part(btrim(coalesce(full_name, '')), ' ', 1), '')
  ),
  last_name = coalesce(
    nullif(btrim(last_name), ''),
    nullif(regexp_replace(btrim(coalesce(full_name, '')), '^\S+\s*', ''), '')
  )
where full_name is not null
  and (
    first_name is null
    or btrim(first_name) = ''
    or last_name is null
    or btrim(last_name) = ''
  );

update public.profiles
set full_name = nullif(
  btrim(concat_ws(' ', nullif(first_name, ''), nullif(last_name, ''))),
  ''
)
where (
  full_name is null
  or btrim(full_name) = ''
)
and (
  nullif(first_name, '') is not null
  or nullif(last_name, '') is not null
);

update public.profiles
set role = 'customer'
where role is null
   or role not in ('customer', 'merchant', 'admin');

-- 3) Remove older profile-creation triggers that can conflict or reference
-- outdated columns. The final trigger is recreated below with the canonical
-- name expected by the original database script.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_profile_v2 on auth.users;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_phone text;
  v_role text;
begin
  v_full_name := nullif(
    btrim(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        ''
      )
    ),
    ''
  );

  v_first_name := nullif(
    btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')),
    ''
  );

  v_last_name := nullif(
    btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')),
    ''
  );

  if v_first_name is null and v_full_name is not null then
    v_first_name := nullif(split_part(v_full_name, ' ', 1), '');
  end if;

  if v_last_name is null and v_full_name is not null then
    v_last_name := nullif(regexp_replace(v_full_name, '^\S+\s*', ''), '');
  end if;

  v_full_name := nullif(
    btrim(
      coalesce(
        v_full_name,
        concat_ws(' ', nullif(v_first_name, ''), nullif(v_last_name, ''))
      )
    ),
    ''
  );

  v_phone := nullif(
    btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')),
    ''
  );

  v_role := case
    when new.raw_user_meta_data ->> 'role' in ('customer', 'merchant', 'admin')
      then new.raw_user_meta_data ->> 'role'
    else 'customer'
  end;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    full_name,
    phone,
    role
  )
  values (
    new.id,
    v_first_name,
    v_last_name,
    v_full_name,
    v_phone,
    v_role
  )
  on conflict (id) do update
  set
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    role = coalesce(excluded.role, public.profiles.role);

  return new;
exception
  when others then
    raise log 'AhorraPe handle_new_user failed for auth user %: %',
      new.id,
      sqlerrm;
    raise;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;

-- 4) Audit after fix. Expected: one profile trigger named on_auth_user_created
-- using public.handle_new_user.
select
  'after' as audit_stage,
  t.tgname as trigger_name,
  p.proname as function_name,
  n.nspname as function_schema,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = p.pronamespace
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal
order by t.tgname;

select
  'profiles_columns' as check_name,
  count(*) filter (where column_name = 'first_name') as has_first_name,
  count(*) filter (where column_name = 'last_name') as has_last_name,
  count(*) filter (where column_name = 'full_name') as has_full_name,
  count(*) filter (where column_name = 'phone') as has_phone,
  count(*) filter (where column_name = 'role') as has_role
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('first_name', 'last_name', 'full_name', 'phone', 'role');
