import { formatDateTime, formatWindow } from '../utils/formatDate'
import { formatKg, formatQuantity } from '../utils/formatKg'
import { foodTypeLabel } from '../utils/listingStatus'

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-700">{children}</dd>
    </div>
  )
}

/*
  The factual half of a listing: what it is, when it can be collected, where,
  and who to call. Extracted because three surfaces now render a listing - the
  donor's list, the NGO feed and the admin's moderation queue - and the pickup
  window and the contact number are exactly the fields that must read
  identically on all three. A moderator checking whether a contact number is
  fake is looking at the same number a charity would have called.
*/
export default function ListingFacts({ listing }) {
  return (
    <>
      <p className="mt-4 text-sm text-slate-500">
        {foodTypeLabel(listing.food_type)} · {formatQuantity(listing.quantity_value, listing.quantity_unit)} · ~
        {formatKg(listing.estimated_kg)}
      </p>

      {listing.description && <p className="mt-3 text-sm text-slate-600">{listing.description}</p>}

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
    </>
  )
}
