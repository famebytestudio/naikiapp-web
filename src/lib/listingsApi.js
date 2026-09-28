import { getSession, DEMO_ADMIN_ID, DEMO_DONOR_ID, DEMO_NGO_ID, DEMO_VENDOR_ID } from './authApi'
import { canCancel, canEdit } from '../utils/listingStatus'
import { canRemove, isRemoved, REMOVAL_REASON_MAX } from '../utils/moderation'

/*
  ============================================================================
  DEV-ONLY MOCK BACKEND - NOT THE REAL DATABASE
  ============================================================================

  The donor portal is built against real Supabase queries, but until a .env and
  a real auth flow exist there is nothing to talk to, so this module stands in
  for the server: an in-memory store persisted to localStorage.

  It is one of only two files in src/ that know the backend is fake - the other
  is authApi.js, which stands in for Supabase Auth. The hooks in
  src/hooks/useListings.js and every page call the functions below and nothing
  else, so swapping in supabase-js means rewriting the bodies of these functions
  and deleting this file - the call sites do not change.

  Identity comes from authApi.currentUserId(), which is what auth.uid() returns on
  a real database. Reads and writes are scoped to it exactly as the RLS policies
  in supabase/migrations/0003_create_donations.sql scope them, so signing in as
  a different account shows a different set of listings, and a "sneaky" call
  against someone else's row is refused here for the same reason it would be
  refused there.

  What is deliberately NOT mocked away: the write rules. canEdit/canCancel are
  the same predicates the RLS policies enforce, so the UI cannot offer an action
  the database would refuse. The admin moderation section at the bottom is built
  the same way, against the policies in migration 0006 - including the part that
  is awkward to mock: a removed listing is frozen for its own donor too.
  ============================================================================
*/

const STORAGE_KEY = 'naikiapp:mock:donations:v1'

const HOUR = 60 * 60_000
const MINUTE = 60_000

/* Simulated round-trip, so loading states are actually visible in the demo. */
const LATENCY = 180

function latency(ms = LATENCY) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    // Private browsing or a corrupt entry: fall back rather than crash.
    return fallback
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Persistence is a convenience here, not a requirement.
  }
}

