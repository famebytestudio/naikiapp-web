import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { normalizeListing } from './useListings'

const normalizeClaim = (row) => ({
	...normalizeListing(row.donations ?? row.donation ?? {}),
	claimedAt: row.claimed_at,
	status: row.donations?.status ?? row.donation?.status ?? 'claimed',
})

export function useClaims() {
	const [claims, setClaims] = useState([])
	const [loading, setLoading] = useState(Boolean(supabase))
	const [error, setError] = useState('')

	const loadClaims = useCallback(async () => {
		if (!supabase) return
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

	const updateStatus = useCallback(async (donationId, status) => {
		if (!supabase) return { error: new Error('Live claims are unavailable until Supabase is configured.') }
		const { error: updateError } = await supabase.rpc('update_donation_status', {
			p_donation_id: donationId,
			p_next_status: status,
		})
		if (!updateError) await loadClaims()
		return { error: updateError }
	}, [loadClaims])

	useEffect(() => {
		loadClaims()
		if (!supabase) return undefined

		const channel = supabase
			.channel('ngo-claims')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donation_claims' }, loadClaims)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, loadClaims)
			.subscribe()

		return () => supabase.removeChannel(channel)
	}, [loadClaims])

	return { claims, loading, error, refresh: loadClaims, updateStatus }
}