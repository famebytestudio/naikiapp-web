alter table public.ngo_details
  add column if not exists needs_info boolean not null default false,
  add column if not exists review_note text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
  clean_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  clean_organisation text := nullif(trim(new.raw_user_meta_data ->> 'organisation'), '');
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'ngo' then 'ngo'::public.user_role
    else 'donor'::public.user_role
  end;

  insert into public.profiles (id, full_name, organisation, phone, role)
  values (
    new.id,
    clean_name,
    clean_organisation,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    requested_role
  )
  on conflict (id) do nothing;

  if requested_role = 'ngo' then
    insert into public.ngo_details (
      profile_id,
      organisation,
      registration_number,
      id_card_number,
      official_link,
      verification_status
    ) values (
      new.id,
      coalesce(clean_organisation, 'Charity organisation'),
      nullif(trim(new.raw_user_meta_data ->> 'registration_number'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'id_card_number'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'official_link'), ''),
      'pending'
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.submit_ngo_registration_evidence(
  p_id_card_document_path text,
  p_registration_number text,
  p_id_card_number text,
  p_official_link text
)
returns public.ngo_details
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_details public.ngo_details%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to submit NGO evidence';
  end if;
  if p_id_card_document_path is null
    or split_part(p_id_card_document_path, '/', 1) <> auth.uid()::text
    or not exists (
      select 1
      from storage.objects
      where bucket_id = 'ngo-id-cards'
        and name = p_id_card_document_path
    ) then
    raise exception 'Upload a valid ID document to your private NGO folder first';
  end if;
  if nullif(trim(p_registration_number), '') is null
    or nullif(trim(p_id_card_number), '') is null
    or nullif(trim(p_official_link), '') is null
    or p_official_link !~* '^https?://' then
    raise exception 'A registration number, representative ID number, and valid official link are required';
  end if;

  update public.ngo_details details
  set id_card_document_path = p_id_card_document_path,
      registration_number = trim(p_registration_number),
      id_card_number = trim(p_id_card_number),
      official_link = trim(p_official_link),
      verification_status = 'pending',
      needs_info = false,
      review_note = null,
      updated_at = now()
  where details.profile_id = auth.uid()
    and details.verification_status <> 'verified'
  returning * into changed_details;

  if not found then
    raise exception 'No resubmittable NGO registration was found';
  end if;

  return changed_details;
end;
$$;

revoke all on function public.submit_ngo_registration_evidence(text, text, text, text) from public;
grant execute on function public.submit_ngo_registration_evidence(text, text, text, text) to authenticated;

drop policy if exists "ngo_id_cards_delete_own" on storage.objects;
create policy "ngo_id_cards_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'ngo-id-cards'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.review_ngo_registration(
  p_ngo_id uuid,
  p_decision text,
  p_note text default null
)
returns public.ngo_details
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_details public.ngo_details%rowtype;
  clean_note text := nullif(trim(p_note), '');
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception 'Only administrators can review charity registrations';
  end if;
  if p_decision is null or p_decision not in ('approve', 'reject', 'request_info') then
    raise exception 'Choose approve, reject, or request more information';
  end if;
  if p_decision <> 'approve' and clean_note is null then
    raise exception 'Add a review note when rejecting or requesting information';
  end if;
  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'Review notes must be 1000 characters or fewer';
  end if;
  if p_decision = 'approve' and not exists (
    select 1 from public.ngo_details details
    where details.profile_id = p_ngo_id
      and nullif(trim(details.registration_number), '') is not null
      and nullif(trim(details.id_card_number), '') is not null
      and nullif(trim(details.id_card_document_path), '') is not null
      and nullif(trim(details.official_link), '') is not null
  ) then
    raise exception 'Complete registration, ID card, and official link evidence before approval';
  end if;

  update public.ngo_details
  set verification_status = case
        when p_decision = 'approve' then 'verified'::public.ngo_verification
        when p_decision = 'reject' then 'rejected'::public.ngo_verification
        else 'pending'::public.ngo_verification
      end,
      needs_info = p_decision = 'request_info',
      review_note = clean_note,
      verified_by = case when p_decision = 'approve' then auth.uid() else null end,
      verified_at = case when p_decision = 'approve' then now() else null end,
      updated_at = now()
  where profile_id = p_ngo_id
  returning * into changed_details;

  if not found then
    raise exception 'Charity registration not found';
  end if;

  insert into public.admin_moderation_log (actor_id, target_type, target_id, action, reason)
  values (
    auth.uid(),
    'ngo',
    p_ngo_id,
    case p_decision
      when 'approve' then 'ngo_verified'
      when 'reject' then 'ngo_rejected'
      else 'ngo_information_requested'
    end,
    clean_note
  );

  return changed_details;
