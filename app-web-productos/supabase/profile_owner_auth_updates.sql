-- =========================================================
-- AHORRAPE - PROFILE, OWNER DATA AND AUTH UPDATES
-- Run this file in Supabase SQL Editor before testing the new auth/profile UI.
-- It is idempotent and keeps old columns for compatibility.
-- =========================================================

begin;

alter table if exists public.profiles
add column if not exists first_name text;

alter table if exists public.profiles
add column if not exists last_name text;

alter table if exists public.stores
add column if not exists description text;

update public.profiles
set
  first_name = coalesce(
    nullif(btrim(first_name), ''),
    nullif(split_part(btrim(full_name), ' ', 1), '')
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

update public.stores s
set description = b.description
from public.businesses b
where s.business_id = b.id
  and b.description is not null
  and btrim(b.description) <> ''
  and (
    s.description is null
    or btrim(s.description) = ''
  );

create or replace function public.handle_new_auth_user_profile_v2()
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
    btrim(concat_ws(' ', v_first_name, v_last_name)),
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
    role = coalesce(public.profiles.role, excluded.role);

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created_profile_v2'
  ) then
    create trigger on_auth_user_created_profile_v2
    after insert on auth.users
    for each row execute function public.handle_new_auth_user_profile_v2();
  end if;
end;
$$;

commit;

-- Quick audit:
select
  'profiles_columns' as check_name,
  count(*) filter (where column_name = 'first_name') as has_first_name,
  count(*) filter (where column_name = 'last_name') as has_last_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('first_name', 'last_name');

select
  'stores_description' as check_name,
  count(*) filter (where column_name = 'description') as has_description
from information_schema.columns
where table_schema = 'public'
  and table_name = 'stores'
  and column_name = 'description';
