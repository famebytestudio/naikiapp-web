alter table public.donation_status_log
	add column if not exists actual_kg numeric;

alter table public.donation_status_log
	add constraint donation_status_log_actual_kg_check
	check (actual_kg is null or actual_kg >= 0)
	not valid;

drop function if exists public.update_donation_status(uuid, text);

create or replace function public.log_donation_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.status is distinct from old.status then
		insert into public.donation_status_log (donation_id, from_status, to_status, actor_id, actual_kg)
		values (
			new.id,
			old.status,
			new.status,
			auth.uid(),
			case when new.status = 'delivered' then new.delivered_kg else null end
		);
	end if;
	return new;
end;
$$;

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

	if p_next_status = 'delivered' and (p_actual_kg is null or p_actual_kg < 0) then
		raise exception 'Actual delivered kilograms are required when marking a donation as delivered';
	end if;

	if (locked_donation.status::text, p_next_status) not in (('claimed', 'picked_up'), ('picked_up', 'delivered')) then
		raise exception 'Status must advance from claimed to picked up to delivered';
	end if;

	update public.donations
	set status = p_next_status::public.donation_status,
		delivered_kg = case when p_next_status = 'delivered' then p_actual_kg else delivered_kg end,
		updated_at = status_time
	where id = p_donation_id
	returning * into locked_donation;

	return locked_donation;
end;
$$;

revoke all on function public.update_donation_status(uuid, text, numeric) from public;
grant execute on function public.update_donation_status(uuid, text, numeric) to authenticated;
