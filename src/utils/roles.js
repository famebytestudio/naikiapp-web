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

