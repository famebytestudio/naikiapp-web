-- NaikiApp 0009 - the claim workflow
--
-- Migration 0005 was meant to own the claim transition and is 0 bytes on this
-- branch, so nothing in the schema let a charity move a listing. Combined with
-- 0003's policies - which grant UPDATE only to the donor (edit, cancel) and, in
-- 0006, to an admin (removal) - the consequence was that a verified charity
-- could read the feed and could not act on it:
--
--   available -> claimed            unreachable
--   claimed   -> picked_up          unreachable
--   picked_up -> delivered          unreachable
--
-- donations.claimed_by stayed null forever, which also made 0007's two
-- donor-visibility policies dead code, since they both key off a claim.
--
-- Written fresh against this branch's schema rather than restored from
-- origin/main, because main's 0005 was already superseded by main's own 0008
-- and both were written against a different one. Four places they disagree:
--
--   1. claimed_by. 0003 points the column at ngo_details(id), so the function
--      resolves the caller's ngo_details row and stores that. main's 0005
--      assigns auth.uid(), which is a profile id and would not satisfy the
--      foreign key.
--   2. The expiry column. main's 0005 reads expires_at; 0003 created expiry_at,
--      so main's version raises "column expires_at does not exist" on the first
--      claim anyone attempts.
--   3. The log. 0004 already installs donations_log_status_change, an AFTER
--      UPDATE trigger that writes from_status, to_status and actor_id for every
--      status change. main's 0005 and Rida's both insert a log row by hand from
--      the same UPDATE, which here would write two entries per transition.
--      Nothing in this file inserts into status_log.
--   4. delivered_kg. Rida's branch calls the measured weight actual_kg and
--      records it in a separate migration from the transition; 0003 created
--      delivered_kg. Recording the weight in the same statement that sets
--      status = 'delivered' is deliberate - see mark_delivered below.
--
-- Also not carried over: donation_claims, which main and Rida both create.
-- donations.claimed_by already records the claim, and 0004's
-- status_log_select_involved reads the timeline off donations rather than off a
-- claim table, so a second table would be a third copy of the same fact.
--
-- NOT PORTED, DELIBERATELY: main's 0008 drops the verification gate and lets any
-- profile with role = 'ngo' claim. This branch cannot do that - 0003's
-- donations_select_verified_ngo requires ngo_details.verification = 'verified',
-- so a role-only gate here would let a charity claim a listing it is not
-- permitted to read, and would leave the admin verification queue in 0006 with
-- nothing to gate. Whichever way the branches are reconciled, the gate and the
-- feed policy have to move together.

-- ================================================================ helpers

/*
  The ngo_details row belonging to the calling profile, and only if it is
  verified. Null for a signed-out caller, a donor, and a charity whose
  registration is still pending or was rejected.

  One definition of "which charity is calling", because all three functions
  below need it and they must not be able to disagree about it.

  SECURITY DEFINER because a pending charity cannot SELECT its own ngo_details
  row under 0002's policies in any state other than... well, it can - but the
  function is also called from contexts where the caller's own row is not the
  only thing in play, and running as the table owner keeps the lookup to a
  single indexed read with the RLS machinery out of the way.

  This cannot be used to read a row. It takes no argument and returns an id,
  which is a pointer the caller already owns: it is derived from auth.uid(),
  which comes from the verified JWT rather than from anything the client sends.
  The `verified` test is deliberately inside this function rather than in the
  three call sites, so that tightening it later is one edit and not three.
*/
create or replace function public.caller_ngo_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select n.id
  from public.ngo_details n
  where n.profile_id = (select auth.uid())
    and n.verification = 'verified';
$$;

comment on function public.caller_ngo_id() is
  'RLS helper: the verified ngo_details id of the calling charity, or null.';

revoke all on function public.caller_ngo_id() from public;
grant execute on function public.caller_ngo_id() to authenticated;

/*
  The workflow, as one immutable predicate rather than a rule restated in three
  functions.

  Deliberately NOT including available -> expired or any terminal state. The
  pickup window lapsing is expire-listings' job, running as the service role,
  and a cancelled listing is the donor's - both of which go through their own
  paths so that they cannot be reached by a charity holding a claim.

  immutable, so it cannot read a table and cannot depend on the session. The
  transition rule is a property of the schema, not of who is asking.
*/
create or replace function public.donation_transition_allowed(
  p_from public.donation_status,
  p_to public.donation_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('available'::public.donation_status, 'claimed'::public.donation_status),
    ('claimed'::public.donation_status, 'picked_up'::public.donation_status),
    ('picked_up'::public.donation_status, 'delivered'::public.donation_status)
  );
$$;

comment on function public.donation_transition_allowed(public.donation_status, public.donation_status) is
  'The only forward steps in the workflow: available->claimed->picked_up->delivered.';

