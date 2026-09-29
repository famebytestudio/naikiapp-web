alter table public.donations
	add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
	add column if not exists claimed_at timestamptz;

create table if not exists public.donation_claims (
	donation_id uuid primary key references public.donations(id) on delete cascade,
	ngo_id uuid not null references public.profiles(id) on delete restrict,
	claimed_at timestamptz not null default now()
);

alter table public.donation_claims enable row level security;

create policy "NGOs can view their own claims"
	on public.donation_claims for select to authenticated
	using (ngo_id = auth.uid());

create policy "Claiming NGOs can view their donations"
	on public.donations for select to authenticated
	using (
		exists (
			select 1 from public.ngo_details details
			where details.id = donations.claimed_by
			and details.profile_id = (select auth.uid())
		)
	);

create policy "NGOs can view status history for their claims"
	on public.donation_status_log for select to authenticated
	using (
		exists (
			select 1 from public.donation_claims claim
			where claim.donation_id = donation_status_log.donation_id
			and claim.ngo_id = auth.uid()
		)
	);

create or replace function public.claim_donation(p_donation_id uuid)
returns table (donation_id uuid, ngo_id uuid, claimed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
	locked_donation public.donations%rowtype;
	verified_ngo_id uuid;
	claim_time timestamptz := now();
begin
	if auth.uid() is null then
		raise exception 'Authentication is required to claim a donation';
	end if;

	select details.id into verified_ngo_id
	from public.profiles profile
	join public.ngo_details details on details.profile_id = profile.id
	where profile.id = (select auth.uid())
		and profile.role = 'ngo'
		and details.verification = 'verified';

	if verified_ngo_id is null then
		raise exception 'Only verified NGOs can claim donations';
	end if;

	select * into locked_donation
	from public.donations
	where id = p_donation_id
	for update;

	if not found then
		raise exception 'Donation not found';
	end if;

	if locked_donation.status <> 'available' or locked_donation.expiry_at <= claim_time then
		raise exception 'Donation is no longer available';
	end if;

	update public.donations
	set status = 'claimed', claimed_by = verified_ngo_id, claimed_at = claim_time, updated_at = claim_time
	where id = p_donation_id;

	insert into public.donation_claims (donation_id, ngo_id, claimed_at)
	values (p_donation_id, auth.uid(), claim_time);

	return query select p_donation_id, auth.uid(), claim_time;
end;
$$;

revoke all on function public.claim_donation(uuid) from public;
grant execute on function public.claim_donation(uuid) to authenticated;

create or replace function public.update_donation_status(p_donation_id uuid, p_next_status text)
returns public.donations
language plpgsql
security definer
set search_path = public
as $$
declare
	locked_donation public.donations%rowtype;
	status_time timestamptz := now();
begin
	if auth.uid() is null then
		raise exception 'Authentication is required to update donation status';
	end if;

	select * into locked_donation
	from public.donations
	where id = p_donation_id
		and exists (
			select 1 from public.ngo_details details
			where details.id = donations.claimed_by
			and details.profile_id = (select auth.uid())
		)
	for update;

	if not found then
		raise exception 'Claim not found';
	end if;

	if (locked_donation.status::text, p_next_status) not in (('claimed', 'picked_up'), ('picked_up', 'delivered')) then
		raise exception 'Status must advance from claimed to picked up to delivered';
	end if;

	update public.donations
	set status = p_next_status::public.donation_status, updated_at = status_time
	where id = p_donation_id
	returning * into locked_donation;

	return locked_donation;
end;
$$;

revoke all on function public.update_donation_status(uuid, text) from public;
grant execute on function public.update_donation_status(uuid, text) to authenticated;
