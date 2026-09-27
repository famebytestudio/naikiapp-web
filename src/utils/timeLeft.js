export const MINUTE = 60_000
export const HOUR = 60 * MINUTE

/*
  Everything a countdown needs, derived once so the tag, the card and the
  "you can still edit this" hint all agree on the same thresholds.
*/
const URGENT = 30 * MINUTE
const SOON = 60 * MINUTE

export function timeLeft(untilMs, nowMs = Date.now()) {
  const totalMs = untilMs - nowMs

  if (!(totalMs > 0)) {
    return { expired: true, totalMs: 0, hours: 0, minutes: 0, label: 'Expired', tone: 'expired' }
  }

  const hours = Math.floor(totalMs / HOUR)
  const minutes = Math.floor((totalMs % HOUR) / MINUTE)
  const label = hours > 0 ? `${hours}h ${minutes}m left` : minutes > 0 ? `${minutes}m left` : 'Under 1m left'

  return {
    expired: false,
    totalMs,
    hours,
    minutes,
    label,
    tone: totalMs < URGENT ? 'urgent' : totalMs < SOON ? 'soon' : 'calm',
  }
}

export const COUNTDOWN_TONES = {
  urgent: 'bg-red-500/10 text-red-600 border-red-500/20',
  soon: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  calm: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  expired: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}
