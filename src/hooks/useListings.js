import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabaseClient'
import { listAvailable } from '../lib/listingsApi'

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '')
const asNullableNumber = (value) => {
	const nextValue = firstValue(value, null)
	if (nextValue === undefined || nextValue === null || nextValue === '') return null
	const parsed = Number(nextValue)
	return Number.isFinite(parsed) ? parsed : null
}

export function normalizeListing(row) {
	return {
		id: row.id,
		food: firstValue(row.food, row.food_name, row.title, 'Surplus food'),
		type: firstValue(row.food_type, row.type, 'Other'),
		quantity: firstValue(row.quantity, row.quantity_value, row.plates, 0),
		unit: firstValue(row.unit, row.quantity_unit, 'kg'),
		kg: Number(firstValue(row.kg, row.weight_kg, row.quantity_kg, row.estimated_kg, 0)),
		actualKg: asNullableNumber(row.actual_kg ?? row.delivered_kg ?? row.actual_kg_delivered),
		city: firstValue(row.city, row.location_city, 'Unknown city'),
		area: firstValue(row.area, row.location_area, 'Nearby area'),
		address: firstValue(row.address, row.pickup_address, `${firstValue(row.area, row.location_area, '')}, ${firstValue(row.city, row.location_city, '')}`),
		pickupStart: firstValue(row.pickup_start, row.pickup_start_at, row.pickup_window_start, row.pickup_from),
		pickupEnd: firstValue(row.pickup_end, row.pickup_end_at, row.pickup_window_end, row.pickup_to),
		expiresAt: firstValue(row.expires_at, row.expiry_at, row.expiry_time, row.expiry),
		createdAt: firstValue(row.created_at, row.createdAt),
    donor: row.is_anonymous ? 'Anonymous' : firstValue(row.donor_name, row.donor?.full_name, row.profile?.full_name, row.contact_name, 'Anonymous'),
		status: firstValue(row.status, 'available'),
		description: firstValue(row.description, ''),
	}
}

export function useListings() {
  const { isDemoBackend } = useAuth()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const loadListings = useCallback(async () => {
    if (isDemoBackend || !supabase) {
      try {
        const data = await listAvailable()
        setListings(data.map(normalizeListing))
        setError('')
      } catch (queryError) {
        setListings([])
        setError(queryError.message)
      }
			setLoading(false)
			return
		}

		const { data, error: queryError } = await supabase.from('donations').select('*').order('expiry_at', { ascending: true })
		if (queryError) {
			setError(queryError.message)
		} else {
			const now = Date.now()
			setListings((data ?? []).map(normalizeListing).filter((listing) => listing.status === 'available' && (!listing.expiresAt || new Date(listing.expiresAt).getTime() > now)))
			setError('')
		}
		setLoading(false)
  }, [isDemoBackend])

	useEffect(() => {
		loadListings()
		if (!supabase) return undefined

		const channel = supabase
			.channel('ngo-live-listings')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, loadListings)
			.subscribe()

		return () => supabase.removeChannel(channel)
	}, [loadListings])

	return { listings, loading, error, refresh: loadListings }
}
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { cancel, create, getById, listMine, update } from '../lib/listingsApi'
import { getClaimingNgo } from '../lib/ngoApi'
import { isStillMoving } from '../utils/listingTimeline'

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

/*
  `live` polls while the listing is still moving, and stops the moment it cannot
  move again. The donor's detail page is the only caller: a donor watching a van
  is the one user actively waiting for someone else's write to land, and 15s is
  the same cadence the CountdownTag clock already ticks at, so the screen
  updates in step with its own countdown.

  A terminal listing - delivered, expired, cancelled - never transitions again,
  so polling it would be traffic against a number that cannot change.
*/
const LIVE_POLL_MS = 15_000

export function useListing(id, { live = false } = {}) {
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id ?? null

  return useQuery({
    queryKey: listingKeys.detail(userId, id),
    queryFn: () => getById(id),
    enabled: Boolean(id) && isAuthenticated && Boolean(userId),
    refetchInterval: live ? LIVE_POLL_MS : false,
  })
}

export const claimingNgoKeys = {
  byDonation: (userId, donationId) => ['ngo', userId, 'claiming', donationId],
}

/*
  The charity that claimed a listing, as the donor sees it.

  Disabled until a claimed_by is actually known, so an available listing never
  fires a lookup that could only come back null - and so the RLS refusal in
  ngoApi.js is never the thing standing between a donor and a page that renders.

  null is a legitimate answer here, not an error: an unclaimed listing, a listing
  owned by somebody else, and a listing pointing at a charity that is no longer
  on file all resolve to null, exactly as they would under the 0007 policies. The
  components treat null as "nobody has claimed this yet" rather than surfacing
  an error the donor can do nothing about.

  Polled on the same 15s cadence as the listing itself, and only while it is
  still moving, so a donor watching a pickup sees a verification change without
  reloading.
*/
export function useClaimingNgo(donationId, { status, claimedBy, live = false } = {}) {
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id ?? null

  return useQuery({
    queryKey: claimingNgoKeys.byDonation(userId, donationId),
    queryFn: () => getClaimingNgo(donationId),
    /*
      Gated on claimedBy rather than on the donation id alone, which is what the
      note above describes. getClaimingNgo() re-derives the claim from the store
      and returns null for an unclaimed listing, so without this gate an
      available listing fired a lookup whose only possible answer was null.

      Reading the claim off the caller's listing rather than accepting it is
      still what ngoApi.js enforces - this is purely a "don't ask when there is
      nothing to ask about" guard, and a forged claimedBy buys nothing because
      the lookup re-derives it.

      Gating on claimedBy is also what lets the query start on its own. The
      listing is polled every 15s while it is moving, so the moment a charity
      claims it claimedBy becomes non-null, enabled flips to true, and the
      charity card appears without the donor reloading.
    */
    enabled: Boolean(donationId) && Boolean(claimedBy) && isAuthenticated && Boolean(userId),
    refetchInterval: live && isStillMoving(status) ? 15_000 : false,
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
