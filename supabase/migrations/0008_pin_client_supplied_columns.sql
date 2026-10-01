-- NaikiApp 0008 - the client may only assert what it is allowed to assert
--
-- 0001 column-scoped profiles and 0002 column-scoped ngo_details. donations
-- never got the same treatment: it carries no explicit GRANT, so the
-- authenticated role holds Supabase's default table-level ALL on it, and RLS -
-- which decides ROWS, never columns - is the only thing in the way.
--
-- 0003's policies therefore pin exactly two columns, donor_id and status. That
-- is enough to stop a donor reaching 'delivered' and writing their own impact
-- numbers, which is what the comment on donations_insert_own claims, and that
-- claim holds. But every lifecycle column alongside them was left writable:
--
--   INSERT  claimed_by, claimed_at, picked_up_at, delivered_at, delivered_kg,
--           cancelled_at, expiry_notified_at, removed_at, removed_by,
--           removal_reason
--
--   UPDATE  the same set, via donations_update_own_available
--
-- Three of those are facts about the platform rather than about the donor's
-- food, and a request must not be able to assert them:
--
--   1. A donor INSERTing with claimed_by set forges a claim. Forging it is not
--      merely cosmetic - status_log_select_involved in 0004 admits "the NGO
--      that claimed it" to the timeline, so writing an arbitrary ngo_details id
--      into your own listing hands that charity read access to a donation
--      history it was never involved in. 0007's donor-side policies then show
--      the donor a charity that never came.
--
--   2. A donor INSERTing with removed_at set permanently bricks their own
--      listing. guard_donation_removal in 0006 is a BEFORE UPDATE trigger, so
--      it never runs on the way in; the row lands already frozen and the donor's
--      own edit and cancel policies can never touch it again.
--
--   3. removed_by is stamped from auth.uid() on update precisely because
--      "who took this down" is not the requester's to assert. On INSERT nothing
--      stamped it, so the column could name any profile.
--
-- The fix is a policy pin rather than a column GRANT, because 0006 already
-- established why the column-grant route is not available here: revoking
-- table-level UPDATE on donations to stop a donor reaching removed_at would
-- take the donor's edit and cancel policies down with it, and the NGO-side
-- writes need a column set that migration 0005 owns. A WITH CHECK is additive,
-- touches no privilege, and composes with every existing policy - policies on
-- one table are OR'ed, so this only ever removes a capability nobody should
-- have had.
--
-- Nothing here renames a status, and no policy is added or removed. The donor's
-- legitimate write surface is exactly what 0003 documented: post a listing,
-- edit it while it is unclaimed, cancel it until pickup.

-- ================================================ donations: post a listing
--
-- Same name, reissued with the pin. Postgres keeps policies by name, so the
-- DROP/CREATE pair is how a policy is amended in a later migration - the same
-- thing 0006 did to donations_select_verified_ngo.

drop policy "donations_insert_own" on public.donations;

create policy "donations_insert_own"
  on public.donations
  for insert
  to authenticated
  with check (
    donor_id = (select auth.uid())
    and status = 'available'
    -- A listing is posted unclaimed and unremoved. Every other column below is
    -- either a fact about the workflow or a fact about the platform, and this
    -- request is not the source of either.
    and claimed_by is null
    and claimed_at is null
    and picked_up_at is null
    and delivered_at is null
    and delivered_kg is null
    and cancelled_at is null
    and expiry_notified_at is null
    and removed_at is null
    and removed_by is null
    and removal_reason is null
  );

-- ================================================ donations: edit a listing
--
-- The edit policy pins donor_id and status but not the claim columns, so a
-- donor editing their own available listing could set claimed_by and
-- claimed_at on it - the forgery above, reached through UPDATE instead of
-- INSERT.
--
-- The pin costs nothing, because there is no legitimate donor-driven
-- transition into a claim: donations.claimed_by is written only by
-- claim_donation() in migration 0005, which is SECURITY DEFINER and so is not
-- subject to this policy at all. A genuinely claimed listing also has status
-- 'claimed', which this policy's USING clause already excludes.
--
-- cancelled_at and expiry_notified_at are deliberately NOT pinned here. An
-- available listing being cancelled is a real outcome the donor drives, and
-- expiry_notified_at belongs to the expire-listings sweep, which is
-- service_role and bypasses RLS regardless.

