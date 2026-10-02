import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { listMyClaims, updateClaimStatus as updateMockClaimStatus } from '../lib/listingsApi'
import { supabase } from '../lib/supabaseClient'
import { normalizeListing } from './useListings'

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '')
const asNullableNumber = (value) => {
	if (value === undefined || value === null || value === '') return null
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

const normalizeClaim = (row) => {
	const donation = row.donations ?? row.donation ?? row
	return {
	...normalizeListing(donation),
	claimedAt: row.claimed_at,
	status: donation.status ?? 'claimed',
	actualKg: asNullableNumber(firstValue(donation.actual_kg, donation.delivered_kg, row.actual_kg)),
	}
}

export function useClaims() {
	const { isDemoBackend } = useAuth()
	const [claims, setClaims] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const loadClaims = useCallback(async () => {
		if (isDemoBackend || !supabase) {
			try {
				const data = await listMyClaims()
				setClaims(data.map(normalizeClaim))
				setError('')
			} catch (queryError) {
				setClaims([])
				setError(queryError.message)
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
	}, [isDemoBackend])

	const updateStatus = useCallback(async (donationId, status, actualKg = null) => {
		if (isDemoBackend || !supabase) {
			try {
				await updateMockClaimStatus(donationId, status, actualKg)
				await loadClaims()
				return { error: null }
			} catch (error) {
				return { error }
			}
		}

		const { error: updateError } = await supabase.rpc('update_donation_status', {
			p_donation_id: donationId,
			p_next_status: status,
			p_actual_kg: actualKg,
		})
		if (!updateError) await loadClaims()
		return { error: updateError }
	}, [isDemoBackend, loadClaims])

	useEffect(() => {
		loadClaims()
		if (isDemoBackend || !supabase) return undefined

		const channel = supabase
			.channel('ngo-claims')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, loadClaims)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donation_status_log' }, loadClaims)
			.subscribe()

		return () => supabase.removeChannel(channel)
	}, [isDemoBackend, loadClaims])

	return { claims, loading, error, refresh: loadClaims, updateStatus }
}