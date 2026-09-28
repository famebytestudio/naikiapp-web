import { useState } from 'react'
import { Link } from 'react-router-dom'

import CountdownTag from './CountdownTag'
import ListingFacts from './ListingFacts'
import RemovedNotice from './RemovedNotice'
import StatusBadge from './StatusBadge'
import { formatKg } from '../utils/formatKg'
import { canCancel, canEdit } from '../utils/listingStatus'
import { isRemoved } from '../utils/moderation'

/*
  One row in the donor's list. It knows which actions the current status allows
  (canEdit / canCancel) and why the others are missing, so a donor is never left
  wondering whether a button is broken or simply not allowed yet.
*/
/*
  `to` is an optional destination for a "View details" link, and is why the
  detail link is opt-in rather than always rendered. This card is shared with the
  NGO feed on the partner branch, and /donor/listings/:id is a donor route - a
  hard-coded link here would hand a charity a link to a page its role guard
  bounces. The donor list passes it; the feed can leave it off.
*/
export default function DonationCard({ listing, now, onCancel, isCancelling, to }) {
  const [confirming, setConfirming] = useState(false)

  // A removed listing keeps its status, so canEdit/canCancel would still say yes.
  // Removal is a separate fact about the row and it wins.
  const removed = isRemoved(listing)
  const editable = !removed && canEdit(listing.status)
  const cancellable = !removed && canCancel(listing.status)
  const open = listing.status === 'available' || listing.status === 'claimed'

  async function handleCancel() {
    setConfirming(false)
    try {
      await onCancel(listing.id)
    } catch {
      // The page owns the error surface, so the rejection is absorbed here
      // rather than becoming an unhandled promise rejection.
    }
  }

  return (
    <article
      className={`flex flex-col rounded-3xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-lg ${
        removed ? 'border-rose-200 opacity-90' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-slate-900">{listing.title}</h3>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={listing.status} />
          {open && !removed && <CountdownTag expiresAt={listing.expiry_at} now={now} />}
        </div>
      </div>

      <ListingFacts listing={listing} />

      {listing.status === 'delivered' && listing.delivered_kg != null && (
        <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">
          Delivered {formatKg(listing.delivered_kg, { precise: true })} — counted in your impact.
        </p>
      )}

      <RemovedNotice listing={listing} />

      {confirming ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-900">Cancel this listing?</p>
          <p className="mt-1 text-sm text-rose-700">
            {listing.status === 'claimed'
              ? 'A charity has already claimed it, so let them know the food is not coming.'
              : 'It will stop showing in the NGO feed. The listing stays in your history as cancelled.'}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
            >
              {isCancelling ? 'Cancelling…' : 'Yes, cancel it'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-bold text-slate-600 transition hover:bg-white"
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {to && (
            <Link
              to={to}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 active:scale-95"
            >
              View details
            </Link>
          )}

          {editable ? (
            <Link
              to={`/donor/listings/${listing.id}/edit`}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white active:scale-95"
            >
              Edit
            </Link>
          ) : (
            <span className="text-xs font-semibold text-slate-400">
              {listing.status === 'claimed' ? 'Locked — a charity has claimed this' : `Editing closed (${listing.status})`}
            </span>
          )}

          {cancellable && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={isCancelling}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:border-rose-300 hover:text-rose-600 active:scale-95 disabled:opacity-50"
            >
              Cancel listing
            </button>
          )}

          {!editable && !cancellable && (
            <span className="text-xs font-semibold text-slate-400">
              {listing.status === 'picked_up' || listing.status === 'delivered'
                ? 'Collected — no longer editable'
                : 'Closed'}
            </span>
          )}
        </div>
      )}
    </article>
  )
}