revoke all on function public.donation_transition_allowed(public.donation_status, public.donation_status)
  from public;
grant execute on function public.donation_transition_allowed(public.donation_status, public.donation_status)
  to authenticated;

-- ============================================================== functions

/*
  Claim a listing.

  The product promise is "the listing locks, so nobody else can take it", and
  FOR UPDATE is where that promise is kept. Two charities calling this at the
  same instant are serialised on the row lock: the first commits, the second
  wakes up, re-reads status = 'claimed' under the lock and raises. There is no
  window in which both hold a claim, and there is no client-side check that a
  client could skip.

  This is why the function exists rather than a policy. 0003's
  donations_update_own_available matches on status = 'available' in its USING
  clause, which decides visibility at statement start - two concurrent UPDATEs
  both find the row visible and both write. RLS alone cannot make this atomic.

  The local variable is named claim_time rather than claimed_at because the
  latter is a column of the table this function updates, and in an UPDATE SET
  list the bare name would be ambiguous.
*/
create or replace function public.claim_donation(p_donation_id uuid)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_ngo uuid;
  locked public.donations%rowtype;
  claim_time timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to claim a listing.';
  end if;

  caller_ngo := public.caller_ngo_id();
  if caller_ngo is null then
    raise exception 'Only a verified charity can claim a listing.';
  end if;

  select * into locked
  from public.donations
  where id = p_donation_id
  for update;

  if not found then
    raise exception 'That listing does not exist.';
  end if;

  -- Checked here, and not left to guard_donation_removal, which would refuse the
  -- UPDATE too but with a message about the listing having been changed rather
  -- than about the thing the charity was trying to do.
  if locked.removed_at is not null then
    raise exception 'That listing was taken down by NaikiApp and cannot be claimed.';
  end if;

  if locked.status <> 'available' then
    raise exception 'That listing has already been claimed.';
  end if;

  /*
    The pickup window, not the expiry date. 0003 constrains pickup_end_at to
    close before expiry_at, so the window is the earlier of the two and is the
    moment a charity genuinely can no longer collect. expire-listings sets
    status = 'expired' on its own cadence and there is a lag between the window
    closing and that sweep running; without this check a charity could claim in
    that gap and be handed a pickup that has already shut.
  */
  if locked.pickup_end_at <= claim_time then
    raise exception 'The pickup window for that listing has closed.';
  end if;

  if not public.donation_transition_allowed(locked.status, 'claimed'::public.donation_status) then
    raise exception 'That listing cannot be claimed from its current status.';
  end if;

  update public.donations
  set status = 'claimed',
      claimed_by = caller_ngo,
      claimed_at = claim_time,
      updated_at = claim_time
  where id = p_donation_id
  returning * into locked;

  /*
    No INSERT into status_log. donations_log_status_change from 0004 is an AFTER
    UPDATE trigger and has already written the available -> claimed row, with
    actor_id taken from auth.uid() - which still resolves to the calling charity
    inside a SECURITY DEFINER function, because it reads the verified JWT rather
    than the current database role. Writing a second row here would double every
    transition in the donor's timeline.
  */

  return locked;
end;
$$;

revoke all on function public.claim_donation(uuid) from public;
grant execute on function public.claim_donation(uuid) to authenticated;

-- -------------------------------------------------------------- picked up

/*
  The charity has the food. Only the charity that holds the claim can say so -
  the test is against donations.claimed_by, which holds an ngo_details id, not
  against auth.uid(), which holds a profile id. 0007's donor_may_read_charity_profile
  joins the two in the same direction, so the column's meaning is fixed by that
  too.
*/
create or replace function public.mark_picked_up(p_donation_id uuid)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_ngo uuid;
  locked public.donations%rowtype;
  pickup_time timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to update a listing.';
  end if;

  caller_ngo := public.caller_ngo_id();
  if caller_ngo is null then
    raise exception 'Only a verified charity can move a listing it has claimed.';
  end if;

  select * into locked
  from public.donations
  where id = p_donation_id
  for update;

  if not found then
    raise exception 'That listing does not exist.';
  end if;

  if locked.claimed_by is distinct from caller_ngo then
    raise exception 'Only the charity that claimed a listing can move it.';
  end if;

  if locked.removed_at is not null then
    raise exception 'That listing was taken down by NaikiApp and cannot be moved.';
  end if;

  if not public.donation_transition_allowed(locked.status, 'picked_up'::public.donation_status) then
    raise exception 'A listing can only be marked picked up after it has been claimed.';
  end if;

  update public.donations
  set status = 'picked_up',
      picked_up_at = pickup_time,
      updated_at = pickup_time
  where id = p_donation_id
  returning * into locked;

  return locked;
end;
$$;

