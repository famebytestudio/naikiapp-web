import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getDemoImpact } from '../lib/listingsApi'

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
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const loadImpact = useCallback(async () => {
		if (!supabase) {
			try {
				setStats(await getDemoImpact())
				setError('')
			} catch (loadError) {
				setError(loadError.message)
			} finally {
				setLoading(false)
			}
			return
		}

		const { data, error: queryError } = await supabase
			.from('donations')
			.select('id, status, estimated_kg, delivered_kg, city')
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
		const deliveredKg = deliveredDonations.reduce((sum, donation) => sum + toNumber(donation.delivered_kg ?? donation.estimated_kg ?? 0), 0)
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
		if (!supabase) {
			window.addEventListener('naikiapp:listings-changed', loadImpact)
			return () => window.removeEventListener('naikiapp:listings-changed', loadImpact)
		}

		const channel = supabase
			.channel('impact-dashboard')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, loadImpact)
			.subscribe()

		return () => supabase.removeChannel(channel)
	}, [loadImpact])

	return { stats, loading, error }
}
