-- Ensure new Auth users keep receiving their profile and repair accounts
-- created before the profile provisioning trigger was installed correctly.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, organisation, phone, role)
select
  users.id,
  nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'organisation'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'phone'), ''),
  case
    when users.raw_user_meta_data ->> 'role' = 'ngo' then 'ngo'::public.user_role
    else 'donor'::public.user_role
  end
from auth.users users
on conflict (id) do nothing;

-- Recreate missing NGO registrations as pending, never as approved. Existing
-- review decisions and evidence are preserved by the conflict clause.
insert into public.ngo_details (
  profile_id,
  organisation,
  registration_number,
  id_card_number,
  official_link,
  verification_status
)
select
  profile.id,
  coalesce(nullif(trim(profile.organisation), ''), 'Charity organisation'),
  nullif(trim(users.raw_user_meta_data ->> 'registration_number'), ''),
  case
    when char_length(trim(users.raw_user_meta_data ->> 'id_card_number')) between 5 and 50
      then trim(users.raw_user_meta_data ->> 'id_card_number')
    else null
  end,
  case
    when users.raw_user_meta_data ->> 'official_link' ~* '^https?://'
      then users.raw_user_meta_data ->> 'official_link'
    else null
  end,
  'pending'
from public.profiles profile
join auth.users users on users.id = profile.id
where profile.role = 'ngo'
on conflict (profile_id) do nothing;
