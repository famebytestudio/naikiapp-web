import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../context/useAuth'
import { decideVerification, listAccountsForAdmin } from '../lib/authApi'
import { listAll, removeListing, restoreListing } from '../lib/listingsApi'

/*
  Data fetching for the two admin screens, in the same shape as
  src/hooks/useListings.js: pages render, hooks fetch, and the keys are scoped
  to the signed-in user id so signing out and back in as somebody else cannot
  serve the previous account's data out of the cache.

  That scoping matters more here than anywhere else in the app. Every row these
  two queries return is one the signed-in user is not supposed to be able to
  read - other people's addresses and phone numbers, other charities'
  registrations - so a key that outlives the session would be a data leak, not
  a stale render.

  Both queries are additionally gated on role === 'admin' rather than on
  authentication alone. That is belt to the route guard's braces: the guard in
  App.jsx keeps a donor off /admin, and this stops a donor's session from
  issuing the reads at all. The real database refuses them either way, via
  donations_select_admin and profiles_select_own.
*/

export const adminKeys = {
  all: (userId) => ['admin', userId],
  accounts: (userId) => ['admin', userId, 'accounts'],
  listings: (userId) => ['admin', userId, 'listings'],
}

/*
  Every account, for the verification queue and for putting a donor's name
  against a listing in the moderation queue. One query feeds both screens.
*/
export function useAdminAccounts() {
  const { isAuthenticated, role, user } = useAuth()
  const userId = user?.id ?? null

  return useQuery({
    queryKey: adminKeys.accounts(userId),
    queryFn: listAccountsForAdmin,
    enabled: isAuthenticated && role === 'admin' && Boolean(userId),
  })
}

/* Every listing on the platform, whoever posted it. */
export function useAllListings() {
  const { isAuthenticated, role, user } = useAuth()
  const userId = user?.id ?? null

  return useQuery({
    queryKey: adminKeys.listings(userId),
    queryFn: listAll,
    enabled: isAuthenticated && role === 'admin' && Boolean(userId),
  })
}

/*
  A decision changes the account list, which is also what the donor-facing and
  account-facing caches are derived from - the approved charity has to see its
  new state. Invalidate on success rather than on settle, so the queue does not
  briefly render a decision that was refused.
*/
function useAdminMutation(mutationFn) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? null

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all(userId) }),
  })
}

export function useVerificationDecision() {
  return useAdminMutation(({ id, decision, reviewNote }) =>
    decideVerification(id, { decision, review_note: reviewNote }),
  )
}

export function useRemoveListing() {
  return useAdminMutation(({ id, reason }) => removeListing(id, { reason }))
}

export function useRestoreListing() {
  return useAdminMutation(restoreListing)
}
