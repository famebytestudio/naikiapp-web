import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../context/useAuth'
import { cancel, create, getById, listMine, update } from '../lib/listingsApi'

/*
  All data fetching for the donor portal lives here, per the architecture in
  AGENTS.md: pages render, hooks fetch. The swap to real Supabase queries
  happens by replacing the imported functions from src/lib/listingsApi.js - the
  hook bodies, keys and the components that consume them stay as they are.

  Every key is scoped to the signed-in user id. Without that, signing out and back
  in as somebody else would serve the previous account's listings straight out of
  the cache for the staleTime window - which for this app means showing one donor
  another donor's address and contact details.
*/

export const listingKeys = {
  all: (userId) => ['donations', userId],
  mine: (userId) => ['donations', userId, 'mine'],
  detail: (userId, id) => ['donations', userId, 'detail', id],
}

export function useMyListings({ enabled = true } = {}) {
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id ?? null

  return useQuery({
    queryKey: listingKeys.mine(userId),
    queryFn: listMine,
    enabled: enabled && isAuthenticated && Boolean(userId),
  })
}

export function useListing(id) {
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id ?? null

  return useQuery({
    queryKey: listingKeys.detail(userId, id),
    queryFn: () => getById(id),
    enabled: Boolean(id) && isAuthenticated && Boolean(userId),
  })
}

/*
  Every write invalidates the donor's list, because one mutation can change both
  the row and the counts the page derives from it.
*/
function useListingMutation(mutationFn) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listingKeys.all(user?.id ?? null) }),
  })
}

export function useCreateListing() {
  return useListingMutation(create)
}

export function useUpdateListing() {
  return useListingMutation(({ id, values }) => update(id, values))
}

export function useCancelListing() {
  return useListingMutation(cancel)
}
