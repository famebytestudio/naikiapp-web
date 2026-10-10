alter table public.profiles
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references public.profiles (id) on delete set null,
  add column if not exists disabled_reason text check (disabled_reason is null or char_length(disabled_reason) <= 500);

create table if not exists public.admin_moderation_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('donation', 'ngo')),
  target_id uuid not null,
  action text not null check (char_length(action) between 1 and 80),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

alter table public.admin_moderation_log enable row level security;
grant select on public.admin_moderation_log to authenticated;

create policy "admin_moderation_log_select_admin"
  on public.admin_moderation_log
  for select
  to authenticated
  using ((select public.is_current_user_admin()));

create or replace function public.set_ngo_disabled_as_admin(
  p_ngo_id uuid,
  p_disabled boolean,
  p_reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_profile public.profiles%rowtype;
  clean_reason text := nullif(trim(p_reason), '');
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception 'Only administrators can manage charity accounts';
  end if;
  if p_disabled is null then
    raise exception 'Choose whether to disable or enable this charity';
  end if;
  if clean_reason is not null and char_length(clean_reason) > 500 then
    raise exception 'The reason must be 500 characters or fewer';
  end if;

  update public.profiles
  set disabled_at = case when p_disabled then now() else null end,
      disabled_by = case when p_disabled then auth.uid() else null end,
      disabled_reason = case when p_disabled then clean_reason else null end,
      updated_at = now()
  where id = p_ngo_id
    and role = 'ngo'
    and ((p_disabled and disabled_at is null) or (not p_disabled and disabled_at is not null))
  returning * into changed_profile;

  if not found then
    select * into changed_profile
    from public.profiles
    where id = p_ngo_id and role = 'ngo';
    if not found then
      raise exception 'Charity account not found';
    end if;
    if (changed_profile.disabled_at is not null) = p_disabled then
      raise exception 'Charity account already has that access status';
    end if;
    raise exception 'Could not update charity account';
  end if;

  insert into public.admin_moderation_log (actor_id, target_type, target_id, action, reason)
  values (
    auth.uid(),
    'ngo',
    p_ngo_id,
    case when p_disabled then 'ngo_disabled' else 'ngo_enabled' end,
    clean_reason
  );

  return changed_profile;
end;
$$;

revoke all on function public.set_ngo_disabled_as_admin(uuid, boolean, text) from public;
grant execute on function public.set_ngo_disabled_as_admin(uuid, boolean, text) to authenticated;

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
    address, contact_name, contact_phone, status
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

create or replace function public.cancel_donation_as_admin(p_donation_id uuid)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_donation public.donations%rowtype;
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception 'Only administrators can moderate donations';
  end if;

  update public.donations
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where id = p_donation_id
    and status in ('available', 'claimed')
  returning * into changed_donation;

  if not found then
    raise exception 'Donation no longer exists or is not eligible for moderation';
  end if;

  insert into public.admin_moderation_log (actor_id, target_type, target_id, action, reason)
  values (auth.uid(), 'donation', p_donation_id, 'donation_removed', 'Soft-removed from the active feed');

  return changed_donation;
end;
$$;

revoke all on function public.cancel_donation_as_admin(uuid) from public;
grant execute on function public.cancel_donation_as_admin(uuid) to authenticated;

create or replace function public.is_current_user_active_ngo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'ngo'
      and disabled_at is null
  );
$$;

revoke all on function public.is_current_user_active_ngo() from public;
grant execute on function public.is_current_user_active_ngo() to authenticated;

drop policy if exists "donations_select_ngo" on public.donations;
create policy "donations_select_ngo"
  on public.donations
  for select
  to authenticated
  using (
    status = 'available'
    and (select public.is_current_user_active_ngo())
  );

drop policy if exists "Claiming NGOs can view their donations" on public.donations;
create policy "Claiming NGOs can view their donations"
  on public.donations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ngo_details details
      where details.id = donations.claimed_by
        and details.profile_id = (select auth.uid())
    )
    and (select public.is_current_user_active_ngo())
  );

drop policy if exists "NGOs can view their own claims" on public.donation_claims;
create policy "NGOs can view their own claims"
  on public.donation_claims
  for select
  to authenticated
  using (
    ngo_id = (select auth.uid())
    and (select public.is_current_user_active_ngo())
  );

drop policy if exists "status_log_select_involved" on public.donation_status_log;
create policy "status_log_select_involved"
  on public.donation_status_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.donations d
      where d.id = donation_status_log.donation_id
        and (
          d.donor_id = (select auth.uid())
          or (
            (select public.is_current_user_active_ngo())
            and d.claimed_by in (
              select n.id from public.ngo_details n
              where n.profile_id = (select auth.uid())
            )
          )
          or (select public.is_current_user_admin())
        )
    )
  );

create or replace function public.claim_donation(p_donation_id uuid)
returns table (donation_id uuid, ngo_id uuid, claimed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_donation public.donations%rowtype;
  ngo_detail_id uuid;
  claim_time timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to claim a donation';
  end if;
  if not (select public.is_current_user_active_ngo()) then
    raise exception 'Only active NGO accounts can claim donations';
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

  update public.donations
  set status = 'claimed', claimed_by = ngo_detail_id, claimed_at = claim_time, updated_at = claim_time
  where id = p_donation_id;

  insert into public.donation_claims (donation_id, ngo_id, claimed_at)
  values (p_donation_id, auth.uid(), claim_time);
  return query select p_donation_id, auth.uid(), claim_time;
end;
$$;

revoke all on function public.claim_donation(uuid) from public;
grant execute on function public.claim_donation(uuid) to authenticated;

create or replace function public.update_donation_status(
  p_donation_id uuid,
  p_next_status text,
  p_actual_kg numeric default null
)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_donation public.donations%rowtype;
  status_time timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to update donation status';
  end if;
  if not (select public.is_current_user_active_ngo()) then
    raise exception 'Only active NGO accounts can update claims';
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
