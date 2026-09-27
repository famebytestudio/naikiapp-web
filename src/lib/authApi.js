/*
  ============================================================================
  DEV-ONLY MOCK IDENTITY STORE - NOT SUPABASE AUTH
  ============================================================================

  This module is the auth half of the seam described in AGENTS.md. It stands in
  for `supabase.auth` so the login, sign-up, sign-out and role-guard flows can be
  walked through end to end with no backend and no .env, and so swapping in real
  Supabase Auth is a change to the bodies of the functions below and nothing
  else.

  The interface deliberately mirrors supabase-js, so the mapping is one to one:

      here                        real Supabase
      --------------------------  ---------------------------------------------
      getSession()                auth.getSession()
      subscribe(cb)               auth.onAuthStateChange((_event, session) => ...)
      signIn({ email, password }) auth.signInWithPassword({ email, password })
      signUp(fields)              auth.signUp({ email, password, options })
      signOut()                   auth.signOut()

  Two rules are mirrored rather than mocked away, because getting them wrong in
  the mock is how they end up wrong in the app:

  1. THE ROLE IS NOT SELF-ASSIGNABLE TO ADMIN. Migration 0001 grants column-level
     UPDATE on profiles for full_name, organisation, phone and is_anonymous
     only, so `role` is unreachable from the client entirely. updateProfile()
     here filters to the same four columns, and signUp() rejects 'admin'.

  2. AN NGO ARRIVES 'pending', NEVER 'verified'. Migration 0002 pins the
     ngo_details_insert_own policy to verification = 'pending' with a null
     verified_by, so a self-registration cannot pre-approve itself.

  SECURITY: none of this is security. Accounts and a non-cryptographic password
  digest live in localStorage, readable and editable by anyone at the devtools
  console. That is acceptable for a demo and is categorically not acceptable in
  production - which is exactly why the whole thing lives behind this one module.
  ============================================================================
*/

import { isRole } from '../utils/roles'

const ACCOUNTS_KEY = 'naikiapp:mock:accounts:v1'
const SESSION_KEY = 'naikiapp:mock:session:v1'

/*
  The demo donor keeps the id the seeded listings in listingsApi.js already point
  at, so the sample data still belongs to the account you sign in as.
*/
export const DEMO_DONOR_ID = 'a3f1c8e2-5b7d-4a19-9c63-2e8f0b4d7a11'

const HOUR = 60 * 60_000

/* Simulated round-trip, so the loading state on the button is actually visible. */
const LATENCY = 220

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

function nextId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/*
  FNV-1a. This exists so the demo does not keep a plaintext password sitting in
  localStorage where it can be read at a glance - it is NOT a password hash and
  provides no protection whatsoever. A real deployment never sees this function;
  Supabase Auth does the hashing server-side with bcrypt.
*/
function digestPassword(value) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `demo$${hash.toString(16).padStart(8, '0')}`
}

/* ------------------------------------------------------------------ seeds */

const DEMO_PASSWORD = 'naiki123'

function profile(overrides) {
  const now = new Date().toISOString()
  return { id: overrides.id, full_name: null, organisation: null, phone: null, role: 'donor', is_anonymous: false, created_at: now, updated_at: now, ...overrides }
}

function ngoRecord({ profileId, organisation, registrationNumber, verification, verifiedBy = null, id }) {
  const now = new Date().toISOString()
  return {
    id: id ?? nextId(),
    profile_id: profileId,
    organisation,
    registration_number: registrationNumber,
    verification,
    verified_by: verifiedBy,
    // Only a decided application gets a decision timestamp.
    verified_at: verification === 'pending' ? null : now,
    created_at: now,
    updated_at: now,
  }
}

function account({ id, email, password, profile: profileRow, ngo = null }) {
  return {
    id,
    email: email.toLowerCase(),
    passwordDigest: digestPassword(password),
    profile: profileRow,
    ngo,
    created_at: new Date().toISOString(),
  }
}

