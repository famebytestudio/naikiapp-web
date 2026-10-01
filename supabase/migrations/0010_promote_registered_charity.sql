-- NaikiApp 0010 - promoting a registered charity to the ngo role
--
-- 0001 says ngo and admin are "promoted later (NGO registration, or by an
-- admin) and never by the user themselves", and 0002's insert policy checks
-- only profile_id - not the role - so registering a charity is open to any
-- signed-in account. But no migration in this repo ever performed the
-- promotion. So the two halves of the design did not meet:
--
--   ngo_details.verification   -> reaches 'verified' when an admin approves
--   profiles.role              -> stays 'donor' forever
--
-- The failure is not at the database. donations_select_verified_ngo in 0003
-- reads ngo_details rather than the role, so RLS opens the feed correctly. It
-- is RequireRole that fails: it routes on profiles.role, so a charity that had
-- registered, supplied its registration number and been approved by an admin
-- was sent to their donor home and could never reach the feed page at all.
--
-- The mock hides this, because authApi.js writes role: 'ngo' onto the profile
-- row at registration. Only a real database shows it.
--
-- Done as a trigger rather than as a fourth admin write path, because the
-- promotion is a consequence of registering, not a decision anybody makes. An
-- admin approving a charity does not need to remember to do a second thing, and
-- there is no state in which the charity is approved but still routed as a donor.

create or replace function public.promote_registered_charity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  /*
    SECURITY DEFINER because the inserting client has no UPDATE privilege on
    profiles.role: 0001 revoked UPDATE on the table and granted it back for
    full_name, organisation, phone and is_anonymous only, precisely so that a
    donor could not promote themselves. Without SECURITY DEFINER this trigger
    would fail the insert, and - because it is an AFTER trigger - it would fail
    it after the ngo_details row had already been written, leaving a
    registration with no profile to go with it.

    'ngo' is a literal here, never read from new or from anything the client
    sent, so there is no path by which this can set 'admin'. A trigger body is
    not something a caller can parameterise.

    The role = 'donor' guard makes this idempotent and stops it demoting
    somebody: an admin who also registers a charity stays an admin, and a
    charity re-registering does not disturb its own row.
  */
  update public.profiles
  set role = 'ngo'
  where id = new.profile_id
    and role = 'donor';

  return new;
end;
$$;

create trigger ngo_details_promote_profile
  after insert on public.ngo_details
  for each row execute function public.promote_registered_charity();

comment on function public.promote_registered_charity() is
  'Sets the registering profile to the ngo role. Never admin; never demotes.';

-- Backfill, for accounts that registered before this migration ran. The
-- predicate is the same one the trigger enforces, so the two cannot disagree
-- about who counts as a charity.
update public.profiles p
set role = 'ngo'
where p.role = 'donor'
  and exists (
    select 1 from public.ngo_details n where n.profile_id = p.id
  );

-- ------------------------------------------------------------------- notes
--
-- Holding the ngo role grants nothing at the database layer, which is what makes
-- this safe to do automatically. Every policy that admits a charity reads
-- ngo_details.verification, not the role:
--
--   donations_select_verified_ngo   0003   requires verification = 'verified'
--   caller_ngo_id()                  0009   requires verification = 'verified'
--
-- So a charity that has registered but not yet been approved holds role = 'ngo'
-- and can still read nothing. The role is a routing decision, not a grant, and
-- RequireRole's requireVerifiedNgo is what turns it into the pending page -
-- PendingVerificationState, which carries the admin's review_note.
--
-- A charity may still donate. donations_insert_own in 0003 checks only
-- donor_id = auth.uid(), so nothing about the role narrows a charity's ability
-- to post food of their own.
--
-- NOT IN SYNC WITH origin/main, and this is the disagreement that matters most
-- between the branches: main's 0008 drops the verification gate entirely and
-- lets any profile with role = 'ngo' claim a listing. Combined with this
-- migration that rule would promote every registered charity straight to
-- claiming, admin approval or not - which is the opposite of what 0006's
-- verification queue exists to do. One branch has to give: either main's
-- role-only gate, or the verification gate this branch enforces in 0003, 0006
-- and 0009. They cannot both hold, and the fix is not additive on either side.