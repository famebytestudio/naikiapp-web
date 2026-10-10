-- A listing must belong to the signed-in donor and start in the available
-- state. NGOs and administrators cannot create listings through the donor API.
drop policy if exists "donations_insert_own" on public.donations;

create policy "donations_insert_own"
  on public.donations
  for insert
  to authenticated
  with check (
    donor_id = (select auth.uid())
    and status = 'available'
    and exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.role = 'donor'
        and profile.disabled_at is null
    )
  );
