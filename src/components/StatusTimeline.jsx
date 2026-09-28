/*
  The pickup status timeline.

  Reads the derived steps from utils/listingTimeline.js, which on a real database
  is a select from status_log (migration 0004) - append-only, trigger-written,
  and not editable by the client. Nothing here needs to change when that swap
  happens; only the function body does.

  The current step is marked and the remaining ones are listed as "not yet", so
  a donor can see both where their food is and what is still to come. A timeline
  that only renders what already happened tells a donor nothing about whether
  they should still be waiting.

  The 'expired' step is the one case with no timestamp, because no column records
  the expiry transition - the Edge Function writes a status_log row and nothing
  on donations. It prints "time not recorded" rather than a blank, so the gap is
  visible instead of looking like a rendering bug.
*/
import { formatDateTime } from '../utils/formatDate'
import { STATUS_META } from '../utils/listingStatus'
import { buildTimeline, isStillMoving } from '../utils/listingTimeline'

function Step({ entry, isCurrent, isPending }) {
  const meta = STATUS_META[entry.status] ?? { label: entry.status, tone: '' }

  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <span
          className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
            isCurrent
              ? 'border-emerald-600 bg-emerald-600'
              : isPending
                ? 'border-slate-200 bg-white'
                : 'border-slate-300 bg-white'
          }`}
        />
        <span className="my-1 w-px flex-1 bg-slate-200" />
      </div>

      <div className="pb-6">
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
          {meta.label}
          {isCurrent && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Now
            </span>
          )}
          {isPending && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Not yet
            </span>
          )}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {isPending ? 'Has not happened yet.' : entry.detail}
        </p>
        {!isPending && (
          <p className="mt-1 text-xs font-semibold text-slate-400">
            {entry.at ? formatDateTime(entry.at) : 'Time not recorded'}
          </p>
        )}
      </div>
    </li>
  )
}

export default function StatusTimeline({ listing }) {
  const entries = buildTimeline(listing)
  if (entries.length === 0) return null

  const currentIndex = entries.length - 1
  // Steps the workflow still has ahead of it, in order, so a donor can see what
  // is outstanding. Nothing is shown past a terminal state: a cancelled or
  // expired listing will never be collected, so promising a pickup would be
  // inventing a future.
  const upcoming = isStillMoving(listing.status)
    ? ['claimed', 'picked_up', 'delivered'].filter((status) => !entries.some((entry) => entry.status === status))
    : []

  const all = [...entries, ...upcoming.map((status) => ({ status, pending: true, detail: '', at: null }))]

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-bold text-slate-900">Pickup status</h2>
      <p className="mt-1 text-sm text-slate-500">
        Updates as the charity moves your food along.
      </p>

      <ol className="mt-5">
        {all.map((entry, index) => (
          <Step
            key={entry.status}
            entry={entry}
            isPending={Boolean(entry.pending)}
            isCurrent={!entry.pending && index === currentIndex}
          />
        ))}
      </ol>
    </section>
  )
}