end;
$$;

revoke all on function public.review_ngo_registration(uuid, text, text) from public;
grant execute on function public.review_ngo_registration(uuid, text, text) to authenticated;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 500),
  donation_id uuid references public.donations (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;
grant select on public.user_notifications to authenticated;
grant update (read_at) on public.user_notifications to authenticated;

drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own"
  on public.user_notifications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_notifications_update_own" on public.user_notifications;
create policy "user_notifications_update_own"
  on public.user_notifications
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.notify_donation_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ngo_profile_id uuid;
  donor_title text;
  donor_message text;
  ngo_title text;
  ngo_message text;
  notification_type text;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'claimed' then
      notification_type := 'donation_claimed';
      donor_title := 'Your donation was claimed';
      donor_message := format('%s has been claimed and is being arranged for pickup.', new.title);
      ngo_title := 'You claimed a donation';
      ngo_message := format('Your claim for %s is confirmed.', new.title);
    elsif new.status = 'picked_up' then
      notification_type := 'donation_picked_up';
      donor_title := 'Your donation was picked up';
      donor_message := format('%s has been picked up by the charity.', new.title);
      ngo_title := donor_title;
      ngo_message := donor_message;
    elsif new.status = 'delivered' then
      notification_type := 'donation_delivered';
      donor_title := 'Your donation was delivered';
      donor_message := format('%s was delivered to the community.', new.title);
      ngo_title := donor_title;
      ngo_message := donor_message;
    elsif new.status = 'cancelled' and new.claimed_by is not null then
      notification_type := 'donation_cancelled';
      donor_title := 'A claimed donation was cancelled';
      donor_message := format('%s was cancelled by the donor.', new.title);
      ngo_title := donor_title;
      ngo_message := donor_message;
    else
      return new;
    end if;

    insert into public.user_notifications (user_id, event_type, title, message, donation_id)
    values (new.donor_id, notification_type, donor_title, donor_message, new.id);

    if new.claimed_by is not null then
      select profile_id into ngo_profile_id
      from public.ngo_details
      where id = new.claimed_by;
      if ngo_profile_id is not null then
        insert into public.user_notifications (user_id, event_type, title, message, donation_id)
        values (
          ngo_profile_id,
          notification_type,
          ngo_title,
          ngo_message,
          new.id
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists donations_notify_status_change on public.donations;
create trigger donations_notify_status_change
  after insert or update of status on public.donations
  for each row execute function public.notify_donation_status_change();

create or replace function public.notify_ngo_review_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_title text;
  notification_message text;
begin
  if new.verification_status = 'pending'
    and not new.needs_info
    and old.needs_info then
    return new;
  end if;

  if new.verification_status is not distinct from old.verification_status
    and new.needs_info is not distinct from old.needs_info
    and new.review_note is not distinct from old.review_note then
    return new;
  end if;

  if new.verification_status = 'verified' then
    notification_title := 'Charity registration approved';
    notification_message := 'Your organisation is verified. You can now browse and claim donations.';
  elsif new.needs_info then
    notification_title := 'More information requested';
    notification_message := coalesce(new.review_note, 'Please sign in and update your registration evidence.');
  else
    notification_title := 'Charity registration not approved';
    notification_message := coalesce(new.review_note, 'Contact NaikiApp support for next steps.');
  end if;

  insert into public.user_notifications (user_id, event_type, title, message)
  values (
    new.profile_id,
    case when new.verification_status = 'verified' then 'ngo_approved'
      when new.needs_info then 'ngo_information_requested'
      else 'ngo_rejected' end,
    notification_title,
    notification_message
  );
  return new;
end;
$$;

drop trigger if exists ngo_details_notify_review_change on public.ngo_details;
create trigger ngo_details_notify_review_change
  after update of verification_status, needs_info, review_note on public.ngo_details
  for each row execute function public.notify_ngo_review_change();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end
$$;