/*
  One account per role, plus a second charity that is deliberately still pending.
  Without the pending one there is no way to demonstrate that an unverified NGO
  is kept out of the feed, which is the whole point of the verification step.
*/
function seedAccounts() {
  const now = Date.now()
  const stamp = new Date(now - 3 * 24 * HOUR).toISOString()

  const adminId = nextId()
  const verifiedNgoProfileId = nextId()
  const pendingNgoProfileId = nextId()

  return [
    account({
      id: DEMO_DONOR_ID,
      email: 'demo@naikiapp.pk',
      password: DEMO_PASSWORD,
      profile: profile({
        id: DEMO_DONOR_ID,
        full_name: 'Imran Shah',
        organisation: 'Shah Caterers',
        phone: '0300 1234567',
        role: 'donor',
        created_at: stamp,
        updated_at: stamp,
      }),
    }),
    account({
      id: verifiedNgoProfileId,
      email: 'ngo@naikiapp.pk',
      password: DEMO_PASSWORD,
      profile: profile({
        id: verifiedNgoProfileId,
        full_name: 'Sana Yousaf',
        organisation: 'Lahore Relief Trust',
        phone: '0423 555 0192',
        role: 'ngo',
        created_at: stamp,
        updated_at: stamp,
      }),
      ngo: ngoRecord({
        id: '77777777-7777-4777-8777-777777777777',
        profileId: verifiedNgoProfileId,
        organisation: 'Lahore Relief Trust',
        registrationNumber: 'LRT-2019-4412',
        verification: 'verified',
        verifiedBy: adminId,
      }),
    }),
    account({
      id: pendingNgoProfileId,
      email: 'pending@naikiapp.pk',
      password: DEMO_PASSWORD,
      profile: profile({
        id: pendingNgoProfileId,
        full_name: 'Kamran Butt',
        organisation: 'Sindh Welfare Trust',
        phone: '0213 555 0147',
        role: 'ngo',
        created_at: stamp,
        updated_at: stamp,
      }),
      ngo: ngoRecord({
        profileId: pendingNgoProfileId,
        organisation: 'Sindh Welfare Trust',
        registrationNumber: 'SWT-2024-0918',
        verification: 'pending',
      }),
    }),
    account({
      id: adminId,
      email: 'admin@naikiapp.pk',
      password: DEMO_PASSWORD,
      profile: profile({
        id: adminId,
        full_name: 'NaikiApp Operations',
        organisation: 'NaikiApp',
        phone: '0423 555 0100',
        role: 'admin',
        created_at: stamp,
        updated_at: stamp,
      }),
    }),
  ]
}

/*
  Shown on the login screen. Credentials are printed because this is a demo with
  no backend; there is nothing secret here to protect, and hiding the passwords
  would only make the role guards harder to exercise.
*/
export const DEMO_ACCOUNTS = [
  {
    email: 'demo@naikiapp.pk',
    password: DEMO_PASSWORD,
    role: 'donor',
    label: 'Donor',
    note: 'Five seeded listings across every status',
  },
  {
    email: 'ngo@naikiapp.pk',
    password: DEMO_PASSWORD,
    role: 'ngo',
    label: 'NGO, verified',
    note: 'Can browse and claim available food',
  },
  {
    email: 'pending@naikiapp.pk',
    password: DEMO_PASSWORD,
    role: 'ngo',
    label: 'NGO, pending',
    note: 'Blocked from the feed until an admin approves it',
  },
  {
    email: 'admin@naikiapp.pk',
    password: DEMO_PASSWORD,
    role: 'admin',
    label: 'Admin',
    note: 'Seeded for the demo; not reachable from sign-up',
  },
]

/* ---------------------------------------------------------------- storage */

function readAccounts() {
  const stored = readJson(ACCOUNTS_KEY, null)
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) return stored

  const seeded = {}
  for (const entry of seedAccounts()) seeded[entry.email] = entry
  writeJson(ACCOUNTS_KEY, seeded)
  return seeded
}

function writeAccounts(accounts) {
  writeJson(ACCOUNTS_KEY, accounts)
}

function findAccount(email) {
  return readAccounts()[String(email ?? '').trim().toLowerCase()] ?? null
}

/* --------------------------------------------------------------- session */

/*
  The shape AuthContext and every consumer sees. `user` is deliberately thin:
  nothing in the app is allowed to read a role off it.
*/
function toSession(accountEntry) {
  if (!accountEntry) return null
  return {
    user: { id: accountEntry.id, email: accountEntry.email },
    profile: accountEntry.profile,
    ngo: accountEntry.ngo,
  }
}

function readSessionUserId() {
  return readJson(SESSION_KEY, null)
}

export function getSession() {
  const userId = readSessionUserId()
  if (!userId) return null

  const match = Object.values(readAccounts()).find((entry) => entry.id === userId)
  // A session pointing at an account that no longer exists is a signed-out
  // session, not a crash. The demo reset path relies on this.
  if (!match) {
    writeJson(SESSION_KEY, null)
    return null
  }

  return toSession(match)
}

