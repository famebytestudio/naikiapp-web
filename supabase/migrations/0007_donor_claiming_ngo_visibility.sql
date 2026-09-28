-- NaikiApp 0007 - the donor's view of the charity that claimed their food
--
-- A donor has to be able to coordinate a pickup with an actual person: who is
-- coming, whether they are a real charity, and what number to call if the van
-- does not arrive. The database said no to all three:
--
--   ngo_details_select_own   own registration, or an admin
--   profiles_select_own      own profile, or an admin
--
-- So a donor whose food had been claimed, collected and delivered could not read
-- a single field of the charity that took it. The two policies below open
-- exactly that relationship and nothing more: a donor who has never had food
-- claimed from them still sees no charity record of any kind.
--
-- This is a read-only grant. No INSERT or UPDATE policy is added, so the
-- charity's own record remains unwritable from the client - which is the
-- property that migration 0002's `revoke update` depends on, and that 0006's
-- admin-only column grant is layered on top of.

-- ------------------------------------------------------------------ helpers
--
-- These two functions exist because of a policy-recursion trap, not for style.
--
-- RLS policies cannot be mutually recursive, and the existing set already has
-- one leg of this shape:
--
--   donations_select_admin   -> reads public.profiles
--   profiles_select_*        -> would read public.donations
--
-- Written inline, evaluating the new profiles policy re-enters the donations
-- policies, which re-enter profiles, and Postgres raises
-- "infinite recursion detected in policy for relation profiles" at query time -
-- not at migration time, so it would only surface once a donor opened a claimed
-- listing in production.
--
-- SECURITY DEFINER is the standard fix. The function runs as the table owner,
-- and a table owner is not subject to RLS, so the inner query is evaluated once,
-- outside the policy machinery entirely.
--
-- That is only safe because each function states the donor test explicitly in
-- its own WHERE clause. Bypassing RLS here is not a way to widen visibility -
-- the caller filter IS the authorization. And it cannot be spoofed, because
-- auth.uid() comes from the verified JWT, not from anything the client sends.

-- True when the signed-in donor is the donor of a donation claimed by this NGO.
create or replace function public.donor_claimed_this_ngo(target_ngo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.donations d
    where d.claimed_by = target_ngo_id
      and d.donor_id = (select auth.uid())
  );
$$;

comment on function public.donor_claimed_this_ngo(uuid) is
  'RLS helper: does the calling donor have a donation claimed by this NGO record?';

-- True when this profile belongs to an NGO that claimed one of the calling
-- donor's donations. The contact name and number live on profiles, not on
-- ngo_details, so reading the charity a donor is handing food to needs this as
-- well as the function above.
create or replace function public.donor_may_read_charity_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.donations d
    join public.ngo_details n
      on n.id = d.claimed_by
    where d.donor_id = (select auth.uid())
      and n.profile_id = target_profile_id
  );
$$;

comment on function public.donor_may_read_charity_profile(uuid) is
  'RLS helper: does this profile belong to the NGO that claimed one of the calling donor''s donations?';

-- The functions take an argument and return a boolean, so neither can be used to
-- read a row. They are still not for the anon role, which has no business
-- calling them at all.
revoke all on function public.donor_claimed_this_ngo(uuid) from public;
grant execute on function public.donor_claimed_this_ngo(uuid) to authenticated;

revoke all on function public.donor_may_read_charity_profile(uuid) from public;
grant execute on function public.donor_may_read_charity_profile(uuid) to authenticated;

-- -------------------------------------------------------------------- read
--
-- Policies on one table are OR'ed together, so each of these widens the
-- existing policy rather than replacing it:
--
--   ngo_details  - own registration  OR  admin  OR  claimed one of my donations
--   profiles     - own profile       OR  admin  OR  charity that claimed mine
--
-- Note what a row-level SELECT cannot do: it cannot hide a single column. A
-- donor who passes this policy receives the whole ngo_details row, including
-- registration_number. That is accepted deliberately - a registration number is
-- public registry information for a verified charity, and a donor checking one
-- is exactly who should be able to read it. Hiding it properly would mean a
-- view with a column list, which trades a documented, harmless disclosure for a
-- second database object to keep in step with this one.

create policy "ngo_details_select_claiming_donor"
  on public.ngo_details
  for select
  to authenticated
  using (public.donor_claimed_this_ngo(ngo_details.id));

create policy "profiles_select_claiming_donor"
  on public.profiles
  for select
  to authenticated
  using (public.donor_may_read_charity_profile(profiles.id));

-- ------------------------------------------------------------------ notes
--
-- No change to donations_select_own, deliberately. A donor keeps seeing their
-- own listing after an admin removes it, and now also keeps being able to see
-- which charity had claimed it - if a listing is taken down mid-claim, "who was
-- coming to collect this" is the first thing the donor needs to know.
--
-- No change to status_log_select_involved either: it already admits the donor,
-- so the status timeline needs no new policy to exist.
