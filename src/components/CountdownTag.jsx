<<<<<<< HEAD
import { useNow } from '../hooks/useNow'
import { COUNTDOWN_TONES, timeLeft } from '../utils/timeLeft'

/*
  Time until the food expires. Renders nothing once it has expired, because a
  "0m left" tag on a dead listing is noise - the card shows the status instead.
*/
export default function CountdownTag({ expiresAt, now: providedNow, className = '' }) {
  // Accept an injected clock so the landing page's single tick can drive
  // several tags; otherwise each tag runs its own.
  const ownNow = useNow()
  const now = providedNow ?? ownNow

  const left = timeLeft(new Date(expiresAt).getTime(), now)
  if (left.expired) return null

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider tabular-nums ${COUNTDOWN_TONES[left.tone]} ${className}`}
    >
      {left.label}
    </span>
  )
=======
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

	if (remaining <= 0) return null

	const totalMinutes = Math.floor(remaining / 60000)
	const hours = Math.floor(totalMinutes / 60)
	const minutes = totalMinutes % 60
	const seconds = Math.floor((remaining % 60000) / 1000)
	const label = hours > 0 ? `${hours}h ${minutes}m left` : minutes > 0 ? `${minutes}m ${seconds}s left` : `${seconds}s left`
	const urgency = remaining <= 30 * 60000 ? 'countdown-urgent' : remaining <= 60 * 60000 ? 'countdown-warning' : ''

	return <span className={`countdown-tag ${urgency}`.trim()}>{label}</span>
>>>>>>> b1e189bb00756791550fc48f767911a07d2198c0
}
