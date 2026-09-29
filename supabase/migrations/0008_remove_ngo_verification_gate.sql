drop policy if exists "donations_select_verified_ngo" on public.donations;
drop policy if exists "donations_select_ngo" on public.donations;
drop policy if exists "Anyone can view available donations" on public.donations;

create policy "donations_select_ngo"
	on public.donations for select to authenticated
	using (
		status = 'available'
		and exists (
			select 1 from public.profiles profile
			where profile.id = auth.uid() and profile.role = 'ngo'
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
	claim_time timestamptz := now();
begin
	if auth.uid() is null then
		raise exception 'Authentication is required to claim a donation';
	end if;

	if not exists (
		select 1 from public.profiles profile
		where profile.id = auth.uid() and profile.role = 'ngo'
	) then
		raise exception 'Only NGO accounts can claim donations';
	end if;

	select * into locked_donation
	from public.donations
	where id = p_donation_id
	for update;

	if not found then
		raise exception 'Donation not found';
	end if;

	if locked_donation.status <> 'available' or locked_donation.expires_at <= claim_time then
		raise exception 'Donation is no longer available';
	end if;

	update public.donations
	set status = 'claimed', claimed_by = auth.uid(), claimed_at = claim_time, updated_at = claim_time
	where id = p_donation_id;

	insert into public.donation_claims (donation_id, ngo_id, claimed_at)
	values (p_donation_id, auth.uid(), claim_time);

	insert into public.donation_status_log (donation_id, status, changed_by, changed_at)
	values (p_donation_id, 'claimed', auth.uid(), claim_time);

	return query select p_donation_id, auth.uid(), claim_time;
end;
$$;

revoke all on function public.claim_donation(uuid) from public;
grant execute on function public.claim_donation(uuid) to authenticated;