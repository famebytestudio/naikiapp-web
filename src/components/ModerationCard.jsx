import { useState } from 'react'

import CountdownTag from './CountdownTag'
import ListingFacts from './ListingFacts'
import StatusBadge from './StatusBadge'
import { formatDateTime } from '../utils/formatDate'
import { isRemoved, removalBlockReason, REMOVAL_PRESETS, REMOVAL_REASON_MAX } from '../utils/moderation'

/*
  One listing in the admin's moderation queue.

  The two things a moderator cannot do without are here by design:

  - The donor is identified. The anonymity toggle is the project's headline
    feature and it is respected in NGO views and in impact aggregates, but a
    queue that shows "Anonymous Donor" cannot act on a repeat offender, cannot
    call anybody about a disputed address, and cannot warn a donor that their
    third listing this week is a pattern. So the real name and organisation are
    shown here, and the anonymity preference is shown next to them rather than
    quietly overridden - the exception is visible, which is the difference
    between a decision and a leak. This is an admin surface; nothing on it is
    reachable by a donor or a charity.

  - Removal is reversible. A moderator acting on a hunch at 11pm needs an undo,
    and so does anyone who was wrong. The status is never touched, so a
    restored listing comes back exactly as it was.

  Removal is refused from picked_up onward (removalBlockReason explains why on
  screen rather than leaving a dead button), because a delivered row holds the
  only record of the weight that produced the impact totals.
*/
export default function ModerationCard({ listing, donor, removedByName, now, onRemove, onRestore, isBusy }) {
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [restoring, setRestoring] = useState(false)

  const removed = isRemoved(listing)
  const blocked = removalBlockReason(listing)
  const reasonMissing = confirming && reason.trim().length === 0
  const open = (listing.status === 'available' || listing.status === 'claimed') && !removed

  async function handleRemove() {
    try {
      await onRemove({ id: listing.id, reason: reason.trim() })
      setConfirming(false)
      setReason('')
    } catch {
      // The page owns the error surface; keep the reason in the field so a
      // refused removal does not cost the moderator what they typed.
    }
  }

  async function handleRestore() {
    setRestoring(true)
    try {
      await onRestore(listing.id)
    } catch {
      // Same as above - the page renders the failure.
    } finally {
      setRestoring(false)
    }
  }

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-slate-900">{listing.title}</h3>
          <p className="mt-1 text-xs text-slate-400">Posted {formatDateTime(listing.created_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={listing.status} />
          {open && <CountdownTag expiresAt={listing.expiry_at} now={now} />}
        </div>
      </div>

      {/*
        Who posted it. The phone number is the field a moderator checks first:
        a scam listing is usually recognisable from a contact number that has
        nothing to do with the address.
      */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-slate-50 px-4 py-3">
        <span className="text-sm font-bold text-slate-900">
          {donor?.full_name ?? 'Unknown donor'}
          {donor?.organisation ? <span className="font-medium text-slate-500"> · {donor.organisation}</span> : null}
        </span>
        {donor?.phone && <span className="text-sm text-slate-600">{donor.phone}</span>}
        {donor?.is_anonymous && (
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Posts anonymously · identity shown to admins only
          </span>
        )}
      </div>

      <ListingFacts listing={listing} />

      {removed ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-bold text-rose-900">
            Removed {formatDateTime(listing.removed_at)}
            {removedByName ? ` by ${removedByName}` : ''}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-rose-700">{listing.removal_reason}</p>
          <p className="mt-2 text-xs leading-relaxed text-rose-600">
            The donor can see this reason on their own listing, and the row is frozen for them until it
            is restored.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {restoring ? (
              <button
                type="button"
                onClick={handleRestore}
                disabled={isBusy}
                className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
              >
                {isBusy ? 'Restoring…' : 'Confirm restore'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRestoring(true)}
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 active:scale-95"
              >
                Restore
              </button>
            )}
            {restoring && (
              <>
                <p className="text-xs leading-relaxed text-slate-500">
                  This puts the listing back on the NGO feed with the status it had. Check the pickup
                  window first - a long time on the queue can mean the food is no longer safe to collect,
                  and expiry is the sweep&apos;s call, not this button&apos;s.
                </p>
                <button
                  type="button"
                  onClick={() => setRestoring(false)}
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          {confirming ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-bold text-rose-900">Take this listing down?</p>
              <p className="mt-1 text-sm leading-relaxed text-rose-700">
                It disappears from the NGO feed straight away. The donor still sees it, with this reason
                attached, and the listing keeps its status history.
              </p>

              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {REMOVAL_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setReason(preset.value)}
                      title={preset.hint}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        reason === preset.value
                          ? 'border-rose-400 bg-rose-100 text-rose-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-rose-300'
                      }`}
                    >
                      {preset.value}
                    </button>
                  ))}
                </div>

                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={REMOVAL_REASON_MAX}
                  rows={2}
                  placeholder="The donor reads this. Say what is wrong with the listing."
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-rose-400"
                />

                <p className="mt-1 text-xs text-slate-500">
                  {reason.trim().length} / {REMOVAL_REASON_MAX}
                </p>
                {reasonMissing && (
                  <p className="mt-2 text-xs font-semibold text-rose-600" role="alert">
                    A reason is required - it is what the donor is shown.
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isBusy || reasonMissing}
                  className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                >
                  {isBusy ? 'Removing…' : 'Yes, remove it'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false)
                    setReason('')
                  }}
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white"
                >
                  Leave it up
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={Boolean(blocked) || isBusy}
                className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                Remove listing
              </button>
              {blocked && <span className="text-xs font-semibold text-slate-500">{blocked}</span>}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
