<<<<<<<<< Temporary merge branch 1
create table if not exists public.profiles (
	id uuid primary key references auth.users(id) on delete cascade,
	full_name text,
	role text not null default 'donor' check (role in ('donor', 'ngo', 'admin')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
	on public.profiles for select to authenticated
	using (id = auth.uid());
=========
-- NaikiApp 0001 - profiles
--
-- One profile per auth user. The role lives on this table rather than in
-- auth.users metadata because RLS policies have to read it on every request,
-- and metadata is not a reliable source for an authorization decision.

create type public.user_role as enum ('donor', 'ngo', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  organisation text,
  phone text,
  role public.user_role not null default 'donor',
  -- The donor anonymity preference. This is the project's headline feature, so
  -- it lives in one place and every surface (NGO views AND impact aggregates)
  -- has to read it rather than denormalising the answer into donations.
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

-- Keep updated_at honest without trusting the client clock.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A new auth user gets a donor profile immediately, so someone can post their
-- first listing without a second onboarding step. ngo/admin are promoted later
-- (NGO registration, or by an admin) and never by the user themselves.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, organisation)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'organisation', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- A user reads their own profile; admins read all of them.
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or role = 'admin');

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column-level writes only. Without this, `role` would be updatable by the row
-- owner and any donor could promote themselves to admin through the API.
revoke insert, delete, update on public.profiles from authenticated;
grant update (full_name, organisation, phone, is_anonymous)
  on public.profiles to authenticated;

-- Profiles are only ever created by handle_new_user (security definer), so
-- there is deliberately no INSERT policy.
>>>>>>>>> Temporary merge branch 2
