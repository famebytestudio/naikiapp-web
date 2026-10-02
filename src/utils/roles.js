/*
  The three roles, and where each one lands after signing in.

  `role` is stored on the profiles record and nowhere else. It is deliberately
  NOT derived from user metadata, because RLS policies have to read it on every
  request and metadata is not a dependable source for an authorization decision
  - see supabase/migrations/0001_create_profiles.sql.

  Everything here is pure derivation, so it belongs in utils rather than in the
  provider. The router, the navbar and the auth screens all import from this one
  module, which is what stops the three of them disagreeing about where a role
  belongs.
*/

export const ROLES = ['donor', 'ngo', 'admin']

export const ROLE_META = {
  donor: {
    label: 'Donor',
    // Home is the listing list rather than an impact page, because that is the
    // screen a donor needs in order to act.
    home: '/donor/listings',
    blurb: 'Post surplus food and track what gets picked up.',
  },
  ngo: {
    label: 'NGO',
    home: '/ngo/feed',
    blurb: 'Claim available food and deliver it to people who need it.',
  },
  admin: {
    label: 'Admin',
    home: '/admin/listings',
    blurb: 'Manage listings across the platform.',
  },
}

export const NGO_VERIFICATIONS = ['pending', 'verified', 'rejected']

export const NGO_VERIFICATION_META = {
  pending: {
    label: 'Awaiting verification',
    tone: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    blurb: 'An admin is checking your registration. You will be able to browse available food as soon as it is approved.',
  },
  verified: {
    label: 'Verified',
    tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    blurb: 'You can claim food and post deliveries.',
  },
  rejected: {
    label: 'Not verified',
    tone: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
    blurb: 'Your registration was not approved. Check the details you submitted and contact the platform team.',
  },
}

export function isRole(value) {
  return ROLES.includes(value)
}

export function roleLabel(role) {
  return ROLE_META[role]?.label ?? null
}

/*
  Falls back to '/' rather than to the login screen. The fallback matters: a
  guard that redirects a signed-in user with an unexpected role to
  /auth/login would bounce straight back here, because the login screen sends
  authenticated users to their own home. Landing on the marketing page is the
  one destination that always terminates.
*/
export function homeForRole(role) {
  return ROLE_META[role]?.home ?? '/'
}

export function ngoVerificationLabel(verification) {
  return NGO_VERIFICATION_META[verification]?.label ?? verification
}

