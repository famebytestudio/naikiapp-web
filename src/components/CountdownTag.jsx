import { useNow } from '../hooks/useNow'
import { COUNTDOWN_TONES, timeLeft } from '../utils/timeLeft'

/*
  Time until the food expires. Renders nothing once it has expired, because a
  "0m left" tag on a dead listing is noise - the card shows the status instead.
*/
export default function CountdownTag({ expiresAt, now: providedNow, className = '' }) {
  const ownNow = useNow()
  const now = providedNow ?? ownNow

  const left = timeLeft(new Date(expiresAt).getTime(), now)
  if (left.expired) return null

  return (
    <span
	className={`countdown-tag inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider tabular-nums ${COUNTDOWN_TONES[left.tone]} ${left.tone === 'urgent' ? 'countdown-urgent' : left.tone === 'soon' ? 'countdown-warning' : ''} ${className}`}
    >
      {left.label}
    </span>
  )
}

