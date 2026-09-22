create table if not exists public.donations (
	id uuid primary key default gen_random_uuid(),
	donor_id uuid references auth.users(id) on delete set null,
	donor_name text,
	is_anonymous boolean not null default false,
	food text not null,
	food_type text not null default 'Other',
	quantity numeric not null default 0 check (quantity >= 0),
	unit text not null default 'kg',
	kg numeric not null default 0 check (kg >= 0),
	city text not null,
	area text not null,
	address text not null,
	pickup_start timestamptz not null,
	pickup_end timestamptz not null,
	expires_at timestamptz not null,
	description text,
	status text not null default 'available' check (status in ('available', 'claimed', 'picked_up', 'delivered', 'expired')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint valid_pickup_window check (pickup_end >= pickup_start),
	constraint valid_expiry check (expires_at >= pickup_end)
);

create index if not exists donations_available_expiry_idx on public.donations (status, expires_at);
alter table public.donations enable row level security;

create policy "Anyone can view available donations"
	on public.donations for select
	using (status = 'available' and expires_at > now());

create policy "Authenticated donors can create donations"
	on public.donations for insert to authenticated
	with check (donor_id = auth.uid());

create policy "Donors can update their donations"
	on public.donations for update to authenticated
	using (donor_id = auth.uid())
	with check (donor_id = auth.uid());

alter table public.donations replica identity full;
alter publication supabase_realtime add table public.donations;
