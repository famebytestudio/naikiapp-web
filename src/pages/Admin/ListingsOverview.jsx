import { useMemo, useState } from 'react'

import ModerationCard from '../../components/ModerationCard'
import Navbar from '../../components/Navbar'
import { EmptyState, ErrorState, LoadingState } from '../../components/PageState'
import { useAdminAccounts, useAllListings, useRemoveListing, useRestoreListing } from '../../hooks/useAdmin'
import { useNow } from '../../hooks/useNow'
import { isRemoved } from '../../utils/moderation'
import { STATUS_META, STATUSES } from '../../utils/listingStatus'

const FILTERS = [
  { value: 'all', label: 'All' },
  ...STATUSES.map((status) => ({ value: status, label: STATUS_META[status].label })),
  { value: 'removed', label: 'Removed' },
]

/*
  The moderation queue: every listing on the platform, whoever posted it.

  Three things this screen is for:

    1. Finding the bad ones. A charity turning up to a pickup that does not
       exist is the failure this queue exists to prevent, so a listing that has
       been sitting 'available' past its expiry is worth surfacing rather than
       leaving to the sweep.
    2. Taking them down, reversibly, with a reason the donor is shown.
    3. Answering support questions - hence the donor's real identity on every
       card. See ModerationCard for why anonymity is lifted here and only here.

  The filter defaults to everything rather than to a queue of problems. An admin
  who opens "All listings" expecting to be shown a pre-judged list of what to
  remove is an admin who eventually removes something they did not read.

  Newest first, because a spam listing is worth catching while it is still
  being claimed.
*/
export default function ListingsOverview() {
  const { data: listings, isLoading, isError, error, refetch } = useAllListings()
  const { data: accounts } = useAdminAccounts()
  const remove = useRemoveListing()
  const restore = useRestoreListing()

  const now = useNow()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  // One read serves the name on every card, so the donor's identity is resolved
  // here rather than inside the card.
  const donorsById = useMemo(() => {
    const map = new Map()
    for (const account of accounts ?? []) map.set(account.id, account.profile)
    return map
  }, [accounts])

  const items = useMemo(() => listings ?? [], [listings])

  /*
    The count on a tab has to be the number of rows the tab actually shows, or
    the queue quietly lies. So a status tab counts only live listings: a removed
    listing keeps its status, and counting it under "Available" would promise an
    'available' row that the filter then hides.
  */
  const counts = useMemo(() => {
    const live = items.filter((listing) => !isRemoved(listing))
    const tally = { all: items.length, removed: items.length - live.length }
    for (const status of STATUSES) tally[status] = live.filter((listing) => listing.status === status).length
    return tally
  }, [items])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()

    return items.filter((listing) => {
      const removed = isRemoved(listing)

      if (filter === 'removed' && !removed) return false
      if (filter !== 'all' && filter !== 'removed' && (removed || listing.status !== filter)) return false

      if (!term) return true

      // Matches the address and the contact name too, because a support
      // request usually arrives as "someone called about a listing on
      // Street 8" rather than as a title.
      const donor = donorsById.get(listing.donor_id)
      return [listing.title, listing.area, listing.city, listing.contact_name, listing.contact_phone, donor?.full_name, donor?.organisation]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    })
  }, [items, filter, search, donorsById])

  const tabs = FILTERS.filter((tab) => counts[tab.value] > 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-slate-900">All listings</h1>
          <p className="mt-1 text-sm text-slate-600">
            {isLoading
              ? 'Loading every listing…'
              : `${counts.all} listing${counts.all === 1 ? '' : 's'} · ${counts.removed} removed`}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label htmlFor="listing-search" className="sr-only">
            Search listings
          </label>
          <input
            id="listing-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, area, contact or donor"
            className="w-full max-w-sm rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400"
          />

          <div className="flex flex-wrap gap-2">
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
        </div>

        <div className="mt-6">
          {isLoading ? (
            <LoadingState label="Loading every listing" />
          ) : isError ? (
            <ErrorState error={error} onRetry={refetch} title="Could not load the listings" />
          ) : visible.length === 0 ? (
            <EmptyState
              title={items.length === 0 ? 'No listings yet' : 'Nothing matches'}
              description={
                items.length === 0
                  ? 'Once donors start posting, every listing lands here for moderation.'
                  : 'Try another filter, or clear the search to see the rest of the queue.'
              }
              action={
                items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilter('all')
                      setSearch('')
                    }}
                    className="rounded-full border border-slate-300 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-white"
                  >
                    Show everything
                  </button>
                )
              }
            />
          ) : (
            <div className="grid gap-5">
              {visible.map((listing) => (
                <ModerationCard
                  key={listing.id}
                  listing={listing}
                  donor={donorsById.get(listing.donor_id)}
                  removedByName={listing.removed_by ? (donorsById.get(listing.removed_by)?.full_name ?? null) : null}
                  now={now}
                  onRemove={remove.mutateAsync}
                  onRestore={restore.mutateAsync}
                  isBusy={
                    (remove.isPending && remove.variables?.id === listing.id) ||
                    (restore.isPending && restore.variables === listing.id)
                  }
                />
              ))}
            </div>
          )}
        </div>

        {(remove.isError || restore.isError) && (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700" role="alert">
            {(remove.error ?? restore.error).message}
          </p>
        )}
      </main>
    </div>
  )
}
