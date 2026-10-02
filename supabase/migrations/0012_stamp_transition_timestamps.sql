-- NaikiApp 0012 - the platform records its own timestamps
--
-- The agreed contract is that create produces 'available' and cancel produces
-- 'cancelled'. That part already holds, and this file does not change it:
--
--   donations_insert_own          with check status = 'available'   (0003, pinned in 0008)
--   donations_update_own_available  with check status = 'available'  (0008)
--   donations_cancel_own          with check status = 'cancelled'   (0003)
--
-- What this file fixes is the fact that travels *with* each of those statuses.
-- Two columns on donations record when something happened, and on both the
-- create and the cancel path the database was trusting the client for them.
--
--
-- 1. A cancelled listing could carry no cancel time
--    ------------------------------------------------
--
-- donations_cancel_own checks donor_id = auth.uid() and status = 'cancelled'.
-- It does not require cancelled_at, and nothing else in the schema writes it -
-- grep the whole directory and cancelled_at appears only as a column definition
-- in 0003, a null pin on insert in 0008, and comments. So this is a legal row:
--
--   update donations set status = 'cancelled' where id = <mine>
--
-- status says cancelled, cancelled_at stays null. The mock does not produce
-- this state - src/lib/listingsApi.js cancel() always writes the timestamp - so
-- the two implementations quietly disagree about what a cancelled row looks
-- like.
--
-- The consequence is not cosmetic. src/utils/listingTimeline.js derives the
-- timeline from the timestamps on the row, and a step is emitted only when its
-- column is present. With cancelled_at null the cancelled step is skipped, so
-- the derived history ends one step earlier:
--
--   <StatusBadge>                ->  Cancelled
--   <StatusTimeline> summary     ->  Available - 20 Sept, 3:00 pm
--   <StatusTimeline> detail      ->  Posted and visible to verified charities.
--
-- Both are rendered by src/pages/Donor/ListingDetail.jsx, 30 lines apart. A
-- donor who has just called off a listing is told, on the same screen, that it
-- is still up and still visible to charities. That is the one sentence in this
-- whole area that is actively wrong rather than merely imprecise, which is why
-- it is worth a trigger.
--
-- The fix mirrors stamp_ngo_verification in 0006 exactly, and for the same
-- reason: 0006 stamps verified_by / verified_at because the admin decides the
-- verification, so the database records when. Here the donor decides the
-- cancellation, so the database records when - and the client is not asked for
-- a timestamp it has no business choosing.
--
--
-- 2. A posted listing could carry any created_at the donor liked
--    ------------------------------------------------------
--
-- created_at is `not null default now()`, but a default is a fallback, not a
-- constraint: any INSERT that names the column overrides it, and
-- donations_insert_own does not mention created_at. It is not pinned there
-- because 0008's pin list covers the workflow columns and this is not one of
-- them - it is a fact about the platform, exactly like the others.
--
-- This is the column the product is sorted by:
--
--   0003  create index donations_donor_created_idx on (donor_id, created_at desc)
--   mock  src/lib/listingsApi.js sorts on created_at in both the donor list and
--         the admin queue
--
-- So a donor could backdate a listing to bury it, or future-date it to sit at
-- the top of a queue that is ordered by age, and nothing in the schema objects.
-- updated_at is worse, being equally unpinned on insert while
-- donations_touch_updated_at is a before UPDATE trigger and so never sees an
-- INSERT at all.
--
--
-- What is NOT changed
-- ------------------
--
-- expiry_notified_at stays client-writable. It belongs to the expire-listings
-- sweep, which runs as service_role and bypasses RLS regardless, so pinning it
-- would buy nothing and the sweep would have to be re-plumbed to benefit.
--
-- id is not pinned here either. donations has no column-level UPDATE grant, so
-- a client *could* name id in an UPDATE, and neither policy stops it. In
-- practice it cannot succeed: donations_log_creation (0004) writes a status_log
-- row for every insert, status_log.donation_id references donations(id) with
-- no on update clause, so renaming a listing raises a foreign_key_violation
-- instead of quietly orphaning its history. That is a confusing error rather
-- than a safe one, and it is the reason to narrow the table-level UPDATE grant
-- to the known column union - a separate decision, noted in 0009 and not taken
-- here, because it changes what a client may send in one statement.
--
-- guard_donation_claim is untouched and does not need to be. It fires on every
-- UPDATE but short-circuits when none of claimed_by, claimed_at, picked_up_at,
-- delivered_at or delivered_kg moved, and a cancellation touches only status,
-- cancelled_at and updated_at. That was worth checking rather than assuming:
-- donation_transition_allowed deliberately omits available -> cancelled, so if
-- that table were consulted on a plain UPDATE the cancel path would be dead.
-- It is not - it is called only inside claim_donation, mark_picked_up and
-- mark_delivered, never from a trigger.

