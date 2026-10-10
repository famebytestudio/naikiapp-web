alter table public.donations
  alter column delivery_radius_km set default 10,
  drop constraint if exists donations_pickup_coordinates_check;

update public.donations
set delivery_radius_km = 10
where delivery_radius_km <> 10;

alter table public.donations
  drop constraint if exists donations_delivery_radius_check,
  add constraint donations_delivery_radius_check check (delivery_radius_km = 10),
  add constraint donations_pickup_coordinates_check
    check (
      pickup_latitude is not null
      and pickup_longitude is not null
      and pickup_latitude between -90 and 90
      and pickup_longitude between -180 and 180
    ) not valid;

create or replace function public.claim_donation(
  p_donation_id uuid,
  p_ngo_latitude numeric,
  p_ngo_longitude numeric
)
returns table (donation_id uuid, ngo_id uuid, claimed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_donation public.donations%rowtype;
  ngo_detail_id uuid;
  claim_time timestamptz := now();
  distance_km numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to claim a donation';
  end if;
  if not (select public.is_current_user_active_ngo()) then
    raise exception 'Only active, verified NGOs can claim donations';
  end if;
  if p_ngo_latitude is null or p_ngo_latitude not between -90 and 90
    or p_ngo_longitude is null or p_ngo_longitude not between -180 and 180 then
    raise exception 'A valid NGO location is required to claim within the delivery range';
  end if;

  select details.id into ngo_detail_id
  from public.ngo_details details
  where details.profile_id = auth.uid();
  if ngo_detail_id is null then
    raise exception 'NGO registration details not found';
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
  if locked_donation.pickup_latitude is null or locked_donation.pickup_longitude is null then
    raise exception 'This donation does not have a pickup pin and cannot be claimed';
  end if;

  distance_km := 6371 * acos(least(1, greatest(-1,
    sin(radians(p_ngo_latitude::double precision))
      * sin(radians(locked_donation.pickup_latitude::double precision))
    + cos(radians(p_ngo_latitude::double precision))
      * cos(radians(locked_donation.pickup_latitude::double precision))
      * cos(radians((locked_donation.pickup_longitude - p_ngo_longitude)::double precision))
  )));
  if distance_km > locked_donation.delivery_radius_km then
    raise exception 'This donation is outside the 10 km delivery range';
  end if;

  update public.donations
  set status = 'claimed',
      claimed_by = ngo_detail_id,
      claimed_at = claim_time,
      updated_at = claim_time
  where id = p_donation_id;

  insert into public.donation_claims (donation_id, ngo_id, claimed_at)
  values (p_donation_id, auth.uid(), claim_time);

  return query select p_donation_id, auth.uid(), claim_time;
end;
$$;

revoke all on function public.claim_donation(uuid, numeric, numeric) from public;
grant execute on function public.claim_donation(uuid, numeric, numeric) to authenticated;
