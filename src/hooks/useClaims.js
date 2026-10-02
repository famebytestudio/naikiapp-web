import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
	const { isDemoBackend, isAuthenticated, role, user } = useAuth()
	const queryClient = useQueryClient()
	const userId = user?.id ?? null
	const queryKey = ['claims', userId]
	const query = useQuery({
		queryKey,
		enabled: isAuthenticated && role === 'ngo',
		queryFn: async () => {
			if (isDemoBackend || !supabase) {
				return (await listMyClaims()).map(normalizeClaim)
			}

			const { data, error } = await supabase
				.from('donation_claims')
				.select('donation_id, ngo_id, claimed_at, donations (*)')
				.order('claimed_at', { ascending: false })
			if (error) throw error
			return (data ?? []).map(normalizeClaim)
		},
	})
	const refetchClaims = query.refetch

	const updateStatus = useCallback(async (donationId, status, actualKg = null) => {
		if (isDemoBackend || !supabase) {
			try {
				await updateMockClaimStatus(donationId, status, actualKg)
				await refetchClaims()
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
		if (!updateError) await refetchClaims()
		return { error: updateError }
	}, [isDemoBackend, refetchClaims])

	useEffect(() => {
		if (isDemoBackend || !supabase) return undefined

		const channel = supabase
			.channel('ngo-claims')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => {
				queryClient.invalidateQueries({ queryKey: ['claims', userId] })
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donation_status_log' }, () => {
				queryClient.invalidateQueries({ queryKey: ['claims', userId] })
			})
			.subscribe()

		return () => supabase.removeChannel(channel)
	}, [isDemoBackend, queryClient, userId])

	return {
		claims: query.data ?? [],
		loading: query.isLoading,
		error: query.error?.message ?? '',
		refresh: query.refetch,
		updateStatus,
	}
}