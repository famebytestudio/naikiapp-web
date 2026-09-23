import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const demoListings = [
	{ id: 'demo-1', food: 'Chicken biryani', type: 'Cooked', quantity: 120, unit: 'plates', kg: 42, city: 'Lahore', area: 'Gulberg III', address: 'Gulberg III, Lahore', pickupStart: '2026-09-22T20:00:00', pickupEnd: '2026-09-22T21:30:00', expiresAt: '2026-09-22T22:00:00', donor: 'Al-Noor Wedding Hall', status: 'available' },
	{ id: 'demo-2', food: 'Fresh bread and buns', type: 'Bakery', quantity: 80, unit: 'packs', kg: 18, city: 'Lahore', area: 'Johar Town', address: 'Johar Town, Lahore', pickupStart: '2026-09-22T18:30:00', pickupEnd: '2026-09-22T19:30:00', expiresAt: '2026-09-22T20:00:00', donor: 'Anonymous', status: 'available' },
	{ id: 'demo-3', food: 'Mixed vegetables', type: 'Fresh produce', quantity: 1, unit: 'lot', kg: 25, city: 'Islamabad', area: 'G-9 Markaz', address: 'G-9 Markaz, Islamabad', pickupStart: '2026-09-22T17:00:00', pickupEnd: '2026-09-22T18:00:00', expiresAt: '2026-09-22T18:30:00', donor: 'Chaudhry Grocers', status: 'available' },
]

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '')

export function normalizeListing(row) {
	return {
		id: row.id,
		food: firstValue(row.food, row.food_name, row.title, 'Surplus food'),
		type: firstValue(row.food_type, row.type, 'Other'),
		quantity: firstValue(row.quantity, row.quantity_value, row.plates, 0),
		unit: firstValue(row.unit, row.quantity_unit, 'kg'),
		kg: Number(firstValue(row.kg, row.weight_kg, row.quantity_kg, 0)),
		city: firstValue(row.city, row.location_city, 'Unknown city'),
		area: firstValue(row.area, row.location_area, 'Nearby area'),
		address: firstValue(row.address, row.pickup_address, `${firstValue(row.area, row.location_area, '')}, ${firstValue(row.city, row.location_city, '')}`),
		pickupStart: firstValue(row.pickup_start, row.pickup_window_start, row.pickup_from),
		pickupEnd: firstValue(row.pickup_end, row.pickup_window_end, row.pickup_to),
		expiresAt: firstValue(row.expires_at, row.expiry_time, row.expiry),
		createdAt: firstValue(row.created_at, row.createdAt),
		donor: row.is_anonymous ? 'Anonymous' : firstValue(row.donor_name, row.donor?.full_name, row.profile?.full_name, 'Anonymous'),
		status: firstValue(row.status, 'available'),
		description: firstValue(row.description, ''),
	}
}

export function useListings() {
	const [listings, setListings] = useState(() => (supabase ? [] : demoListings))
	const [loading, setLoading] = useState(Boolean(supabase))
	const [error, setError] = useState('')

	const loadListings = useCallback(async () => {
		if (!supabase) return
		const { data, error: queryError } = await supabase.from('donations').select('*').order('expires_at', { ascending: true })
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
		if (!supabase) return undefined

		const channel = supabase
			.channel('ngo-live-listings')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, loadListings)
			.subscribe()

		return () => supabase.removeChannel(channel)
	}, [loadListings])

	return { listings, loading, error, refresh: loadListings }
}
