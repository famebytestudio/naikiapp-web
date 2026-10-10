alter table public.donations
  add column pickup_latitude numeric(9, 6),
  add column pickup_longitude numeric(9, 6),
  add column delivery_radius_km smallint not null default 10,
  add constraint donations_delivery_radius_check
    check (delivery_radius_km = 10),
  add constraint donations_pickup_coordinates_check
    check (
      pickup_latitude is not null
      and pickup_longitude is not null
      and pickup_latitude between -90 and 90
      and pickup_longitude between -180 and 180
    ) not valid;

drop function if exists public.claim_donation(uuid);

create function public.claim_donation(
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

create or replace function public.create_donation_as_admin(p_listing jsonb)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_donation public.donations%rowtype;
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception 'Only administrators can create donations';
  end if;

  insert into public.donations (
    donor_id, title, description, food_type, quantity_value, quantity_unit,
    estimated_kg, expiry_at, pickup_start_at, pickup_end_at, city, area,
    address, pickup_latitude, pickup_longitude, delivery_radius_km,
    contact_name, contact_phone, status
  ) values (
    auth.uid(),
    p_listing ->> 'title',
    nullif(p_listing ->> 'description', ''),
    (p_listing ->> 'food_type')::public.food_type,
    (p_listing ->> 'quantity_value')::integer,
    (p_listing ->> 'quantity_unit')::public.quantity_unit,
    (p_listing ->> 'estimated_kg')::numeric,
    (p_listing ->> 'expiry_at')::timestamptz,
    (p_listing ->> 'pickup_start_at')::timestamptz,
    (p_listing ->> 'pickup_end_at')::timestamptz,
    p_listing ->> 'city',
    p_listing ->> 'area',
    p_listing ->> 'address',
    (p_listing ->> 'pickup_latitude')::numeric,
    (p_listing ->> 'pickup_longitude')::numeric,
    10,
    p_listing ->> 'contact_name',
    p_listing ->> 'contact_phone',
    'available'
  )
  returning * into created_donation;

  insert into public.admin_moderation_log (actor_id, target_type, target_id, action)
  values (auth.uid(), 'donation', created_donation.id, 'donation_created');

  return created_donation;
end;
$$;

revoke all on function public.create_donation_as_admin(jsonb) from public;
grant execute on function public.create_donation_as_admin(jsonb) to authenticated;

create or replace function public.update_donation_as_admin(p_donation_id uuid, p_listing jsonb)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_donation public.donations%rowtype;
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception 'Only administrators can edit donations';
  end if;

  update public.donations
  set title = case when p_listing ? 'title' then p_listing ->> 'title' else title end,
      description = case when p_listing ? 'description' then nullif(p_listing ->> 'description', '') else description end,
      food_type = case when p_listing ? 'food_type' then (p_listing ->> 'food_type')::public.food_type else food_type end,
      quantity_value = case when p_listing ? 'quantity_value' then (p_listing ->> 'quantity_value')::integer else quantity_value end,
      quantity_unit = case when p_listing ? 'quantity_unit' then (p_listing ->> 'quantity_unit')::public.quantity_unit else quantity_unit end,
      estimated_kg = case when p_listing ? 'estimated_kg' then (p_listing ->> 'estimated_kg')::numeric else estimated_kg end,
      expiry_at = case when p_listing ? 'expiry_at' then (p_listing ->> 'expiry_at')::timestamptz else expiry_at end,
      pickup_start_at = case when p_listing ? 'pickup_start_at' then (p_listing ->> 'pickup_start_at')::timestamptz else pickup_start_at end,
      pickup_end_at = case when p_listing ? 'pickup_end_at' then (p_listing ->> 'pickup_end_at')::timestamptz else pickup_end_at end,
      city = case when p_listing ? 'city' then p_listing ->> 'city' else city end,
      area = case when p_listing ? 'area' then p_listing ->> 'area' else area end,
      address = case when p_listing ? 'address' then p_listing ->> 'address' else address end,
      pickup_latitude = case when p_listing ? 'pickup_latitude' then (p_listing ->> 'pickup_latitude')::numeric else pickup_latitude end,
      pickup_longitude = case when p_listing ? 'pickup_longitude' then (p_listing ->> 'pickup_longitude')::numeric else pickup_longitude end,
      contact_name = case when p_listing ? 'contact_name' then p_listing ->> 'contact_name' else contact_name end,
      contact_phone = case when p_listing ? 'contact_phone' then p_listing ->> 'contact_phone' else contact_phone end,
      updated_at = now()
  where id = p_donation_id
  returning * into changed_donation;

  if not found then
    raise exception 'Donation not found';
  end if;

  insert into public.admin_moderation_log (actor_id, target_type, target_id, action)
  values (auth.uid(), 'donation', p_donation_id, 'donation_updated');

  return changed_donation;
end;
$$;

revoke all on function public.update_donation_as_admin(uuid, jsonb) from public;
grant execute on function public.update_donation_as_admin(uuid, jsonb) to authenticated;
