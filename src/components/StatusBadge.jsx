import { STATUS_META } from '../utils/listingStatus'

export default function StatusBadge({ status, className = '' }) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'bg-slate-500/10 text-slate-600 border-slate-500/20' }

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${meta.tone} ${className}`}
    >
      {meta.label}
    </span>
  )
}
