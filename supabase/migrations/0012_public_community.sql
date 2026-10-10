-- Public community directory and leaderboard: explicit, read-only projection.
-- Does not change profile/donation RLS or publish private contact/account IDs.
-- Requires 0011 (disabled_at). Apply with the other migrations.
begin;

create or replace function public.get_public_community()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ngos', (
      select coalesce(jsonb_agg(jsonb_build_object('name', n.name) order by n.name), '[]'::jsonb)
      from (
        select coalesce(nullif(trim(d.organisation), ''), nullif(trim(p.organisation), ''), 'Community charity') as name
        from public.profiles p
        left join public.ngo_details d on d.profile_id = p.id
        where p.role = 'ngo' and p.disabled_at is null
      ) n
    ),
    'donors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', r.name, 'deliveries', r.deliveries, 'deliveredKg', r.delivered_kg
      ) order by r.delivered_kg desc, r.deliveries desc, r.name), '[]'::jsonb)
      from (
        select coalesce(nullif(trim(p.organisation), ''), nullif(trim(p.full_name), ''), 'Community donor') as name,
          count(*) as deliveries, coalesce(sum(d.delivered_kg), 0) as delivered_kg
        from public.profiles p
        join public.donations d on d.donor_id = p.id and d.status = 'delivered'
        where p.role = 'donor' and not p.is_anonymous and p.disabled_at is null
        group by p.id, p.organisation, p.full_name
        order by delivered_kg desc, deliveries desc, name
        limit 50
      ) r
    )
  );
$$;

revoke all on function public.get_public_community() from public;
grant execute on function public.get_public_community() to anon, authenticated;

commit;
