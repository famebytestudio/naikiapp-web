create table if not exists public.donation_status_log (
	id bigint generated always as identity primary key,
	donation_id uuid not null references public.donations(id) on delete cascade,
	status text not null check (status in ('available', 'claimed', 'picked_up', 'delivered', 'expired')),
	changed_by uuid references public.profiles(id) on delete set null,
	changed_at timestamptz not null default now()
);

create index if not exists donation_status_log_donation_idx
	on public.donation_status_log (donation_id, changed_at desc);

alter table public.donation_status_log enable row level security;
