import { useState } from 'react'
import { Link } from 'react-router-dom'

import CountdownTag from './CountdownTag'
import StatusBadge from './StatusBadge'
import { formatDateTime, formatWindow } from '../utils/formatDate'
import { formatKg, formatQuantity } from '../utils/formatKg'
import { canCancel, canEdit, foodTypeLabel } from '../utils/listingStatus'

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-700">{children}</dd>
    </div>
  )
}

/*
  One row in the donor's list. It knows which actions the current status allows
  (canEdit / canCancel) and why the others are missing, so a donor is never left
  wondering whether a button is broken or simply not allowed yet.
*/
export default function DonationCard({ listing, now, onCancel, isCancelling }) {
  const [confirming, setConfirming] = useState(false)

  const editable = canEdit(listing.status)
  const cancellable = canCancel(listing.status)
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
    <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-slate-900">{listing.title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {foodTypeLabel(listing.food_type)} · {formatQuantity(listing.quantity_value, listing.quantity_unit)} · ~
            {formatKg(listing.estimated_kg)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={listing.status} />
          {open && <CountdownTag expiresAt={listing.expiry_at} now={now} />}
        </div>
      </div>

      {listing.description && <p className="mt-4 text-sm text-slate-600">{listing.description}</p>}

      <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4">
        <Detail label="Pickup">{formatWindow(listing.pickup_start_at, listing.pickup_end_at)}</Detail>
        <Detail label="Expires">{formatDateTime(listing.expiry_at)}</Detail>
        <Detail label="Location">
          {listing.area}, {listing.city}
        </Detail>
        <Detail label="Contact">
          {listing.contact_name}
          <span className="block text-xs font-medium text-slate-500">{listing.contact_phone}</span>
        </Detail>
      </dl>

      {listing.status === 'delivered' && listing.delivered_kg != null && (
        <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">
          Delivered {formatKg(listing.delivered_kg, { precise: true })} — counted in your impact.
        </p>
      )}

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
          {editable ? (
            <Link
              to={`/donor/listings/${listing.id}/edit`}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 active:scale-95"
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
