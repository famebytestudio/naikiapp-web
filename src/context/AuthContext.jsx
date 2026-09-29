import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  subscribe,
  updateProfile as apiUpdateProfile,
} from '../lib/authApi'
import { AuthContext } from './useAuth'

/*
  ============================================================================
  SESSION + PROVIDER
  ============================================================================

  Reads the current session once on mount and then follows changes, which is the
  same lifecycle supabase-js drives with getSession() plus onAuthStateChange().
  The shape exposed here is the one the real client will produce - user, profile,
  role, isAuthenticated, loading, signIn/signUp/signOut/updateProfile - so
  swapping the mock for Supabase Auth means changing the import list and the
  bodies of the callbacks below. No page reads the client directly, so no page
  changes.

  The context object and useAuth live in ./useAuth.js so this file exports only
  a component.

  KNOWN GAP, carried over from migration 0001 rather than worked around here:
  handle_new_user() creates every new auth user as a donor, and the role column
  is unreachable from the client, so on a real database an NGO that registers
  itself would arrive as a donor with a pending ngo_details row and no way to
  become 'ngo' without an admin or service-role update. This mock lets an NGO
  sign up as an NGO because that is the product flow, and the promotion path
  needs a migration that does not exist yet. See the note in the summary.
  ============================================================================
*/

export function AuthProvider({ children }) {
  /*
    `ready` is the honest name for "the store has told us what the session is".
    It is false on the first render and true once the store has reported in, and
    `loading` is derived from it rather than tracked separately.

    There is deliberately no separate read on mount. Subscribing *is* the read:
    authApi's subscribe() emits the current session immediately, the same way
    supabase-js fires INITIAL_SESSION. So a guard can never render a decision
    based on a session it has not been told about, and there is no synchronous
    setState starting a second render from inside the effect.
  */
  const [state, setState] = useState({ session: null, ready: false })

  useEffect(() => {
    // Covers sign-in, sign-out, the anonymity toggle, and a sign-out in another
    // tab, all from one subscription.
    return subscribe((session) => setState({ session, ready: true }))
  }, [])

  const { session, ready } = state

  const signIn = useCallback(async (credentials) => {
    const next = await apiSignIn(credentials)
    setState({ session: next, ready: true })
    return next
  }, [])

  const signUp = useCallback(async (fields) => {
    const next = await apiSignUp(fields)
    setState({ session: next, ready: true })
    return next
  }, [])

  const signOut = useCallback(async () => {
    await apiSignOut()
    setState({ session: null, ready: true })
  }, [])

  /*
    The anonymity toggle writes straight to the profile record. The context is
    updated from the returned row rather than optimistically, so what the navbar
    renders is what the database actually holds.
  */
  const saveProfile = useCallback(async (patch) => {
    const next = await apiUpdateProfile(patch)
    setState({ session: next, ready: true })
    return next.profile
  }, [])

  const value = useMemo(() => {
    const role = session?.profile?.role ?? null

    return {
      user: session?.user ?? null,
      profile: session?.profile ?? null,
      // The NGO registration record, mirroring ngo_details. Null for a donor.
      ngo: session?.ngo ?? null,
      // The role lives on the profile record, never derived from user metadata.
      role,
      isAuthenticated: Boolean(session),
      // Anonymity is a donor preference, so it is only ever true for a donor. A
      // charity registering as 'anonymous' would be a bug, not a setting.
      isAnonymous: role === 'donor' && Boolean(session?.profile?.is_anonymous),
      loading: !ready,
      signIn,
      signUp,
      signOut,
      updateProfile: saveProfile,
      // True while auth is served by the local mock. Flips to false with the
      // Supabase swap; nothing should branch on it except demo copy.
      isDemoBackend: true,
    }
  }, [session, ready, signIn, signUp, signOut, saveProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
