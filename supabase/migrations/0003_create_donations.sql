-- NaikiApp 0003 - donations
--
-- The listings themselves. Status values are a cross-branch contract and must
-- not be renamed:
--
--   available -> claimed -> picked_up -> delivered
--
-- with two terminal-off states, expired (pickup window lapsed, set by the
-- expire-listings Edge Function) and cancelled (donor pulled the listing).

create type public.donation_status as enum (
  'available',
  'claimed',
  'picked_up',
  'delivered',
  'expired',
  'cancelled'
);

create type public.food_type as enum (
  'cooked',
  'packaged',
  'fresh_produce',
  'bakery',
  'other'
);

create type public.quantity_unit as enum ('plates', 'trays', 'packs', 'boxes', 'kg');

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles (id) on delete cascade,

  title text not null check (char_length(trim(title)) between 3 and 120),
  description text check (char_length(description) <= 1000),
  food_type public.food_type not null,

  -- Quantity is split so the UI can say "120 plates, ~60kg" without guessing
  -- the unit, and estimated_kg stays available for every listing because it is
  -- what the impact numbers are summed from.
  quantity_value integer not null check (quantity_value > 0),
  quantity_unit public.quantity_unit not null,
  estimated_kg numeric(10, 2) not null check (estimated_kg > 0),

  -- Expiry is when the food stops being safe; the pickup window is when the
  -- NGO can actually collect. The window must close before expiry.
  expiry_at timestamptz not null,
  pickup_start_at timestamptz not null,
  pickup_end_at timestamptz not null,
  constraint donations_pickup_window_check check (pickup_end_at > pickup_start_at),
  constraint donations_pickup_before_expiry_check check (expiry_at >= pickup_end_at),

  city text not null check (char_length(trim(city)) between 2 and 80),
  area text not null check (char_length(trim(area)) between 2 and 120),
  address text not null check (char_length(trim(address)) between 4 and 300),
  contact_name text not null check (char_length(trim(contact_name)) between 2 and 120),
  contact_phone text not null check (char_length(trim(contact_phone)) between 7 and 20),

  status public.donation_status not null default 'available',

  -- Set by claim_donation() (migration 0005), which owns the claim transition
  -- so two NGOs cannot win the same listing.
  claimed_by uuid references public.ngo_details (id) on delete set null,
  claimed_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  delivered_kg numeric(10, 2) check (delivered_kg is null or delivered_kg > 0),
  cancelled_at timestamptz,
  expiry_notified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The donor's own list is the hot path for this portal: newest first.
create index donations_donor_created_idx on public.donations (donor_id, created_at desc);
-- The NGO feed: available listings, soonest to expire first.
create index donations_available_idx on public.donations (expiry_at)
  where status = 'available';

create trigger donations_touch_updated_at
  before update on public.donations
  for each row execute function public.touch_updated_at();

alter table public.donations enable row level security;

-- ---------------------------------------------------------------- read

-- A donor sees their own listings in every state, so they can track a delivery
-- through to the end.
create policy "donations_select_own"
  on public.donations
  for select
  to authenticated
  using (donor_id = (select auth.uid()));

-- NGO accounts browse only what is still on offer. A claimed listing is no
-- longer theirs to see until the claim lands.
create policy "donations_select_ngo"
  on public.donations
  for select
  to authenticated
  using (
    status = 'available'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'ngo'
    )
  );

create policy "donations_select_admin"
  on public.donations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- -------------------------------------------------------------- write

-- A donor may post a listing, and only for themselves, only as 'available'.
-- Without the status pin in the CHECK a donor could insert a row that is
-- already 'delivered' and inflate the impact totals.
create policy "donations_insert_own"
  on public.donations
  for insert
  to authenticated
  with check (donor_id = (select auth.uid()) and status = 'available');

-- Edit: only while nobody has claimed it. The NGO is planning a pickup around
-- these details, so once claimed the listing is frozen. The WITH CHECK repeats
-- the status so a donor cannot use an edit to walk a listing forward to
-- 'picked_up' or 'delivered' and write their own impact numbers.
create policy "donations_update_own_available"
  on public.donations
  for update
  to authenticated
  using (donor_id = (select auth.uid()) and status = 'available')
  with check (donor_id = (select auth.uid()) and status = 'available');

-- Cancel: allowed from 'available' or 'claimed' - an NGO may be mid-arrival and
-- the donor still has to be able to call it off. Blocked from picked_up onward,
-- because by then the food is physically in the NGO's hands.
--
-- These two policies are OR'ed for UPDATE, so the donor's whole write surface
-- is exactly {edit while available} + {cancel until pickup}. There is
-- deliberately no INSERT of a non-available row and no way to set
-- delivered_kg, because no policy lets the donor reach those states.
create policy "donations_cancel_own"
  on public.donations
  for update
  to authenticated
  using (donor_id = (select auth.uid()) and status in ('available', 'claimed'))
  with check (donor_id = (select auth.uid()) and status = 'cancelled');

-- No DELETE policy: a listing is cancelled, never removed, so the status
-- history stays intact. Cancelling is a soft state.
