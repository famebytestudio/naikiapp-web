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

  2. NGO access requires an administrator-approved registration in addition to
     the NGO role. New registrations are always pending until reviewed.

  SECURITY: none of this is security. Accounts and a non-cryptographic password
  digest live in localStorage, readable and editable by anyone at the devtools
  console. That is acceptable for a demo and is categorically not acceptable in
  production. NGO document uploads in this demo are also stored there as data
  URLs; never use real identity documents until the private Supabase Storage flow
  is connected.
  ============================================================================
*/

import { isRole } from '../utils/roles'
import { validateSignUp } from '../utils/authValidation'
import { supabase } from './supabaseClient'

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
    account({
      id: communityNgoProfileId,
      email: 'pending@naikiapp.pk',
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

function ngoRecord({
  profileId,
  organisation,
  registrationNumber,
  verification,
  verifiedBy = null,
  idCardNumber = null,
  idCardDocument = null,
  officialLink = null,
  id,
}) {
  const now = new Date().toISOString()
  return {
    id: id ?? nextId(),
    profile_id: profileId,
    organisation,
    registration_number: registrationNumber,
    id_card_number: idCardNumber,
    id_card_document: idCardDocument,
    official_link: officialLink,
    verification_status: verification,
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

/* Demo accounts cover each role, with two NGOs exercising the same access. */
function seedAccounts() {
  const now = Date.now()
  const stamp = new Date(now - 3 * 24 * HOUR).toISOString()

  const adminId = nextId()
  const ngoProfileId = nextId()
  const communityNgoProfileId = nextId()

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
      id: ngoProfileId,
      email: 'ngo@naikiapp.pk',
      password: DEMO_PASSWORD,
      profile: profile({
        id: ngoProfileId,
        full_name: 'Sana Yousaf',
        organisation: 'Lahore Relief Trust',
        phone: '0423 555 0192',
        role: 'ngo',
        created_at: stamp,
        updated_at: stamp,
      }),
      ngo: ngoRecord({
        id: '77777777-7777-4777-8777-777777777777',
        profileId: ngoProfileId,
        organisation: 'Lahore Relief Trust',
        registrationNumber: 'LRT-2019-4412',
        verification: 'verified',
        verifiedBy: adminId,
      }),
    }),
    account({
      id: communityNgoProfileId,
      email: 'pending@naikiapp.pk',
      password: DEMO_PASSWORD,
      profile: profile({
        id: communityNgoProfileId,
        full_name: 'Kamran Butt',
        organisation: 'Sindh Welfare Trust',
        phone: '0213 555 0147',
        role: 'ngo',
        created_at: stamp,
        updated_at: stamp,
      }),
      ngo: ngoRecord({
        profileId: communityNgoProfileId,
        organisation: 'Sindh Welfare Trust',
        registrationNumber: 'SWT-2024-0918',
        verification: 'verified',
      }),
    }),
    account({
      id: adminId,
      email: 'admin@naikiapp.pk',
      password: DEMO_PASSWORD,
      profile: profile({
        id: adminId,
        full_name: 'DastarKhan Operations',
        organisation: 'DastarKhan',
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
    label: 'NGO',
    note: 'Can browse and claim available food',
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

  if (match.profile?.disabled_at) {
    writeJson(SESSION_KEY, null)
    return null
  }

  return toSession(match)
}

export async function loadSupabaseSession(authSession) {
  if (!authSession?.user) return null

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authSession.user.id)
    .single()
  if (profileError) throw profileError

  let ngo = null
  if (profileRow.role === 'ngo') {
    const { data, error } = await supabase
      .from('ngo_details')
      .select('*')
      .eq('profile_id', authSession.user.id)
      .maybeSingle()
    if (error) throw error
    ngo = data
  }

  return {
    user: { id: authSession.user.id, email: authSession.user.email },
    profile: profileRow,
    ngo,
  }
}

function idCardExtension(file) {
  const extensionByType = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  }
  const extension = extensionByType[file?.type]
  if (!extension) throw new Error('Upload a JPG, PNG, or PDF ID card.')
  if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('The ID card file must be smaller than 2 MB.')
  return extension
}

export async function uploadNgoIdCard(file, evidence = {}) {
  if (!supabase) {
    idCardExtension(file)
    const session = getSession()
    if (session?.profile?.role !== 'ngo') throw new Error('Sign in as an NGO before submitting registration evidence.')
    const registrationNumber = String(evidence.registration_number ?? '').trim()
    const idCardNumber = String(evidence.id_card_number ?? '').trim()
    const officialLink = String(evidence.official_link ?? '').trim()
    try {
      const url = new URL(officialLink)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      throw new Error('Enter a valid official link starting with http:// or https://.')
    }
    if (!registrationNumber || idCardNumber.length < 5 || idCardNumber.length > 50) {
      throw new Error('Enter the charity registration number and a valid representative ID number.')
    }
    const encodedDocument = await readFileAsDataUrl(file)
    const accounts = readAccounts()
    const email = Object.keys(accounts).find((key) => accounts[key].id === session.user.id)
    if (!email || accounts[email].profile?.role !== 'ngo' || !accounts[email].ngo) {
      throw new Error('That charity registration no longer exists.')
    }
    if (accounts[email].ngo.verification_status === 'verified') {
      throw new Error('The verified charity registration cannot be changed here.')
    }
    accounts[email].ngo = {
      ...accounts[email].ngo,
      registration_number: registrationNumber,
      id_card_number: idCardNumber,
      id_card_document: encodedDocument,
      official_link: officialLink,
      verification_status: 'pending',
      needs_info: false,
      review_note: null,
      updated_at: new Date().toISOString(),
    }
    writeAccounts(accounts)
    const saved = findAccount(email)
    if (saved?.ngo?.id_card_document !== encodedDocument) {
      throw new Error('Could not save the ID card in this browser. Try a smaller file or clear storage.')
    }
    const updatedSession = toSession(saved)
    emit(updatedSession)
    return updatedSession
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!session) throw new Error('Sign in before uploading your ID card.')

  const { data: currentNgo, error: ngoError } = await supabase
    .from('ngo_details')
    .select('id_card_document_path')
    .eq('profile_id', session.user.id)
    .maybeSingle()
  if (ngoError) throw ngoError
  if (!currentNgo) throw new Error('No NGO registration was found for this account.')

  const extension = idCardExtension(file)
  const fileId = globalThis.crypto?.randomUUID?.() ?? nextId()
  const path = `${session.user.id}/${fileId}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from('ngo-id-cards')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError

  const { error: submitError } = await supabase.rpc('submit_ngo_registration_evidence', {
    p_id_card_document_path: path,
    p_registration_number: evidence.registration_number ?? null,
    p_id_card_number: evidence.id_card_number ?? null,
    p_official_link: evidence.official_link ?? null,
  })
  if (submitError) {
    const { error: cleanupError } = await supabase.storage.from('ngo-id-cards').remove([path])
    if (cleanupError) console.error('Could not clean up an unlinked NGO ID document:', cleanupError.message)
    throw submitError
  }

  if (currentNgo.id_card_document_path && currentNgo.id_card_document_path !== path) {
    const { error: removeError } = await supabase.storage
      .from('ngo-id-cards')
      .remove([currentNgo.id_card_document_path])
    if (removeError) {
      throw new Error(`Evidence was submitted, but the replaced private document could not be deleted: ${removeError.message}`)
    }
  }

  return loadSupabaseSession(session)
}

// Public demo projection: never return credentials or private contact fields.
export function getPublicDemoProfiles() {
  return Object.values(readAccounts())
    .filter(({ profile }) => !profile.disabled_at && (profile.role === 'ngo' || (profile.role === 'donor' && !profile.is_anonymous)))
    .map(({ id, profile, ngo }) => ({
      id,
      role: profile.role,
      name: (ngo?.organisation || profile.organisation || (profile.role === 'donor' ? profile.full_name : '') || (profile.role === 'ngo' ? 'Community charity' : 'Community donor')).trim(),
    }))
}

export async function listRegisteredNgosForAdmin() {
  await latency()
  const session = getSession()
  if (session?.profile?.role !== 'admin') {
    throw new Error('Only administrators can view registered charities.')
  }

  return Object.values(readAccounts())
    .filter((entry) => entry.profile?.role === 'ngo')
    .map((entry) => ({
      id: entry.id,
      email: entry.email,
      fullName: entry.profile.full_name ?? '',
      organisation: entry.ngo?.organisation ?? entry.profile.organisation ?? '',
      phone: entry.profile.phone ?? '',
      registrationNumber: entry.ngo?.registration_number ?? null,
      idCardNumber: entry.ngo?.id_card_number ?? null,
      idCardDocument: entry.ngo?.id_card_document ?? null,
      officialLink: entry.ngo?.official_link ?? null,
      verificationStatus: entry.ngo?.verification_status ?? 'pending',
      needsInfo: Boolean(entry.ngo?.needs_info),
      reviewNote: entry.ngo?.review_note ?? null,
      registeredAt: entry.ngo?.created_at ?? entry.profile.created_at,
      disabledAt: entry.profile.disabled_at ?? null,
      disabledReason: entry.profile.disabled_reason ?? null,
    }))
    .sort((a, b) => new Date(b.registeredAt ?? 0) - new Date(a.registeredAt ?? 0))
}

export async function setNgoVerificationByAdmin(id, decision, note = '') {
  await latency()
  const session = getSession()
  if (session?.profile?.role !== 'admin' || session.profile?.disabled_at) {
    throw new Error('Only active administrators can review charity registrations.')
  }
  if (!['approve', 'reject', 'request_info'].includes(decision)) {
    throw new Error('Choose approve, reject, or request more information.')
  }

  const accounts = readAccounts()
  const entry = Object.values(accounts).find((accountEntry) => accountEntry.id === id)
  if (!entry || entry.profile?.role !== 'ngo' || !entry.ngo) {
    throw new Error('That charity registration no longer exists.')
  }
  if (decision !== 'approve' && !String(note).trim()) {
    throw new Error('Add a review note when rejecting or requesting information.')
  }
  if (
    decision === 'approve'
    && (
      !entry.ngo.registration_number?.trim()
      || !entry.ngo.id_card_number?.trim()
      || !entry.ngo.id_card_document
      || !entry.ngo.official_link?.trim()
    )
  ) {
    throw new Error('Complete registration, ID card, and official link evidence before approval.')
  }

  const timestamp = new Date().toISOString()
  entry.ngo = {
    ...entry.ngo,
    verification_status: decision === 'approve' ? 'verified' : decision === 'reject' ? 'rejected' : 'pending',
    needs_info: decision === 'request_info',
    review_note: String(note).trim() || null,
    verified_by: decision === 'approve' ? session.user.id : null,
    verified_at: decision === 'approve' ? timestamp : null,
    updated_at: timestamp,
  }
  writeAccounts(accounts)
  emit(getSession())
  return { id: entry.id, verificationStatus: entry.ngo.verification_status }
}

export async function setNgoDisabledByAdmin(id, disabled, reason = '') {
  await latency()
  const session = getSession()
  if (session?.profile?.role !== 'admin' || session.profile?.disabled_at) {
    throw new Error('Only active administrators can manage charity accounts.')
  }
  if (typeof disabled !== 'boolean') throw new Error('Choose whether to disable or enable this charity.')

  const accounts = readAccounts()
  const entry = Object.values(accounts).find((accountEntry) => accountEntry.id === id)
  if (!entry || entry.profile?.role !== 'ngo') throw new Error('That charity account no longer exists.')

  const timestamp = new Date().toISOString()
  entry.profile = {
    ...entry.profile,
    disabled_at: disabled ? timestamp : null,
    disabled_by: disabled ? session.user.id : null,
    disabled_reason: disabled ? String(reason).trim().slice(0, 500) : null,
    updated_at: timestamp,
  }
  writeAccounts(accounts)
  emit(getSession())
  return {
    id: entry.id,
    disabledAt: entry.profile.disabled_at,
    disabledReason: entry.profile.disabled_reason,
  }
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
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email ?? '').trim().toLowerCase(),
      password,
    })
    if (error) throw error
    return loadSupabaseSession(data.session)
  }

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
  if (accountEntry.profile?.disabled_at) {
    throw new Error('This charity account has been disabled. Contact DastarKhan support for help.')
  }

  writeJson(SESSION_KEY, accountEntry.id)
  const session = toSession(accountEntry)
  emit(session)
  return session
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read the ID card file. Please choose it again.'))
    }
    reader.onerror = () => reject(new Error('Could not read the ID card file. Please choose it again.'))
    reader.readAsDataURL(file)
  })
}

export async function signUp({
  email,
  password,
  full_name,
  organisation,
  phone,
  role,
  registration_number,
  id_card_number,
  id_card_file,
  official_link,
}) {
  await latency()
  const normalisedEmail = String(email ?? '').trim().toLowerCase()

  if (!supabase && findAccount(normalisedEmail)) {
    throw new Error('An account already exists for that email address. Try logging in instead.')
  }

  // The mirror of migration 0001's column grant: an account cannot be born with
  // a role its creator was not entitled to hand out.
  if (!isRole(role) || role === 'admin') {
    throw new Error('That account type cannot be created from sign-up.')
  }

  const validationErrors = validateSignUp({
    email,
    password,
    full_name,
    organisation,
    phone,
    role,
    registration_number,
    id_card_number,
    id_card_file,
    official_link,
    confirmPassword: password,
  })
  if (Object.keys(validationErrors).length) {
    throw new Error(Object.values(validationErrors)[0])
  }

  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: normalisedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/login`,
        data: {
          full_name: full_name.trim(),
          organisation: organisation?.trim() || '',
          phone: phone?.trim() || '',
          role,
          registration_number: registration_number?.trim() || '',
          id_card_number: id_card_number?.trim() || '',
          official_link: official_link?.trim() || '',
        },
      },
    })
    if (error) throw error

    if (!data.session) {
      return {
        needsEmailConfirmation: true,
        user: { id: data.user.id, email: data.user.email },
        profile: { role },
        ngo: null,
      }
    }

    if (role === 'ngo') {
      await uploadNgoIdCard(id_card_file, {
        registration_number,
        id_card_number,
        official_link,
      })
    }
    return loadSupabaseSession(data.session)
  }

  const idCardDocument = role === 'ngo' ? await readFileAsDataUrl(id_card_file) : null
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
            idCardNumber: id_card_number?.trim() || null,
            idCardDocument,
            officialLink: official_link?.trim() || null,
            verification: 'pending',
          })
        : null,
  })

  const accounts = readAccounts()
  accounts[normalisedEmail] = accountEntry
  writeAccounts(accounts)
  if (role === 'ngo' && findAccount(normalisedEmail)?.ngo?.id_card_document !== idCardDocument) {
    throw new Error('Could not securely save the ID card in this browser. Please try a smaller file.')
  }
  writeJson(SESSION_KEY, accountEntry.id)

  const session = toSession(accountEntry)
  emit(session)
  return session
}

export async function signOut() {
  if (supabase) {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return
  }

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
  if (supabase) {
    const allowedPatch = {}
    for (const column of PROFILE_WRITE_COLUMNS) {
      if (column in patch) allowedPatch[column] = patch[column]
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    if (!session) throw new Error('You need to be logged in to change your profile.')
    const { error } = await supabase.from('profiles').update(allowedPatch).eq('id', session.user.id)
    if (error) throw error
    return loadSupabaseSession(session)
  }

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
