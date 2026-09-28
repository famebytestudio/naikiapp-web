alter table public.donations
	add column if not exists actual_kg numeric;

alter table public.donations
	add constraint donations_actual_kg_check
	check (actual_kg is null or actual_kg >= 0)
	not valid;

alter table public.donation_status_log
	add column if not exists actual_kg numeric;

alter table public.donation_status_log
	add constraint donation_status_log_actual_kg_check
	check (actual_kg is null or actual_kg >= 0)
	not valid;

create or replace function public.update_donation_status(p_donation_id uuid, p_next_status text, p_actual_kg numeric default null)
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
	where id = p_donation_id and claimed_by = auth.uid()
	for update;

	if not found then
		raise exception 'Claim not found';
	end if;

	if p_next_status = 'delivered' and (p_actual_kg is null or p_actual_kg < 0) then
		raise exception 'Actual delivered kilograms are required when marking a donation as delivered';
	end if;

	if (locked_donation.status, p_next_status) not in (('claimed', 'picked_up'), ('picked_up', 'delivered')) then
		raise exception 'Status must advance from claimed to picked up to delivered';
	end if;

	update public.donations
	set status = p_next_status,
		actual_kg = case when p_next_status = 'delivered' then p_actual_kg else actual_kg end,
		updated_at = status_time
	where id = p_donation_id
	returning * into locked_donation;

	insert into public.donation_status_log (donation_id, status, actual_kg, changed_by, changed_at)
	values (p_donation_id, p_next_status, case when p_next_status = 'delivered' then p_actual_kg else null end, auth.uid(), status_time);

	return locked_donation;
end;
$$;

revoke all on function public.update_donation_status(uuid, text, numeric) from public;
grant execute on function public.update_donation_status(uuid, text, numeric) to authenticated;
