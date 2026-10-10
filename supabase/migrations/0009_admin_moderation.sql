-- Allow an administrator to soft-remove an active donation without deleting
-- its history or bypassing the status-change audit trigger.
create or replace function public.cancel_donation_as_admin(p_donation_id uuid)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_donation public.donations%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only administrators can moderate donations';
  end if;

  update public.donations
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where id = p_donation_id
    and status in ('available', 'claimed')
  returning * into changed_donation;

  if not found then
    raise exception 'Donation no longer exists or is not eligible for moderation';
  end if;

  return changed_donation;
end;
$$;

revoke all on function public.cancel_donation_as_admin(uuid) from public;
grant execute on function public.cancel_donation_as_admin(uuid) to authenticated;
