-- NaikiApp 0004 - status_log
--
-- Append-only history behind the timeline UI. Entries are written by a trigger
-- rather than by the client, so a listing can never change state without a
-- matching log row.

create table public.status_log (
  id bigint generated always as identity primary key,
  donation_id uuid not null references public.donations (id) on delete cascade,
  from_status public.donation_status,
  to_status public.donation_status not null,
  -- Nullable: the row has to survive the actor being deleted.
  actor_id uuid references public.profiles (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index status_log_donation_idx on public.status_log (donation_id, created_at);

-- Runs as the table owner (security definer) so it can write the log even for
-- transitions the acting role may not insert directly.
create or replace function public.log_donation_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.status_log (donation_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger donations_log_status_change
  after update on public.donations
  for each row execute function public.log_donation_status_change();

-- The first entry for a listing, written on create.
create or replace function public.log_donation_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.status_log (donation_id, from_status, to_status, actor_id)
  values (new.id, null, new.status, auth.uid());
  return new;
end;
$$;

create trigger donations_log_creation
  after insert on public.donations
  for each row execute function public.log_donation_created();

alter table public.status_log enable row level security;

-- The parties to a listing can read its timeline: the donor, the NGO that
-- claimed it, and admins. An unrelated NGO cannot read someone else's history.
create policy "status_log_select_involved"
  on public.status_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.donations d
      where d.id = status_log.donation_id
        and (
          d.donor_id = (select auth.uid())
          or d.claimed_by in (
            select n.id from public.ngo_details n
            where n.profile_id = (select auth.uid())
          )
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'admin'
          )
        )
    )
  );

-- No INSERT / UPDATE / DELETE policies. The triggers above are security
-- definer, so they still write rows, but a client cannot forge or rewrite
-- history. This is what makes the log append-only rather than just
-- append-only by convention.
