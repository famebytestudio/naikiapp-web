alter table public.ngo_details
  add column id_card_number text,
  add column id_card_document_path text,
  add column official_link text,
  add constraint ngo_details_id_card_number_length
    check (id_card_number is null or char_length(id_card_number) between 5 and 50),
  add constraint ngo_details_official_link_http
    check (official_link is null or official_link ~* '^https?://');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ngo-id-cards',
  'ngo-id-cards',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ngo_id_cards_insert_own" on storage.objects;
create policy "ngo_id_cards_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'ngo-id-cards'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid()) and role = 'ngo'
    )
  );

drop policy if exists "ngo_id_cards_select_own_or_admin" on storage.objects;
create policy "ngo_id_cards_select_own_or_admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'ngo-id-cards'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_current_user_admin())
    )
  );

create or replace function public.is_current_user_active_ngo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.ngo_details details on details.profile_id = profile.id
    where profile.id = (select auth.uid())
      and profile.role = 'ngo'
      and profile.disabled_at is null
      and details.verification_status = 'verified'
  );
$$;

revoke all on function public.is_current_user_active_ngo() from public;
grant execute on function public.is_current_user_active_ngo() to authenticated;

create or replace function public.set_ngo_verification_as_admin(
  p_ngo_id uuid,
  p_verification_status public.ngo_verification
)
returns public.ngo_details
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_details public.ngo_details%rowtype;
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception 'Only administrators can review charity registrations';
  end if;
  if p_verification_status is null or p_verification_status not in ('verified', 'rejected') then
    raise exception 'Choose whether to approve or reject the charity registration';
  end if;

  if p_verification_status = 'verified' and not exists (
    select 1
    from public.ngo_details details
    where details.profile_id = p_ngo_id
      and nullif(trim(details.registration_number), '') is not null
      and nullif(trim(details.id_card_number), '') is not null
      and nullif(trim(details.id_card_document_path), '') is not null
      and nullif(trim(details.official_link), '') is not null
  ) then
    raise exception 'Complete registration, ID card, and official link evidence before approval';
  end if;

  update public.ngo_details
  set verification_status = p_verification_status,
      verified_by = case when p_verification_status = 'verified' then auth.uid() else null end,
      verified_at = case when p_verification_status = 'verified' then now() else null end,
      updated_at = now()
  where profile_id = p_ngo_id
  returning * into changed_details;

  if not found then
    raise exception 'Charity registration not found';
  end if;

  insert into public.admin_moderation_log (actor_id, target_type, target_id, action)
  values (
    auth.uid(),
    'ngo',
    p_ngo_id,
    case when p_verification_status = 'verified' then 'ngo_verified' else 'ngo_rejected' end
  );

  return changed_details;
end;
$$;

revoke all on function public.set_ngo_verification_as_admin(uuid, public.ngo_verification) from public;
grant execute on function public.set_ngo_verification_as_admin(uuid, public.ngo_verification) to authenticated;
