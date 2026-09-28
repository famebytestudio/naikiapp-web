-- NaikiApp 0006 - admin moderation
--
-- Two write surfaces an admin needs that 0001-0005 deliberately left closed:
-- deciding an NGO registration, and taking a listing down. Both ship here
-- together with the privileges and the policies that keep them admin-only,
-- because an allow rule that arrives without its guard is the failure mode
-- this schema is built to avoid.
--
-- Nothing in this file renames or adds a donation_status value. The status
-- contract with the NGO-side branch is:
--
--   available -> claimed -> picked_up -> delivered
--   + expired (pickup window lapsed) and cancelled (donor pulled it)
--
-- A removal is therefore NOT a seventh status. It is a separate fact about the
-- row, so a listing keeps the status it had, keeps its status_log history, and
-- cannot be quietly used to edit the platform's impact totals.

-- ======================================================= NGO verification

-- A rejection has to say something, otherwise the charity is told only that it
-- failed and cannot tell what to fix. Mirrors the note column in 0004.
alter table public.ngo_details
  add column review_note text
  check (review_note is null or char_length(review_note) <= 500);

-- 0002 did `revoke update ... from authenticated` and said verification was a
-- service-role action, so that an NGO could not approve itself. That is the
-- right rule, but it also locked admins out of the browser, so the blanket
-- revoke is replaced by a column grant scoped to the two fields a decision is
-- actually made of.
--
-- verified_by and verified_at are deliberately NOT granted: the trigger below
-- stamps them from auth.uid(), so a client cannot record a decision in
-- somebody else's name. organisation and registration_number are the
-- charity's own submission and stay read-only to everyone, admin included -
-- a decision is made on what was submitted, not by editing it.
grant update (verification, review_note) on public.ngo_details to authenticated;

create policy "ngo_details_update_admin"
  on public.ngo_details
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- delete stays revoked from 0002. Rejecting a registration is a state, not a
-- deletion, so the decision and its reason survive the charity's account.

-- Who decided, and when, is recorded by the database rather than by the
-- request. The same pattern as log_donation_status_change in 0004: a trigger,
-- not a client-supplied value.
create or replace function public.stamp_ngo_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.verification is distinct from old.verification then
    new.verified_by := (select auth.uid());
    new.verified_at := now();
  end if;
  return new;
end;
$$;

create trigger ngo_details_stamp_verification
  before update on public.ngo_details
  for each row execute function public.stamp_ngo_verification();

-- ======================================================== listing removal

alter table public.donations
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id) on delete set null,
  -- Free text rather than an enum, because the presets in the admin UI are a
  -- shortcut and an admin must still be able to write what is actually wrong.
  add column removal_reason text
    check (removal_reason is null or char_length(removal_reason) <= 200);

-- The moderation queue opens on the removed rows.
create index donations_removed_idx
  on public.donations (removed_at desc)
  where removed_at is not null;

-- A removed listing is off the feed, so a charity can no longer be sent to a
-- pickup that was reported as fake or unsafe. donations_select_own is
-- deliberately left alone: the donor still sees their own row, and still sees
-- why it was taken down.
drop policy "donations_select_verified_ngo" on public.donations;

create policy "donations_select_verified_ngo"
  on public.donations
  for select
  to authenticated
  using (
    status = 'available'
    and removed_at is null
    and exists (
      select 1
      from public.ngo_details n
      where n.profile_id = (select auth.uid())
        and n.verification = 'verified'
    )
  );

-- The admin's whole write surface on donations, and nothing more.
--
-- The status list is in both clauses. USING is what makes the row visible to
-- the update, so the check is "a listing nobody has collected yet". WITH CHECK
-- is what the row has to look like afterwards, and repeating the same status
-- list means an admin cannot ride this policy to walk a listing to picked_up
-- or delivered, or to write delivered_kg - the impact numbers stay the
-- charity's to report, not the moderator's to edit.
--
-- There is still no DELETE policy. Removal is a state on the row, never a
-- deletion, so the audit trail outlives the decision.
create policy "donations_update_admin_removal"
  on public.donations
  for update
  to authenticated
  using (
    status in ('available', 'claimed')
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    status in ('available', 'claimed')
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

/*
  RLS is not quite enough here, and this trigger is why.

  Policies for UPDATE are OR'ed together, so a row that donations_update_own
  available matches is writable by its donor - columns and all. Without a
  second guard, a donor could clear removed_at on their own listing and put a
  reported listing back on the feed, and could rewrite the text of the evidence
  an admin acted on. Narrowing the table-level UPDATE grant to stop that would
  mean revoking it from donors too, which would take the donor's edit and
  cancel policies down with it and collide with the NGO-side writes in
  migration 0005. So the rule is enforced where the columns actually change:

    1. A removed listing is frozen. Only an admin may touch it, at all.
    2. removed_by is stamped, not submitted. Whoever removes a row is a fact
       about the platform, and the request cannot assert it.
    3. The service role is exempt, so the expire-listings sweep can still
       walk a removed listing to 'expired' without tripping over rule 1.
*/
create or replace function public.guard_donation_removal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  permitted boolean;
  removal_touched boolean;
begin
  removal_touched :=
    new.removed_at is distinct from old.removed_at
    or new.removed_by is distinct from old.removed_by
    or new.removal_reason is distinct from old.removal_reason;

  -- An ordinary donor edit, an edit-and-cancel, or the expiry sweep on a row
  -- that is not removed: nothing here has to be checked.
  if old.removed_at is null and not removal_touched then
    return new;
  end if;

  select (
    (select auth.role()) = 'service_role'
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  ) into permitted;

  if not coalesce(permitted, false) then
    raise exception 'This listing was taken down by NaikiApp and can no longer be changed.'
      using errcode = '42501';
  end if;

  if new.removed_at is distinct from old.removed_at then
    if new.removed_at is null then
      -- Restored. The stamp describes a removal that is no longer in force.
      new.removed_by := null;
    else
      new.removed_by := (select auth.uid());
    end if;
  end if;

  return new;
end;
$$;

create trigger donations_guard_removal
  before update on public.donations
  for each row execute function public.guard_donation_removal();

-- No impact on the totals, deliberately. Removal is refused from picked_up
-- onward, and only a delivered row carries a delivered_kg, so there is no path
-- by which moderating a listing changes a kilogram of reported impact.
