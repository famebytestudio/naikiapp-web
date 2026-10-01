-- NaikiApp 0013 - the anonymity preference, enforced by the database
--
-- A donor can set profiles.is_anonymous. The requirement is that every surface
-- showing a donor to somebody else then reads "Anonymous Donor" - in NGO views
-- and in impact aggregates - and that the choice is respected throughout the
-- platform.
--
-- It was not. Here is why, and why the fix is a trigger rather than a column
-- grant or a client check.
--
--
-- The name an NGO reads is not on profiles
-- -----------------------------------------
--
-- The obvious approach is to hide profiles.full_name from charities, and it
-- already happens by accident: no policy in this schema lets a charity read a
-- donor's profiles row. profiles_select_own is own-or-admin, and
-- profiles_select_claiming_donor is the donor reading the charity. So a charity
-- cannot see the flag either - which is the actual blocker. A client cannot
-- honour a preference it is not allowed to read, and there is no honest client
-- fix. Something below the client has to read it.
--
-- And hiding profiles.full_name would not help anyway, because the name a
-- charity reads is not on profiles. donations carries its own copy:
--
--   contact_name  text not null check (char_length(trim(contact_name)) between 2 and 120)
--   contact_phone text not null check (char_length(trim(contact_phone)) between 7 and 20)
--
-- and donations_select_verified_ngo lets a verified charity read every available
-- listing, contact_name included. So the preference was set, stored, surfaced in
-- the donor's own navbar - and never consulted by anything that mattered. A
-- donor who ticked the box was still handing their name to every charity with a
-- verified account.
--
-- It also reproduced exactly in the mock, which is how it was caught: the
-- vendor@naikiapp.pk fixture is is_anonymous with the comment "Charities still
-- see 'Anonymous Donor' for this account", and three of its available listings
-- carried contact_name 'Rabia Noor'.
--
--
-- Why a trigger and not a view
-- ----------------------------
--
-- A view with a column list is the other way to mask a column in Postgres, and
-- 0007 declined it for registration_number with a stated reason. Here the same
-- option was available and rejected, for one specific reason: the NGO read path
-- is Rida's slice, and moving it from a table select to a function call is a
-- cross-branch change on top of an already-contested one.
--
-- Masking before the value is stored has a property the view does not. Once
-- contact_name reads "Anonymous Donor" in the row, no read path can leak it -
-- not a new component, not a new query, not a client that ships later. The
-- guarantee is in the table, so it holds for every caller at once. The cost is
-- stated plainly below: it is irreversible per listing.
--
--
-- What is masked, and what is not
-- -------------------------------
--
-- contact_name only. contact_phone is left alone deliberately: the donor's own
-- toggle copy in src/components/AnonymityToggle.jsx says "your contact details
-- are still shared so pickup can happen", and a van that cannot phone the
-- kitchen does not arrive. Anonymity here is about the name.
--
-- Nothing else is masked. An admin keeps the real name - ModerationCard renders
-- it and shows the preference next to it, because a moderation queue that reads
-- "Anonymous Donor" cannot act on a repeat offender - and the admin's access
-- comes from donations_select_admin plus profiles_select_own, both of which
-- test role = 'admin'. The override is reachable only from that surface, and it
-- is visible on the card rather than silent.
--
--
-- The impact aggregate
-- --------------------
--
-- Nothing to do, and the reason is worth keeping. src/utils/impact.js
-- summarises counts and kilograms and carries no identity column at all - there
-- is no donor name in an aggregate to leak. The public impact view that would
-- join donations to profiles to attribute a rescue to somebody is Rida's
-- (src/pages/Dashboard/ImpactDashboard.jsx is 0 bytes). Whoever builds it must
-- mask at the join, and this file gives them the function to call.

-- ============================================================ insert/update

