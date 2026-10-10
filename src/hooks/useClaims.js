import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { normalizeListing } from './useListings'
import { listMyClaims, updateClaimStatus } from '../lib/listingsApi'

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '')
const asNullableNumber = (value) => {
	if (value === undefined || value === null || value === '') return null
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

const normalizeClaim = (row) => ({
	...normalizeListing(row.donations ?? row.donation ?? {}),
	claimedAt: row.claimed_at,
	status: row.donations?.status ?? row.donation?.status ?? 'claimed',
	actualKg: asNullableNumber(firstValue(row.donations?.actual_kg, row.donations?.delivered_kg, row.donation?.actual_kg, row.donation?.delivered_kg, row.actual_kg)),
})

export function useClaims() {
	const [claims, setClaims] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const loadClaims = useCallback(async () => {
		if (!supabase) {
			try {
				const data = await listMyClaims()
				setClaims(data.map((listing) => ({
					...normalizeListing(listing),
					claimedAt: listing.claimed_at,
				})))
				setError('')
			} catch (loadError) {
				setError(loadError.message)
			}
			setLoading(false)
			return
		}
		const { data, error: queryError } = await supabase
			.from('donation_claims')
			.select('donation_id, ngo_id, claimed_at, donations (*)')
			.order('claimed_at', { ascending: false })

		if (queryError) setError(queryError.message)
		else {
			setClaims((data ?? []).map(normalizeClaim))
			setError('')
		}
		setLoading(false)
	}, [])

	const updateStatus = useCallback(async (donationId, status, actualKg = null) => {
		try {
			if (!supabase) {
				await updateClaimStatus(donationId, status, actualKg)
			} else {
				const { error: updateError } = await supabase.rpc('update_donation_status', {
					p_donation_id: donationId,
					p_next_status: status,
					p_actual_kg: actualKg,
				})
				if (updateError) throw updateError
			}
			await loadClaims()
			return { error: null }
		} catch (updateError) {
			return { error: updateError }
		}
	}, [loadClaims])

	useEffect(() => {
		loadClaims()
		if (!supabase) {
			window.addEventListener('naikiapp:listings-changed', loadClaims)
			return () => window.removeEventListener('naikiapp:listings-changed', loadClaims)
		}

		const channel = supabase
			.channel('ngo-claims')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, loadClaims)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donation_status_log' }, loadClaims)
			.subscribe()

		return () => supabase.removeChannel(channel)
	}, [loadClaims])

	return { claims, loading, error, refresh: loadClaims, updateStatus }
}