import { getSession, DEMO_DONOR_ID } from './authApi'
import { canCancel, canEdit } from '../utils/listingStatus'

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
  the database would refuse.
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

/* Mirrors the donor, NGO, and admin SELECT policies in migration 0003. */
function canRead(listing, session) {
  if (listing.donor_id === session.user.id) return true
  if (session.profile?.role === 'admin') return true
  return listing.status === 'available' && session.profile?.role === 'ngo'
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
