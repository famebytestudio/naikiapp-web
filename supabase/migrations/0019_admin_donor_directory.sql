-- Give administrators a purpose-limited donor directory without exposing
-- auth.users email addresses through the general profiles REST endpoint.
create or replace function public.list_donors_for_admin()
returns table (
  id uuid,
  email text,
  full_name text,
  organisation text,
  phone text,
  is_anonymous boolean,
  created_at timestamptz,
  disabled_at timestamptz,
  disabled_reason text,
  donation_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception 'Only administrators can view registered donors';
  end if;

  return query
  select
    profile.id,
    users.email::text,
    profile.full_name,
    profile.organisation,
    profile.phone,
    profile.is_anonymous,
    profile.created_at,
    profile.disabled_at,
    profile.disabled_reason,
    count(donation.id)::bigint
  from public.profiles profile
  join auth.users users on users.id = profile.id
  left join public.donations donation on donation.donor_id = profile.id
  where profile.role = 'donor'
  group by profile.id, users.email
  order by profile.created_at desc;
end;
$$;

revoke all on function public.list_donors_for_admin() from public;
grant execute on function public.list_donors_for_admin() to authenticated;