function seedListings(now) {
  const base = {
    donor_id: DEMO_DONOR_ID,
    description: '',
    claimed_by: null,
    claimed_at: null,
    picked_up_at: null,
    delivered_at: null,
    delivered_kg: null,
    cancelled_at: null,
    // Added by migration 0006. Null on every row that has not been moderated.
    removed_at: null,
    removed_by: null,
    removal_reason: null,
  }

  return [
    {
      ...base,
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Chicken biryani and qorma',
      description: 'Left over from a family function. Kept covered and hot until 11pm.',
      food_type: 'cooked',
      quantity_value: 120,
      quantity_unit: 'plates',
      estimated_kg: 60,
      expiry_at: new Date(now + 2 * HOUR).toISOString(),
      pickup_start_at: new Date(now + 45 * MINUTE).toISOString(),
      pickup_end_at: new Date(now + 135 * MINUTE).toISOString(),
      city: 'Lahore',
      area: 'Gulberg',
      address: 'House 42, Street 8, Gulberg III',
      contact_name: 'Imran Shah',
      contact_phone: '0300 1234567',
      status: 'available',
      created_at: new Date(now - 20 * MINUTE).toISOString(),
    },
    {
      ...base,
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Fresh bread and rusk',
      description: 'From the bakery round. Still sealed where it is sealed.',
      food_type: 'bakery',
      quantity_value: 40,
      quantity_unit: 'packs',
      estimated_kg: 18,
      expiry_at: new Date(now + 5 * HOUR).toISOString(),
      pickup_start_at: new Date(now + 20 * MINUTE).toISOString(),
      pickup_end_at: new Date(now + 110 * MINUTE).toISOString(),
      city: 'Karachi',
      area: 'Clifton',
      address: 'Shop 9, Sea Breeze Plaza, Clifton Block 2',
      contact_name: 'Ayesha Siddiqui',
      contact_phone: '0321 7654321',
      status: 'claimed',
      claimed_by: DEMO_NGO_ID,
      claimed_at: new Date(now - 8 * MINUTE).toISOString(),
      created_at: new Date(now - 40 * MINUTE).toISOString(),
    },
    {
      ...base,
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Mixed vegetables and fruit',
      description: 'Slightly bruised pieces, perfectly good for cooking.',
      food_type: 'fresh_produce',
      quantity_value: 25,
      quantity_unit: 'kg',
      estimated_kg: 25,
      expiry_at: new Date(now - 30 * MINUTE).toISOString(),
      pickup_start_at: new Date(now - 3 * HOUR).toISOString(),
      pickup_end_at: new Date(now - 90 * MINUTE).toISOString(),
      city: 'Islamabad',
      area: 'G-9 Markaz',
      address: 'Shop 3, Aga Khan Avenue, G-9',
      contact_name: 'Bilal Ahmed',
      contact_phone: '0333 9876543',
      status: 'picked_up',
      claimed_by: DEMO_NGO_ID,
      claimed_at: new Date(now - 4 * HOUR).toISOString(),
      picked_up_at: new Date(now - 70 * MINUTE).toISOString(),
      created_at: new Date(now - 6 * HOUR).toISOString(),
    },
    {
      ...base,
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Cooked daal and rice',
      description: '',
      food_type: 'cooked',
      quantity_value: 30,
      quantity_unit: 'plates',
      estimated_kg: 15,
      expiry_at: new Date(now - 2 * HOUR).toISOString(),
      pickup_start_at: new Date(now - 8 * HOUR).toISOString(),
      pickup_end_at: new Date(now - 6 * HOUR).toISOString(),
      city: 'Lahore',
      area: 'Model Town',
      address: 'Flat 7, Askari Heights, Model Town',
      contact_name: 'Imran Shah',
      contact_phone: '0300 1234567',
      status: 'delivered',
      claimed_by: DEMO_NGO_ID,
      claimed_at: new Date(now - 9 * HOUR).toISOString(),
      picked_up_at: new Date(now - 7 * HOUR).toISOString(),
      delivered_at: new Date(now - 5 * HOUR).toISOString(),
      delivered_kg: 14.5,
      created_at: new Date(now - 10 * HOUR).toISOString(),
    },
    {
      ...base,
      id: '55555555-5555-4555-8555-555555555555',
      title: 'Party cake and sweets',
      description: 'Cancel a listing that nobody claimed in time.',
      food_type: 'other',
      quantity_value: 8,
      quantity_unit: 'boxes',
      estimated_kg: 6,
      expiry_at: new Date(now + 26 * HOUR).toISOString(),
      pickup_start_at: new Date(now + 20 * HOUR).toISOString(),
      pickup_end_at: new Date(now + 24 * HOUR).toISOString(),
      city: 'Lahore',
      area: 'DHA',
      address: 'House 7, Street 22, Phase 6',
      contact_name: 'Imran Shah',
      contact_phone: '0300 1234567',
      status: 'cancelled',
      cancelled_at: new Date(now - 90 * MINUTE).toISOString(),
      created_at: new Date(now - 3 * HOUR).toISOString(),
    },

    /*
      A second donor, so the moderation queue is not just the account you are
      signed in as. A queue you can only ever moderate your own posts against
      would pass its demo and fail its job.
    */
    {
      ...base,
      id: '66666666-6666-4666-8666-666666666666',
      donor_id: DEMO_VENDOR_ID,
      title: 'Roti and sabzi from the bakery round',
      description: 'Baked an hour ago, sealed in sacks. Pickup from the back gate.',
      food_type: 'bakery',
      quantity_value: 60,
      quantity_unit: 'packs',
      estimated_kg: 32,
      expiry_at: new Date(now + 8 * HOUR).toISOString(),
      pickup_start_at: new Date(now + 30 * MINUTE).toISOString(),
      pickup_end_at: new Date(now + 4 * HOUR).toISOString(),
      city: 'Karachi',
      area: 'North Nazimabad',
      address: 'Shop 14, Block D, North Nazimabad',
      contact_name: 'Rabia Noor',
      contact_phone: '0321 555 0173',
      status: 'available',
      created_at: new Date(now - 25 * MINUTE).toISOString(),
    },
    {
      ...base,
      id: '99999999-9999-4999-8999-999999999999',
      donor_id: DEMO_VENDOR_ID,
      title: 'Cheap weight loss supplement - 90% off, order on WhatsApp',
      description:
        'Not food. Posted into the food feed to see what an admin does with it. Stock is limited, message 0300-9998887 for prices and delivery.',
      food_type: 'other',
      quantity_value: 200,
      quantity_unit: 'boxes',
      estimated_kg: 90,
      expiry_at: new Date(now + 30 * HOUR).toISOString(),
      pickup_start_at: new Date(now + HOUR).toISOString(),
      pickup_end_at: new Date(now + 20 * HOUR).toISOString(),
      city: 'Karachi',
      area: 'Korangi',
      address: 'Flat 2, Block 5, Korangi',
      contact_name: 'Rabia Noor',
      contact_phone: '0321 555 0173',
      status: 'available',
      created_at: new Date(now - 12 * MINUTE).toISOString(),
    },
    {
      ...base,
      id: '88888888-8888-4888-8888-888888888888',
      donor_id: DEMO_VENDOR_ID,
      title: 'Yesterday\'s biryani, half price',
      description: 'Left over from a buffet. Pickup tonight, no questions.',
      food_type: 'cooked',
      quantity_value: 80,
      quantity_unit: 'plates',
      estimated_kg: 40,
      // Expired an hour ago but still sitting in the feed as 'available' -
      // exactly the listing a charity would turn up for and find nothing.
      expiry_at: new Date(now - 60 * MINUTE).toISOString(),
      pickup_start_at: new Date(now - 2 * HOUR).toISOString(),
      pickup_end_at: new Date(now - 30 * MINUTE).toISOString(),
      city: 'Karachi',
      area: 'Gulshan-e-Hadeed',
      address: 'Warehouse 6, Industrial Area',
      contact_name: 'Rabia Noor',
      contact_phone: '0321 555 0173',
      status: 'available',
      created_at: new Date(now - 4 * HOUR).toISOString(),
      // Seeded already removed, so the queue opens with a decision on record and
      // the restore path is reachable without making one first.
      removed_at: new Date(now - 55 * MINUTE).toISOString(),
      removed_by: DEMO_ADMIN_ID,
      removal_reason: 'Expired food offered as fresh. Pickup window had already closed.',
    },
  ]
}