revoke all on function public.mark_picked_up(uuid) from public;
grant execute on function public.mark_picked_up(uuid) to authenticated;

-- -------------------------------------------------------------- delivered

/*
  The handover, and the only moment in the whole workflow at which a kilogram
  becomes real.

  The measured weight is a REQUIRED parameter rather than an optional one, and
  it is written in the same statement that sets status = 'delivered'. That is
  the difference between a measurement and an estimate, and it is why Rida's
  branch splitting this across two migrations is not copied here: if the weight
  were recorded separately from the transition, a listing could sit at
  'delivered' with no weight on it, and summariseImpact() falls back to
  estimated_kg when delivered_kg is null - so the estimate would quietly take
  the measured number's place in every aggregate and in the donor's own timeline,
  which cites delivered_kg on the delivered step precisely to avoid that.

  The null case is the one worth catching here. donations has
  `check (delivered_kg is null or delivered_kg > 0)`, so zero and a negative
  weight are already refused by the table - but NULL passes that check, because
  it was written to allow a listing that has not been delivered yet. A caller
  passing null would therefore commit the transition and leave the row with no
  measured weight on it, which is the exact failure this signature exists to
  prevent: summariseImpact() falls back to estimated_kg, so the estimate would
  take the measurement's place in every aggregate and in the donor's timeline.
  Zero and negative are re-checked alongside it only so all three are refused
  with one message naming the actual problem.

  No requirement that the pickup window has passed. A charity is allowed to hand
  over early, and whether it did so promptly is not the database's business.
*/
create or replace function public.mark_delivered(p_donation_id uuid, p_measured_kg numeric)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_ngo uuid;
  locked public.donations%rowtype;
  handover_time timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to update a listing.';
  end if;

  caller_ngo := public.caller_ngo_id();
  if caller_ngo is null then
    raise exception 'Only a verified charity can complete a listing it has claimed.';
  end if;

  if p_measured_kg is null or p_measured_kg <= 0 then
    raise exception 'Record how many kilograms were actually delivered before marking this listing delivered.';
  end if;

  select * into locked
  from public.donations
  where id = p_donation_id
  for update;

  if not found then
    raise exception 'That listing does not exist.';
  end if;

  if locked.claimed_by is distinct from caller_ngo then
    raise exception 'Only the charity that claimed a listing can complete it.';
  end if;

  if locked.removed_at is not null then
    raise exception 'That listing was taken down by NaikiApp and cannot be completed.';
  end if;

  if not public.donation_transition_allowed(locked.status, 'delivered'::public.donation_status) then
    raise exception 'A listing can only be marked delivered after it has been picked up.';
  end if;

  update public.donations
  set status = 'delivered',
      delivered_at = handover_time,
      delivered_kg = p_measured_kg,
      updated_at = handover_time
  where id = p_donation_id
  returning * into locked;

  return locked;
end;
$$;

revoke all on function public.mark_delivered(uuid, numeric) from public;
grant execute on function public.mark_delivered(uuid, numeric) to authenticated;

-- =============================================================== the guard

/*
  The claim columns belong to the charity holding the claim, and RLS cannot say
  so.

  0008 pinned claimed_by and claimed_at on INSERT and on
  donations_update_own_available. It could not finish the job, because the third
  policy that lets a donor write to their own row is donations_cancel_own, whose
  WITH CHECK pins only donor_id and status = 'cancelled'. A donor with an
  available listing matches that policy's USING clause, so a donor CAN reach
  claimed_by - either fabricating a claim on a listing nobody claimed, or, worse,
  clearing the claim on a genuinely claimed listing they are cancelling, which
  destroys the record of which charity was on its way to collect.

  Nor can the fix be another WITH CHECK. USING sees the old row and WITH CHECK
  sees only the new one, so there is no way to write "the claim must be
  unchanged" - the constraint needs both rows. This is the same wall 0006 hit
  with removed_at, and it took the same answer: enforce it in a BEFORE UPDATE
  trigger, where both rows are in scope.

  One rule for all five columns. claimed_by/claimed_at/picked_up_at/
  delivered_at/delivered_kg are the facts the workflow produces, so a change to
  any of them has to come from the charity that holds the claim. That single
  test covers the pickup and handover timestamps as well, which no policy
  mentions and no client has any business setting.

  The permit test requires the caller to be a verified charity AND the new
  claimed_by to be that charity's own ngo_details row. Both halves matter:
  requiring a non-null caller is what stops a donor clearing a claim to null,
  which would otherwise match caller_ngo_id()'s null on both sides and be
  permitted by accident.
*/
create or replace function public.guard_donation_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller_ngo uuid;
  claim_touched boolean;
