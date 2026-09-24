import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const emptyStats = {
	rescues: 0,
	activeRescues: 0,
	delivered: 0,
	deliveredKg: 0,
	claimed: 0,
	pickedUp: 0,
	byCity: [],
}

const toNumber = (value) => {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : 0
}

export function useImpact() {
	const [stats, setStats] = useState(emptyStats)
	const [loading, setLoading] = useState(Boolean(supabase))
	const [error, setError] = useState('')

	const loadImpact = useCallback(async () => {
		if (!supabase) {
			setStats({
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
			})
			setLoading(false)
			return
		}

		const { data, error: queryError } = await supabase
			.from('donations')
			.select('id, status, kg, actual_kg, city')
			.order('updated_at', { ascending: false })

		if (queryError) {
			setError(queryError.message)
			setLoading(false)
			return
		}

		const donations = data ?? []
		const deliveredDonations = donations.filter((donation) => donation.status === 'delivered')
		const activeDonations = donations.filter((donation) => ['claimed', 'picked_up'].includes(donation.status))
		const rescuedDonations = donations.filter((donation) => ['claimed', 'picked_up', 'delivered'].includes(donation.status))
		const deliveredKg = deliveredDonations.reduce((sum, donation) => sum + toNumber(donation.actual_kg ?? donation.kg ?? 0), 0)
		const byCity = Object.entries(donations.reduce((groups, donation) => {
			const city = donation.city || 'Unknown city'
			groups[city] = (groups[city] ?? 0) + 1
			return groups
		}, {})).map(([city, value]) => ({ city, value })).sort((a, b) => b.value - a.value).slice(0, 5)

		setStats({
			rescues: rescuedDonations.length,
			activeRescues: activeDonations.length,
			delivered: deliveredDonations.length,
			deliveredKg,
			claimed: donations.filter((donation) => donation.status === 'claimed').length,
			pickedUp: donations.filter((donation) => donation.status === 'picked_up').length,
			byCity,
		})
		setError('')
		setLoading(false)
	}, [])

	useEffect(() => {
		loadImpact()
		if (!supabase) return undefined

		const channel = supabase
			.channel('impact-dashboard')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, loadImpact)
			.subscribe()

		return () => supabase.removeChannel(channel)
	}, [loadImpact])

	return { stats, loading, error }
}