const listeners = new Set()

/*
  Cross-tab support. localStorage has no in-process event, so a second tab only
  learns about a sign-out if we listen for the storage event. Real Supabase
  handles this itself across tabs, which is another reason the swap is contained.
*/
function handleStorage(event) {
  if (event.key !== SESSION_KEY && event.key !== ACCOUNTS_KEY) return
  emit(getSession())
}

function emit(session) {
  for (const listener of listeners) listener(session)
}

/*
  The listener is called once on subscribe with the session as it stands right
  now, which is the INITIAL_SESSION event supabase-js fires. Consumers therefore
  learn the current state by subscribing and never need a separate read, so
  there is no window in which a guard could decide on a session nobody told it
  about.
*/
export function subscribe(listener) {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage)
  }

  listener(getSession())

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage)
    }
  }
}

/* ------------------------------------------------------------------ write */

export async function signIn({ email, password }) {
  await latency()
  const accountEntry = findAccount(email)

  /*
    One message for "no such account" and for "wrong password", so the form
    cannot be used to enumerate which addresses are registered. Real Supabase
    behaves the same way for the same reason.
  */
  if (!accountEntry || accountEntry.passwordDigest !== digestPassword(password)) {
    throw new Error('That email and password do not match an account.')
  }

  writeJson(SESSION_KEY, accountEntry.id)
  const session = toSession(accountEntry)
  emit(session)
  return session
}

export async function signUp({ email, password, full_name, organisation, phone, role, registration_number }) {
  await latency()
  const normalisedEmail = String(email ?? '').trim().toLowerCase()

  if (findAccount(normalisedEmail)) {
    throw new Error('An account already exists for that email address. Try logging in instead.')
  }

  // The mirror of migration 0001's column grant: an account cannot be born with
  // a role its creator was not entitled to hand out.
  if (!isRole(role) || role === 'admin') {
    throw new Error('That account type cannot be created from sign-up.')
  }

  const id = nextId()
  const profileRow = profile({
    id,
    full_name: full_name?.trim() || null,
    // For a donor the organisation is optional; for a charity it is the name it
    // is registering under, and authValidation requires it.
    organisation: organisation?.trim() || null,
    phone: phone?.trim() || null,
    role,
  })

  const accountEntry = account({
    id,
    email: normalisedEmail,
    password,
    profile: profileRow,
    ngo:
      role === 'ngo'
        ? // Always 'pending', with no verified_by - the ngo_details_insert_own
          // policy in migration 0002 pins it there so a charity cannot approve
          // itself at sign-up.
          ngoRecord({
            profileId: id,
            organisation: profileRow.organisation,
            registrationNumber: registration_number?.trim() || null,
            verification: 'pending',
          })
        : null,
  })

  const accounts = readAccounts()
  accounts[normalisedEmail] = accountEntry
  writeAccounts(accounts)
  writeJson(SESSION_KEY, accountEntry.id)

  const session = toSession(accountEntry)
  emit(session)
  return session
}

export async function signOut() {
  await latency(80)
  writeJson(SESSION_KEY, null)
  emit(null)
}

/*
  The four columns migration 0001 actually grants to a signed-in user. `role` and
  `id` are not in the list and cannot be added to it from here, so no caller -
  however it got hold of this function - can promote itself to admin.
*/
const PROFILE_WRITE_COLUMNS = ['full_name', 'organisation', 'phone', 'is_anonymous']

export async function updateProfile(patch) {
  await latency(120)
  const session = getSession()
  if (!session) throw new Error('You need to be logged in to change your profile.')

  const accounts = readAccounts()
  const key = Object.keys(accounts).find((email) => accounts[email].id === session.user.id)
  if (!key) throw new Error('That account no longer exists.')

  const current = accounts[key]
  const next = { ...current.profile }
  for (const column of PROFILE_WRITE_COLUMNS) {
    if (column in patch) next[column] = patch[column]
  }
  next.updated_at = new Date().toISOString()

  accounts[key] = { ...current, profile: next }
  writeAccounts(accounts)

  const updated = toSession(accounts[key])
  emit(updated)
  return updated
}

/* Restore the seeded accounts, so the demo can be replayed from a clean slate. */
export function resetAuthData() {
  try {
    window.localStorage.removeItem(ACCOUNTS_KEY)
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
  readAccounts()
  emit(null)
}