-- ================================================================== cancel

-- SECURITY INVOKER on purpose, like guard_donation_removal in 0006. This only
-- needs to see the row it is firing on, and it must stay out of the way of the
-- two guards that make the cancellation itself legal.
create or replace function public.stamp_donation_cancelled()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Overwrites rather than rejects, matching touch_updated_at and
  -- stamp_ngo_verification: the client does not get to choose this value, and a
  -- row that already had a cancelled_at is repaired rather than blocked.
  --
  -- is distinct from, not = , so re-saving an already-cancelled listing does
  -- not move the timestamp. There is no policy that lets a cancelled row change
  -- status again, so that branch is defensive only.
  if new.status is distinct from old.status
     and new.status = 'cancelled'::public.donation_status then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

comment on function public.stamp_donation_cancelled() is
  'Stamps cancelled_at when a listing is cancelled, so a cancelled row cannot exist without the fact that records when. Mirrors stamp_ngo_verification in 0006.';

create trigger donations_stamp_cancelled
  before update on public.donations
  for each row execute function public.stamp_donation_cancelled();

-- Fires alongside donations_touch_updated_at, donations_guard_removal and
-- donations_guard_claim rather than instead of any of them. All four answer a
-- different question, and the update policies are OR'ed between them, so none of
-- them constrains another.
--
-- Ordering does not matter here and is worth saying why. Postgres runs the
-- BEFORE UPDATE triggers in name order - guard_claim, guard_removal,
-- stamp_cancelled, touch_updated_at - and donations_log_status_change is AFTER,
-- so the append-only log sees the stamped value. It records old.status and
-- new.status rather than cancelled_at, so the ordering is belt and braces.

-- ================================================================== create

-- The insert-side counterpart. Both columns have a default, and a default is
-- only a fallback, so naming either one in the INSERT overrides it - and
-- donations_touch_updated_at is `before update`, so on an INSERT nothing
-- touches them at all.
create or replace function public.stamp_donation_created()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  new.updated_at := now();

  return new;
end;
$$;

comment on function public.stamp_donation_created() is
  'Forces created_at and updated_at on insert. Their defaults are only fallbacks, and created_at is the column the donor list and the admin queue are sorted by.';

create trigger donations_stamp_created
  before insert on public.donations
  for each row execute function public.stamp_donation_created();

-- Stamped before donations_log_creation, which is an AFTER INSERT trigger and
-- therefore already sees these values. The log records new.id and new.status,
-- not the timestamps, so again it does not depend on the order.

-- ------------------------------------------------------------------- notes
--
-- Both functions are plain triggers and need no grant: trigger functions are
-- invoked by the table owner on the caller's behalf and cannot be called
-- directly. They are deliberately NOT security definer - stamp_ngo_verification
-- and guard_donation_removal are not either, and there is nothing here for
-- auth.uid() or auth.role() to decide.
--
-- Unchanged by this file, and still worth restating:
--
--   There is no way to create an admin. Nine policies test role = 'admin' and
--   nothing can set it, so the admin surface is unreachable on a real database.
--   Bootstrap is an ops action - see PROJECT.md section 4.
--
--   expire-listings is a 0-byte tracked file, so 'expired' still has no
--   producer. This file adds no transition into 'expired' either, because a
--   sweep that does not exist cannot be given one.
