import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { listAvailable } from '../lib/listingsApi'
import { DELIVERY_RADIUS_KM } from '../utils/distance'

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
		pickup_latitude: asNullableNumber(row.pickup_latitude),
		pickup_longitude: asNullableNumber(row.pickup_longitude),
		delivery_radius_km: Number(firstValue(row.delivery_radius_km, DELIVERY_RADIUS_KM)),
		pickupStart: firstValue(row.pickup_start, row.pickup_start_at, row.pickup_window_start, row.pickup_from),
		pickupEnd: firstValue(row.pickup_end, row.pickup_end_at, row.pickup_window_end, row.pickup_to),
		expiresAt: firstValue(row.expires_at, row.expiry_at, row.expiry_time, row.expiry),
		createdAt: firstValue(row.created_at, row.createdAt),
		donor: row.is_anonymous ? 'Anonymous' : firstValue(row.donor_name, row.donor?.full_name, row.profile?.full_name, 'Anonymous'),
		status: firstValue(row.status, 'available'),
		description: firstValue(row.description, ''),
	}
}

export function useListings() {
	const [listings, setListings] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const loadListings = useCallback(async () => {
		if (!supabase) {
			try {
				const rows = await listAvailable()
				setListings(rows.map(normalizeListing))
				setError('')
			} catch (loadError) {
				setError(loadError.message)
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
	}, [])

	useEffect(() => {
		loadListings()
		if (!supabase) {
			window.addEventListener('naikiapp:listings-changed', loadListings)
			return () => window.removeEventListener('naikiapp:listings-changed', loadListings)
		}

		const channel = supabase
			.channel('ngo-live-listings')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, loadListings)
			.subscribe()

		return () => supabase.removeChannel(channel)
	}, [loadListings])

	return { listings, loading, error, refresh: loadListings }
}
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