drop policy "donations_update_own_available" on public.donations;

create policy "donations_update_own_available"
  on public.donations
  for update
  to authenticated
  using (donor_id = (select auth.uid()) and status = 'available')
  with check (
    donor_id = (select auth.uid())
    and status = 'available'
    and claimed_by is null
    and claimed_at is null
    -- 0006's guard_donation_removal already raises on these, but that trigger
    -- is a BEFORE UPDATE and this is the policy the row is checked against.
    -- Both hold, so neither is load-bearing alone.
    and removed_at is null
    and removed_by is null
    and removal_reason is null
  );

-- ================================================== ngo_details: register
--
-- 0002 pinned verification = 'pending' and verified_by is null on insert, but
-- left verified_at writable. stamp_ngo_verification in 0006 only stamps when
-- verification CHANGES on update, so nothing ever corrects it: a charity
-- could register as pending with verified_at already populated, and the row
-- would sit there claiming a decision was made on a date, by nobody, for an
-- application that is still waiting.

drop policy "ngo_details_insert_own" on public.ngo_details;

create policy "ngo_details_insert_own"
  on public.ngo_details
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and verification = 'pending'
    and verified_by is null
    and verified_at is null
  );

-- ======================================================== the NGO feed index
--
-- 0003's donations_available_idx is partial on `status = 'available'`, but 0006
-- added `and removed_at is null` to the policy that reads it. The index
-- therefore still carries every removed-but-available row, which is the one
-- part of the feed no caller wants. Redefined to match the policy predicate
-- exactly, so a table carrying a long tail of moderated rows stops scanning
-- them on every feed load.
--
-- Recreated rather than added: the old definition is a strict superset of this
-- one, so keeping both would cost write amplification and buy nothing.

drop index if exists public.donations_available_idx;

create index donations_available_idx on public.donations (expiry_at)
  where status = 'available' and removed_at is null;

-- ------------------------------------------------------------------- notes
--
-- NOT fixed here, and deliberately:
--
--   donations_cancel_own is deliberately untouched, and its gap is closed in 0009
--   rather than here. Its USING clause matches an available listing, so a donor
--   can reach claimed_by through it - either fabricating a claim, or clearing
--   the claim on a listing they are cancelling. That cannot be pinned in a WITH
--   CHECK, because the constraint needs the old row and WITH CHECK only sees the
--   new one, so 0009 enforces it in a BEFORE UPDATE trigger alongside
--   guard_donation_removal. Leaving it to a separate file keeps this one to
--   changes that are purely additive to existing policies.
--
--   claimed_by's referent. 0003 points it at ngo_details(id) and 0004/0007 are
--   both written against that, but origin/main's 0005 adds the column as
--   references public.profiles(id). The two cannot be reconciled in a comment -
--   whichever way it goes is a contract change with the partner branch, and it
--   has to be decided before migration 0005 is restored, because the function's
--   body assigns claimed_by = auth.uid(), which is a profile id.
--
--   profiles.role = 'ngo'. 0001 says ngo and admin are promoted later and never
--   by the user, and 0002's insert policy does not check the role - but nothing
--   in any migration performs the promotion. A charity that registers and is
--   then verified holds a verified ngo_details row on a profile whose role is
--   still 'donor'. RLS opens the feed anyway, because
--   donations_select_verified_ngo reads ngo_details rather than the role, so
--   the failure lands in the client: RequireRole routes on profiles.role, so a
--   genuinely verified charity is sent to their donor home and can never reach
--   the feed page. The mock hides this by writing role: 'ngo' at registration.
--
--   is_anonymous. The column exists and is the donor's to set, but
--   profiles_select_own admits a row only to its owner or an admin, so no
--   charity can read whether a donor asked to be anonymous - and RLS cannot
--   redact a column for the rows it admits. There is no object in this schema
--   that can honour the rule for a shared aggregate, because a row-level policy
--   is the wrong tool for it. See the note in utils/impact.js.
--
--   donations' column-level grants. The remaining exposure on donations is that
--   a donor can still set estimated_kg on their own available listing, which
--   becomes an impact number if a charity later delivers without recording a
--   measured weight. Narrowing the table-level UPDATE grant is the right fix
--   and needs the full column set, which belongs to migration 0005.