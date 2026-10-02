import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useMyListings } from './useListings'
import { summariseImpact } from '../utils/impact'

const emptyStats = {
	rescues: 0,
	activeRescues: 0,
	delivered: 0,
	deliveredKg: 0,
	claimed: 0,
	pickedUp: 0,
	byCity: [],
}

const demoStats = {
	rescues: 18,
	activeRescues: 4,
	delivered: 14,
	deliveredKg: 186.5,
	claimed: 9,
	pickedUp: 5,
	byCity: [
		{ city: 'Lahore', value: 9 },
		{ city: 'Islamabad', value: 6 },
		{ city: 'Karachi', value: 3 },
	],
}

const toNumber = (value) => {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : 0
}

async function fetchImpactStats() {
	if (!supabase) return demoStats

	const { data, error } = await supabase
		.from('donations')
		.select('id, status, estimated_kg, delivered_kg, city')
		.order('updated_at', { ascending: false })
	if (error) throw error

	const donations = data ?? []
	const deliveredDonations = donations.filter((donation) => donation.status === 'delivered')
	const activeDonations = donations.filter((donation) => ['claimed', 'picked_up'].includes(donation.status))
	const rescuedDonations = donations.filter((donation) => ['claimed', 'picked_up', 'delivered'].includes(donation.status))
	const deliveredKg = deliveredDonations.reduce((sum, donation) => sum + toNumber(donation.delivered_kg ?? donation.estimated_kg ?? 0), 0)
	const byCity = Object.entries(donations.reduce((groups, donation) => {
		const city = donation.city || 'Unknown city'
		groups[city] = (groups[city] ?? 0) + 1
		return groups
	}, {})).map(([city, value]) => ({ city, value })).sort((a, b) => b.value - a.value).slice(0, 5)

	return {
		rescues: rescuedDonations.length,
		activeRescues: activeDonations.length,
		delivered: deliveredDonations.length,
		deliveredKg,
		claimed: donations.filter((donation) => donation.status === 'claimed').length,
		pickedUp: donations.filter((donation) => donation.status === 'picked_up').length,
		byCity,
	}
}

export function useImpact() {
	const query = useMyListings()
	const impact = useMemo(() => summariseImpact(query.data ?? []), [query.data])
	const queryClient = useQueryClient()
	const statsQuery = useQuery({
		queryKey: ['impact', 'platform'],
		queryFn: fetchImpactStats,
		initialData: supabase ? undefined : demoStats,
	})

	useEffect(() => {
		if (!supabase) return undefined

		const channel = supabase
			.channel('impact-dashboard')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => {
				queryClient.invalidateQueries({ queryKey: ['impact', 'platform'] })
			})
			.subscribe()

		return () => supabase.removeChannel(channel)
	}, [queryClient])

	return {
		...query,
		impact,
		stats: statsQuery.data ?? emptyStats,
		loading: statsQuery.isLoading,
		error: statsQuery.error ?? query.error,
	}
}
