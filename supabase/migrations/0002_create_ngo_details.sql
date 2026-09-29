<<<<<<<<< Temporary merge branch 1
create table if not exists public.ngo_details (
	profile_id uuid primary key references public.profiles(id) on delete cascade,
	organization_name text not null,
	verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists ngo_details_verified_idx
	on public.ngo_details (profile_id)
	where verification_status = 'verified';

alter table public.ngo_details enable row level security;

create policy "NGOs can view their own details"
	on public.ngo_details for select to authenticated
	using (profile_id = auth.uid());
=========
-- NaikiApp 0002 - ngo_details
--
-- Registration + verification state for charities. donations.claimed_by
-- references this table, and the "verified NGOs can see available listings"
-- policy in 0003 reads verification, so it has to exist before donations.

create type public.ngo_verification as enum ('pending', 'verified', 'rejected');

create table public.ngo_details (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  organisation text not null,
  registration_number text,
  verification public.ngo_verification not null default 'pending',
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The NGO feed is always filtered by verification state.
create index ngo_details_verification_idx on public.ngo_details (verification);
create index ngo_details_profile_idx on public.ngo_details (profile_id);

create trigger ngo_details_touch_updated_at
  before update on public.ngo_details
  for each row execute function public.touch_updated_at();

alter table public.ngo_details enable row level security;

create policy "ngo_details_select_own"
  on public.ngo_details
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- An NGO can register itself, and the WITH CHECK pins it to 'pending' so the
-- registration cannot arrive pre-verified.
create policy "ngo_details_insert_own"
  on public.ngo_details
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and verification = 'pending'
    and verified_by is null
  );

-- Deliberately no UPDATE policy: verification is an admin action, performed
-- with the service role. Revoking update keeps that true at the privilege
-- layer too, so the column cannot be edited by a verified NGO either.
revoke update, delete on public.ngo_details from authenticated;
>>>>>>>>> Temporary merge branch 2
