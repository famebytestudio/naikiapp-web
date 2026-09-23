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