function readListings() {
  const stored = readJson(STORAGE_KEY, null)
  if (Array.isArray(stored)) return stored
  const seeded = seedListings(Date.now())
  writeJson(STORAGE_KEY, seeded)
  return seeded
}

function writeListings(listings) {
  writeJson(STORAGE_KEY, listings)
}

function nextId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `donation-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/* ------------------------------------------------------------------ read */

/*
  Every function below refuses to run without a session. RLS has no policy for
  the anon role, so an unauthenticated read returns nothing on a real database;
  throwing here is the closest honest equivalent, and it stops a signed-out
  session from quietly rendering the previous user's cache.
*/
function requireSession() {
  const session = getSession()
  if (!session) throw new Error('You need to be logged in to do that.')
  return session
}

export async function listMine() {
  await latency()
  const session = requireSession()

  return readListings()
    .filter((listing) => listing.donor_id === session.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

/*
  The union of the three SELECT policies in migration 0003: your own rows, or -
  for a verified charity and for an admin - the rows those roles are allowed to
  see. A row that fails all three comes back as null, not as a forbidden error,
  because that is what a real SELECT under RLS does: the row is simply invisible.
*/
function canRead(listing, session) {
  if (listing.donor_id === session.user.id) return true
  if (session.profile?.role === 'admin') return true
  return listing.status === 'available' && session.ngo?.verification === 'verified'
}

export async function getById(id) {
  await latency(80)
  const session = requireSession()

  const listing = readListings().find((row) => row.id === id)
  return listing && canRead(listing, session) ? listing : null
}

/* ----------------------------------------------------------------- write */

/*
  Mirrors the donations_insert_own policy: your own row, forced to 'available'.
  A client-supplied status is dropped rather than trusted.

  Only a donor may post. The policy says donor_id = auth.uid(), which an admin or
  a charity posting "as themselves" would also satisfy, so the role is checked
  here to match what the UI offers: one posting form, on the donor portal.
*/
export async function create(values) {
  await latency()
  const session = requireSession()

  if (session.profile?.role !== 'donor') {
    throw new Error('Only donor accounts can post surplus food.')
  }

  const now = new Date().toISOString()
  const donation = {
    ...values,
    id: nextId(),
    donor_id: session.user.id,
    status: 'available',
    claimed_by: null,
    claimed_at: null,
    picked_up_at: null,
    delivered_at: null,
    delivered_kg: null,
    cancelled_at: null,
    created_at: now,
    updated_at: now,
  }

  writeListings([donation, ...readListings()])
  return donation
}

/*
  Finds a listing the caller is allowed to write to, and refuses otherwise.

  The ownership test is not decoration. Without it, any signed-in account could
  call update() on an id it guessed, which is precisely the hole the
  donations_update_own_available policy closes on a real database.
*/
function findWritable(listings, id) {
  const session = requireSession()
  const index = listings.findIndex((listing) => listing.id === id)

  if (index === -1) throw new Error('That listing no longer exists.')
  if (listings[index].donor_id !== session.user.id) {
    throw new Error('That listing belongs to another donor.')
  }

  return index
}

/*
  Mirrors donations_update_own_available. Throws rather than silently ignoring
  the edit, so the page can surface the conflict instead of pretending to save.
*/
export async function update(id, values) {
  await latency()
  const listings = readListings()
  const index = findWritable(listings, id)

  const current = listings[index]
  requireNotRemoved(current)
  if (!canEdit(current.status)) {
    throw new Error('This listing can no longer be edited. Cancel it and post a new one instead.')
  }

  const next = {
    ...current,
    ...values,
    id: current.id,
    donor_id: current.donor_id,
    status: current.status,
    updated_at: new Date().toISOString(),
  }

  listings[index] = next
  writeListings(listings)
  return next
}

/* Mirrors donations_cancel_own: available or claimed, never once picked up. */
export async function cancel(id) {
  await latency()
  const listings = readListings()
  const index = findWritable(listings, id)

  const current = listings[index]
  // A removed listing is frozen, so it is not the donor's to cancel either.
  requireNotRemoved(current)
  if (!canCancel(current.status)) {
    throw new Error(
      current.status === 'picked_up' || current.status === 'delivered'
        ? 'This food has already been collected, so it can no longer be cancelled.'
        : 'This listing is closed and can no longer be cancelled.',
    )
  }

  const now = new Date().toISOString()
  const next = { ...current, status: 'cancelled', cancelled_at: now, updated_at: now }

  listings[index] = next
  writeListings(listings)
  return next
}

/* ---------------------------------------------------------- admin moderation */

/*
  ---------------------------------------------------------------------------
  ADMIN: THE QUEUE AND THE REMOVAL
  ---------------------------------------------------------------------------

  Migration 0006 opened exactly two write surfaces for an admin. Both are here,
  and both are enforced with the same predicates the policies enforce, so the
  moderation screen cannot offer an action the database would refuse:

    - donations_update_admin_removal - an admin may update the removal columns
      on a listing that is still available or claimed, and nothing else.
    - donations_select_admin - already modelled by canRead() above.

  The awkward part of 0006 is the guard_donation_removal trigger: because RLS
  policies for UPDATE are OR'ed, a removed listing is still matched by its own
  donor's donations_update_own_available policy, so RLS alone would let that
  donor edit the evidence an admin acted on, or clear removed_at and put it
  back on the feed. requireNotRemoved() is that trigger's second rule in the
  mock - a removed row is frozen for everyone except an admin.
*/

/*
  The admin's view: every listing on the platform, whoever posted it, newest
  first. The role is re-checked here rather than trusted from the route, because
  a page is not a boundary - RequireRole is a convenience and this is the check
  that matches donations_select_admin.
*/
export async function listAll() {
  await latency()
  const session = requireSession()

  if (session.profile?.role !== 'admin') {
    throw new Error('Only an admin can see every listing on the platform.')
  }

  return [...readListings()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

/*
  The rule the 0006 trigger shares with update() and cancel(): once a listing is
  removed it is frozen for its donor. An admin can restore it; the donor cannot
  edit their way out of a decision.
*/
function requireNotRemoved(listing) {
  if (isRemoved(listing)) {
    throw new Error('This listing was taken down by NaikiApp and can no longer be changed.')
  }
}

/*
  Take a listing down.

  Three refusals, in the order they bite:

    1. Not an admin. Same reason as listAll().
    2. Already removed, or past pickup. canRemove() is the same list the
       policy's USING clause uses - a listing the food has already left for
       cannot be moderated, because its delivered weight is the only record of
       impact the platform has.
    3. No reason. A reason is required by the UI, and the column is nullable in
       the schema, so the constraint is deliberately made here rather than left
       to a null the moderator would have to notice later.

  removal_reason is written as submitted and removed_by is stamped from the
  session, mirroring the trigger: the client does not get to say who did it.
*/
export async function removeListing(id, { reason } = {}) {
  await latency()
  const session = requireSession()

  if (session.profile?.role !== 'admin') {
    throw new Error('Only an admin can remove a listing.')
  }

  const listings = readListings()
  const index = listings.findIndex((listing) => listing.id === id)
  if (index === -1) throw new Error('That listing no longer exists.')

  const current = listings[index]
  if (isRemoved(current)) throw new Error('That listing has already been removed.')

  if (!canRemove(current.status)) {
    throw new Error(
      current.status === 'delivered'
        ? 'Delivered food is reported history, so the listing cannot be removed.'
        : 'This food has already been collected, so the listing cannot be removed.',
    )
  }

  const trimmed = String(reason ?? '').trim()
  if (!trimmed) throw new Error('Say why the listing is being taken down.')
  if (trimmed.length > REMOVAL_REASON_MAX) {
    throw new Error(`Keep the reason under ${REMOVAL_REASON_MAX} characters.`)
  }

  const now = new Date().toISOString()
  const next = {
    ...current,
    removed_at: now,
    removed_by: session.user.id,
    removal_reason: trimmed,
    updated_at: now,
  }

  listings[index] = next
  writeListings(listings)
  return next
}

/*
  Undo a removal and put the listing back on the feed.

  The status is untouched, so restoring a listing that was 'available' when it
  was taken down makes it claimable again exactly as before. It is NOT a check
  that the food is still safe: the pickup window may have passed while the
  listing was down, and the expire-listings sweep is what owns that call. The
  copy on the confirm button says so, rather than implying the row is fresh.
*/
export async function restoreListing(id) {
  await latency()
  const session = requireSession()

  if (session.profile?.role !== 'admin') {
    throw new Error('Only an admin can restore a listing.')
  }

  const listings = readListings()
  const index = listings.findIndex((listing) => listing.id === id)
  if (index === -1) throw new Error('That listing no longer exists.')

  const current = listings[index]
  if (!isRemoved(current)) throw new Error('That listing is not removed.')

  const now = new Date().toISOString()
  const next = {
    ...current,
    removed_at: null,
    removed_by: null,
    removal_reason: null,
    updated_at: now,
  }

  listings[index] = next
  writeListings(listings)
  return next
}

/* ---------------------------------------------------------------- profile */

/*
  Profiles and the session moved to src/lib/authApi.js, which stands in for
  Supabase Auth. They used to live here, which meant the data layer owned the
  signed-in user - a boundary that made both halves harder to replace.

  Restore the seed listings, so the demo can be replayed from a clean slate.
  resetAuthData() in authApi does the same for accounts and the session.
*/
export function resetMockData() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
  return readListings()
}
