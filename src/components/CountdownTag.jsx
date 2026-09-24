import { useEffect, useState } from 'react'

export default function CountdownTag({ expiresAt }) {
	const [remaining, setRemaining] = useState(() => {
		if (!expiresAt) return null
		const difference = new Date(expiresAt).getTime() - Date.now()
		return Math.max(difference, 0)
	})

	useEffect(() => {
		if (!expiresAt) return undefined

		const update = () => {
			const difference = new Date(expiresAt).getTime() - Date.now()
			setRemaining(Math.max(difference, 0))
		}

		update()
		const timer = window.setInterval(update, 1000)
		return () => window.clearInterval(timer)
	}, [expiresAt])

	if (!expiresAt || remaining === null) return null

	if (remaining <= 0) {
		return <span className="countdown-tag countdown-expired">Expired</span>
	}

	const totalMinutes = Math.floor(remaining / 60000)
	const hours = Math.floor(totalMinutes / 60)
	const minutes = totalMinutes % 60
	const seconds = Math.floor((remaining % 60000) / 1000)
	const label = hours > 0 ? `${hours}h ${minutes}m left` : minutes > 0 ? `${minutes}m ${seconds}s left` : `${seconds}s left`

	return <span className="countdown-tag">{label}</span>
}
