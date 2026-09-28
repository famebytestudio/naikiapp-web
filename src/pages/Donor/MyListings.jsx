import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import AnonymityToggle from '../../components/AnonymityToggle'
import DonationCard from '../../components/DonationCard'
import Navbar from '../../components/Navbar'
import { EmptyState, ErrorState, LoadingState } from '../../components/PageState'
import { useCancelListing, useMyListings } from '../../hooks/useListings'
import { formatKg } from '../../utils/formatKg'
import { summariseImpact } from '../../utils/impact'
import { STATUS_META, STATUSES } from '../../utils/listingStatus'

const TABS = [{ value: 'all', label: 'All' }, ...STATUSES.map((status) => ({ value: status, label: STATUS_META[status].label }))]

export default function MyListings() {
  const { data: listings, isLoading, isError, error, refetch } = useMyListings()
  const [filter, setFilter] = useState('all')
  const cancelListing = useCancelListing()

  const items = useMemo(() => listings ?? [], [listings])

  const counts = useMemo(() => {
    const tally = { all: items.length }
    for (const status of STATUSES) tally[status] = 0
    for (const listing of items) tally[listing.status] += 1
    return tally
  }, [items])

  // Only offer tabs that lead somewhere, so a donor with no deliveries yet does
  // not get an empty "Delivered" view.
  const tabs = TABS.filter((tab) => tab.value === 'all' || counts[tab.value] > 0)

  const visible = filter === 'all' ? items : items.filter((listing) => listing.status === filter)

  // The header total and /donor/impact must agree, so both read the same rule
  // rather than each summing delivered_kg themselves.
  const rescuedKg = summariseImpact(items).rescuedKg

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight text-slate-900">My listings</h1>
            <p className="mt-1 text-sm text-slate-600">
              {isLoading ? 'Loading your food…' : `${counts.all} listing${counts.all === 1 ? '' : 's'} · ${formatKg(rescuedKg)} delivered`}
            </p>
          </div>
          <Link
            to="/donor/listings/new"
            className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 active:scale-95"
          >
            Post food
          </Link>
        </div>

        <div className="mt-6">
          <AnonymityToggle />
        </div>

        {tabs.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                  filter === tab.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 opacity-60">{counts[tab.value]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          {isLoading ? (
            <LoadingState label="Loading your listings" />
          ) : isError ? (
            <ErrorState error={error} onRetry={refetch} title="Could not load your listings" />
          ) : visible.length === 0 ? (
            <EmptyState
              title={items.length === 0 ? 'No food posted yet' : `Nothing ${STATUS_META[filter]?.label.toLowerCase() ?? ''}`}
              description={
                items.length === 0
                  ? 'Post your surplus food and a verified charity near you can claim it within minutes.'
                  : 'Try another filter to see the rest of your listings.'
              }
              action={
                items.length === 0 ? (
                  <Link
                    to="/donor/listings/new"
                    className="inline-block rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 active:scale-95"
                  >
                    Post your first listing
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className="rounded-full border border-slate-300 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-white"
                  >
                    Show all
                  </button>
                )
              }
            />
          ) : (
            <div className="grid gap-5">
              {visible.map((listing) => (
                <DonationCard
                  key={listing.id}
                  listing={listing}
                  to={`/donor/listings/${listing.id}`}
                  onCancel={cancelListing.mutateAsync}
                  isCancelling={cancelListing.isPending && cancelListing.variables === listing.id}
                />
              ))}
            </div>
          )}
        </div>

        {cancelListing.isError && (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700" role="alert">
            {cancelListing.error.message}
          </p>
        )}
      </main>
    </div>
  )
}
