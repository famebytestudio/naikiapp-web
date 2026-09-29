-- NaikiApp 0004 - donation status audit log
-- We keep the app-facing table name as donation_status_log so the NGO status
-- timeline and RPC helpers stay compatible with the role-based app.

create table public.donation_status_log (
  id bigint generated always as identity primary key,
  donation_id uuid not null references public.donations (id) on delete cascade,
  from_status public.donation_status,
  to_status public.donation_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index donation_status_log_donation_idx
  on public.donation_status_log (donation_id, created_at);

create or replace function public.log_donation_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.donation_status_log (donation_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger donations_log_status_change
  after update on public.donations
  for each row execute function public.log_donation_status_change();

create or replace function public.log_donation_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.donation_status_log (donation_id, from_status, to_status, actor_id)
  values (new.id, null, new.status, auth.uid());
  return new;
end;
$$;

create trigger donations_log_creation
  after insert on public.donations
  for each row execute function public.log_donation_created();

alter table public.donation_status_log enable row level security;

create policy "status_log_select_involved"
  on public.donation_status_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.donations d
      where d.id = donation_status_log.donation_id
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
