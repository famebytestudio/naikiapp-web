import { Link, useNavigate, useParams } from 'react-router-dom'

import ClaimingNgoCard from '../../components/ClaimingNgoCard'
import CountdownTag from '../../components/CountdownTag'
import ListingFacts from '../../components/ListingFacts'
import Navbar from '../../components/Navbar'
import RemovedNotice from '../../components/RemovedNotice'
import StatusBadge from '../../components/StatusBadge'
import StatusTimeline from '../../components/StatusTimeline'
import { ErrorState, LoadingState } from '../../components/PageState'
import { useCancelListing, useClaimingNgo, useListing } from '../../hooks/useListings'
import { useNow } from '../../hooks/useNow'
import { formatDateTime } from '../../utils/formatDate'
import { formatKg } from '../../utils/formatKg'
import { canCancel, canEdit } from '../../utils/listingStatus'
import { isRemoved } from '../../utils/moderation'

/*
  One listing, in full: what it is, which charity claimed it, and where it has
  got to.

  This is the donor's side of the pickup. Before it, a donor whose food had been
  collected and delivered had no way to find out who took it or how to reach them
  - the two policies in migration 0007 exist because of that gap, and the charity
  panel below is what they opened up.

  A sibling of /donor/listings/:id/edit rather than an expansion inside the list,
  so the URL is shareable and the page has room for the timeline.

  `live` is passed to both queries: the row and the charity are polled on the same
  15s cadence, and both stop polling once the status can no longer change. The
  transitions are written by the charity, not by this page, so without polling a
  donor would sit here watching a stale badge until they reloaded.
*/
export default function ListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const now = useNow()

  const { data: listing, isLoading, isError, error, refetch } = useListing(id, { live: true })
  const { data: ngo, isLoading: isLoadingNgo } = useClaimingNgo(id, {
    status: listing?.status,
    live: true,
  })
  const cancelListing = useCancelListing()

  // A removed listing is frozen: the same reason canEdit/canCancel would still say
  // yes, exactly as in DonationCard.
  const removed = isRemoved(listing)
  const editable = Boolean(listing) && !removed && canEdit(listing.status)
  const cancellable = Boolean(listing) && !removed && canCancel(listing.status)

  async function handleCancel() {
    try {
      await cancelListing.mutateAsync(id)
    } catch {
      // Rendered below; the listing behind this page has already refetched.
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/donor/listings" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">
          &larr; Back to my listings
        </Link>

        {isLoading ? (
          <div className="mt-8">
            <LoadingState label="Loading this listing" />
          </div>
        ) : isError || !listing ? (
          <div className="mt-8">
            <ErrorState
              error={error ?? new Error('That listing could not be found.')}
              onRetry={refetch}
              title="Could not load this listing"
            />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-display text-3xl font-black tracking-tight text-slate-900">
                  {listing.title}
                </h1>
                <p className="mt-2 text-sm text-slate-500">Posted {formatDateTime(listing.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={listing.status} />
                {(listing.status === 'available' || listing.status === 'claimed') && (
                  <CountdownTag expiresAt={listing.expiry_at} now={now} />
                )}
              </div>
            </div>

            {/*
              A card, not bare fields. The removal notice is the first thing a
              donor should read if an admin has stepped in, and it is easy to
              bury it under the facts otherwise.
            */}
            <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <ListingFacts listing={listing} />
              <RemovedNotice listing={listing} />
            </article>

            {listing.status === 'delivered' && listing.delivered_kg != null && (
              <p className="mt-5 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">
                Delivered {formatKg(listing.delivered_kg, { precise: true })} — counted in your impact.
              </p>
            )}

            <div className="mt-6 grid gap-5">
              <ClaimingNgoCard
                listing={listing}
                ngo={ngo}
                isLoading={isLoadingNgo && Boolean(listing.claimed_by)}
                now={now}
              />
              <StatusTimeline listing={listing} />
            </div>

            {cancelListing.isError && (
              <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700" role="alert">
                {cancelListing.error.message}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {editable && (
                <Link
                  to={`/donor/listings/${listing.id}/edit`}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 active:scale-95"
                >
                  Edit listing
                </Link>
              )}

              {cancellable && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelListing.isPending}
                  className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:border-rose-300 hover:text-rose-600 active:scale-95 disabled:opacity-50"
                >
                  {cancelListing.isPending ? 'Cancelling…' : 'Cancel listing'}
                </button>
              )}

              {/*
                A missing Edit button with nothing next to it is how a donor
                concludes the page is broken. The listing can still be cancelled
                while it is claimed, so the lock is stated rather than implied by
                the absence.
              */}
              {!editable && cancellable && listing.status === 'claimed' && (
                <span className="text-xs font-semibold text-slate-400">
                  Locked — a charity has claimed this
                </span>
              )}

              {!editable && !cancellable && (
                <span className="text-xs font-semibold text-slate-400">
                  {removed
                    ? 'Taken down by NaikiApp — this listing is closed'
                    : listing.status === 'picked_up' || listing.status === 'delivered'
                      ? 'Collected — no longer editable'
                      : 'Closed'}
                </span>
              )}

              <button
                type="button"
                onClick={() => navigate('/donor/listings')}
                className="ml-auto text-xs font-bold text-slate-500 transition hover:text-slate-800"
              >
                Back to my listings
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