-- Fires on the way in, and on any later edit of contact_name, because
-- donations_update_own_available lets a donor rewrite contact_name on an
-- available listing. Without the UPDATE arm, an anonymous donor could unmask
-- themselves by saving the form.
--
-- SECURITY DEFINER, and the reason is about failure direction rather than
-- privilege. Run as the invoker, the inner SELECT on profiles is evaluated under
-- that role's RLS - which happens to admit a donor's own row, but admits nothing
-- for an insert performed on a donor's behalf by a seed script, an admin tool or
-- a migration, and a row that cannot be found is indistinguishable from a donor
-- who is not anonymous. That is a mask that fails open, silently, exactly when
-- nobody is looking. As SECURITY DEFINER the read is unconditional and the only
-- question is whether the donor asked to be anonymous.
--
-- Same reasoning as donor_claimed_this_ngo in 0007: bypassing RLS here is not a
-- way to widen visibility, because the row being read is named by new.donor_id
-- and the caller filter IS the authorization.
create or replace function public.mask_anonymous_donor_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  donor_is_anonymous boolean;
begin
  select p.is_anonymous into donor_is_anonymous
  from public.profiles p
  where p.id = new.donor_id;

  -- coalesce, not a bare if: no profile row at all means unknown, and unknown
  -- must not mean "show the name".
  if coalesce(donor_is_anonymous, false) then
    new.contact_name := 'Anonymous Donor';
  end if;

  return new;
end;
$$;

comment on function public.mask_anonymous_donor_contact() is
  'Replaces donations.contact_name with ''Anonymous Donor'' when the donating profile has is_anonymous. Enforces the anonymity preference at write time, because a row-level policy cannot hide a column.';

create trigger donations_mask_anonymous_donor
  before insert or update of contact_name on public.donations
  for each row execute function public.mask_anonymous_donor_contact();

-- Runs alongside donations_stamp_created (0012), donations_log_creation (0004)
-- and the rest. Ordering is alphabetical within each event, and
-- donations_mask_anonymous_donor precedes donations_stamp_created, so by the time
-- the AFTER INSERT trigger logs the row the name is already masked.

-- ======================================================== the toggle going on

-- The other half, and the half that is easy to miss: setting is_anonymous on a
-- profile does not touch donations, so without this a donor who ticks the box
-- keeps publishing their real name on every listing they have already posted.
-- That is the toggle being visibly wrong on the one screen the donor just used
-- to fix it.
create or replace function public.apply_anonymity_to_open_listings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rising edge only. Nothing to do when the toggle is already on, and the
  -- falling edge is deliberately not handled - see the note below.
  if new.is_anonymous and not coalesce(old.is_anonymous, false) then
    update public.donations d
    set contact_name = 'Anonymous Donor'
    where d.donor_id = new.id
      and d.status in ('available', 'claimed');
  end if;

  -- AFTER trigger: the return value is ignored, and null says so honestly.
  return null;
end;
$$;

comment on function public.apply_anonymity_to_open_listings() is
  'Re-masks contact_name on a donor''s open listings when they switch is_anonymous on.';

create trigger profiles_apply_anonymity
  after update on public.profiles
  for each row execute function public.apply_anonymity_to_open_listings();

-- SECURITY DEFINER because claimed is in the list and a donor cannot write a
-- claimed row: donations_update_own_available requires status = 'available', so
-- the claimed case would be blocked by the donor's own policy mid-statement. That
-- is a partial application of a privacy preference, which is worse than not
-- applying it, so the write has to be unconditional.
--
-- Only open statuses are re-masked. picked_up and delivered are left alone
-- deliberately: a charity that already collected the food did so having seen a
-- name, and rewriting that record now would contradict what actually happened.
-- The append-only log in status_log is untouched either way, so the transition
-- history still shows what was published at the time.
--
-- The falling edge is not implemented, and this is a real limitation rather than
-- an oversight. The real name was never stored on a masked listing, so turning
-- anonymity off cannot restore it, and inventing one from profiles.full_name
-- would put a name in front of charities that were told it would not be there.
-- Donations that the donor publishes after switching the toggle off do carry
-- their real name; the ones already masked stay masked.

-- ------------------------------------------------------------------- notes
--
-- This trigger writes through SECURITY DEFINER, which bypasses RLS. It touches
-- exactly one column on rows owned by exactly one donor, and it can only make a
-- name more private, never less - there is no path in which running it discloses
-- something a caller could not already read.
--
-- Still open, and not addressed here:
--
--   There is no way to create an admin, so no admin can actually see the
--   exception this file preserves. See PROJECT.md section 4.
--
--   Nothing yet consumes is_anonymous for a *past* delivery. The aggregate in
--   src/utils/impact.js carries no identity column, so there is nothing to mask
--   today; the public impact view that would is Rida's.
--
--   contact_phone is still readable by any verified charity for any available
--   listing, by design, so a donor's phone number is public to the network while
--   their name is not. That is the intended trade for pickups working, but it is
--   a real disclosure and worth knowing about rather than discovering.
