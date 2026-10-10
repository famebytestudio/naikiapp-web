import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  loadSupabaseSession,
  uploadNgoIdCard,
  subscribe,
  updateProfile as apiUpdateProfile,
} from '../lib/authApi'
import { supabase } from '../lib/supabaseClient'
import { AuthContext } from './useAuth'

/*
  ============================================================================
  SESSION + PROVIDER
  ============================================================================

  The context keeps session access centralized. When Supabase credentials are
  configured it uses Supabase Auth and profiles; otherwise it uses local demo
  auth.

  The context object and useAuth live in ./useAuth.js so this file exports only
  a component.

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
    if (supabase) {
      let active = true
      let requestId = 0

      async function hydrate(authSession) {
        const currentRequest = ++requestId
        try {
          const session = await loadSupabaseSession(authSession)
          if (active && currentRequest === requestId) setState({ session, ready: true })
        } catch (error) {
          console.error('Could not load the signed-in Supabase profile:', error)
          if (active && currentRequest === requestId) setState({ session: null, ready: true })
        }
      }

      supabase.auth.getSession()
        .then(({ data, error }) => {
          if (error) throw error
          return hydrate(data.session)
        })
        .catch((error) => {
          console.error('Could not restore the Supabase session:', error)
          if (active) setState({ session: null, ready: true })
        })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
        queueMicrotask(() => hydrate(authSession))
      })

      return () => {
        active = false
        subscription.unsubscribe()
      }
    }

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

  const submitNgoIdCard = useCallback(async (file, evidence) => {
    const next = await uploadNgoIdCard(file, evidence)
    setState({ session: next, ready: true })
    return next.ngo
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
      submitNgoIdCard,
      // True while auth is served by the local mock. Flips to false with the
      // Supabase swap; nothing should branch on it except demo copy.
      isDemoBackend: !supabase,
    }
  }, [session, ready, signIn, signUp, signOut, saveProfile, submitNgoIdCard])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
