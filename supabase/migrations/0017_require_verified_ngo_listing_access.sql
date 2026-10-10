-- Pending or disabled charities may sign in and manage their registration,
-- but only active, administrator-approved NGOs can browse available donations.
drop policy if exists "donations_select_ngo" on public.donations;

create policy "donations_select_ngo"
  on public.donations
  for select
  to authenticated
  using (
    status = 'available'
    and (select public.is_current_user_active_ngo())
  );
