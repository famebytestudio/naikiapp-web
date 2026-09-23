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