begin
  claim_touched :=
    new.claimed_by is distinct from old.claimed_by
    or new.claimed_at is distinct from old.claimed_at
    or new.picked_up_at is distinct from old.picked_up_at
    or new.delivered_at is distinct from old.delivered_at
    or new.delivered_kg is distinct from old.delivered_kg;

  -- An ordinary donor edit or cancel, or any change that leaves the workflow's
  -- own columns alone. Nothing here has to be checked.
  if not claim_touched then
    return new;
  end if;

  caller_ngo := public.caller_ngo_id();

  /*
    Two halves, and the second is the one that was missing first time round.

    new.claimed_by must be the caller's own ngo_details row - so a charity
    cannot assert a claim on another charity's behalf, and a donor (whose
    caller_ngo is null) cannot assert one at all.

    AND, if the listing already carries a claim, that claim must already be the
    caller's. Without this a verified charity could take over a listing another
    charity had claimed: setting claimed_by to its own id satisfies the first
    half on its own, because that is exactly what it is asking for. mark_picked_up
    and mark_delivered already refuse a listing they do not hold, so this is not
    the only defence - but the trigger is what stops the column itself moving,
    and the functions are the thing most likely to be rewritten later.

    old.claimed_by is null covers the ordinary case of claiming something that is
    still available.
  */
  if coalesce((select auth.role()) = 'service_role', false)
     or (
       caller_ngo is not null
       and new.claimed_by is not distinct from caller_ngo
       and (old.claimed_by is null or old.claimed_by is not distinct from caller_ngo)
     ) then
    return new;
  end if;

  raise exception 'Only the verified charity that claimed this listing can change its pickup or delivery.'
    using errcode = '42501';
end;
$$;

create trigger donations_guard_claim
  before update on public.donations
  for each row execute function public.guard_donation_claim();

-- Runs alongside guard_donation_removal from 0006, not instead of it: that one
-- covers removed_at/removed_by/removal_reason, this one covers claimed_by,
-- claimed_at, picked_up_at, delivered_at and delivered_kg. An admin touching both
-- sets in one statement is permitted by both, which is the point - the two
-- triggers answer different questions.
--
-- claim_donation above is permitted by this guard because it sets
-- claimed_by = caller_ngo_id() for the calling charity. 0009 does not stamp
-- claimed_at from the trigger; it passes now() explicitly, so that the timestamp
-- a claim records is the same instant it checked the pickup window against,
-- rather than a second now() a few microseconds later.

-- ------------------------------------------------------------------- notes

-- guard_donation_claim is what makes the three functions above safe to expose.
-- Without it they would still be the only sanctioned path to a claim, but the
-- claim columns would remain writable by the donor through donations_cancel_own
-- - see the note above the trigger, and 0008 for the INSERT and edit paths it
-- closes alongside.
--
-- Replacing Rida's update_donation_status(uuid, text, numeric) rather than
-- extending it. Three reasons, all of which are about what the signature can
-- express:
--
--   1. text for a status means the transition table is the only thing rejecting
--      a bad value, and it rejects it with a generic message. public.donation_status
--      makes the database refuse 'pickedup' or 'DELIVERED' outright.
--   2. p_actual_kg defaulted to null, so marking a listing delivered without a
--      weight was expressible. Here the parameter is required to exist.
--   3. It matched on `claimed_by = auth.uid()`, which is the profile-id
--      assumption this branch does not use.
--
-- Her NGO-side call sites will need repointing at claim_donation,
-- mark_picked_up and mark_delivered. The mapping is one to one:
--
--   update_donation_status(id, 'picked_up')   -> mark_picked_up(id)
--   update_donation_status(id, 'delivered', kg) -> mark_delivered(id, kg)
--
-- UNRESOLVED, and not decided here: if an admin removes a listing that a charity
-- has already collected, guard_donation_removal in 0006 freezes the row and
-- both mark_picked_up and mark_delivered refuse it - so food that physically
-- reached people cannot be recorded as rescued. 0006 says the freeze is
-- deliberate ("A removed listing is frozen. Only an admin may touch it, at
-- all"), and 0006 also refuses removal from picked_up onward, so the only
-- reachable case is a removal during the claimed window. Whether the charity
-- should still be able to complete a delivery it has already made is a policy
-- call about whether a moderation action also forfeits the impact credit, and
-- it is not mine to make.
--
-- Still open from 0008, and now unblocked: donations carries no column-level
-- grant, so a donor can set estimated_kg on their own available listing, which
-- becomes an impact number if a charity later delivers. The full column set is
-- now known - the donor's edit fields, status/cancelled_at for a cancellation,
-- the three removal columns for an admin, and nothing at all for these three
-- functions, which are SECURITY DEFINER and write past RLS. Narrowing the
-- table-level UPDATE to that union is the fix; it is not in this file because it
-- changes what a future client may send in a single UPDATE, which is a decision
-- about the call shape rather than about the schema.