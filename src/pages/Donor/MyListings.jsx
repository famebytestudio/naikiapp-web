import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import AnonymityToggle from '../../components/AnonymityToggle'
import DonationCard from '../../components/DonationCard'
import Navbar from '../../components/Navbar'
import { EmptyState, ErrorState, LoadingState } from '../../components/PageState'
import WorkspaceMetric from '../../components/WorkspaceMetric'
import { useAuth } from '../../context/useAuth'
import { useCancelListing, useMyListings } from '../../hooks/useListings'
import { formatKg } from '../../utils/formatKg'
import { STATUS_META, STATUSES } from '../../utils/listingStatus'

const TABS = [{ value: 'all', label: 'All' }, ...STATUSES.map((status) => ({ value: status, label: STATUS_META[status].label }))]

export default function MyListings() {
  const { profile } = useAuth()
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

  const rescuedKg = items
    .filter((listing) => listing.status === 'delivered')
    .reduce((total, listing) => total + Number(listing.delivered_kg ?? listing.estimated_kg), 0)
  const activeCount = items.filter((listing) => ['available', 'claimed', 'picked_up'].includes(listing.status)).length
  const deliveredCount = counts.delivered
  const donorName = profile?.full_name?.trim().split(/\s+/)[0]

  return (
    <div className="min-h-screen bg-slate-50 workspace-page workspace-page--donor">
      <Navbar />

      <main className="workspace-main">
        <section className="workspace-hero workspace-hero--donor">
          <div className="workspace-hero-copy">
            <p className="workspace-eyebrow"><span aria-hidden="true" /> DONOR WORKSPACE</p>
            <h1>{donorName ? `Welcome back, ${donorName}.` : 'Your food, making a difference.'}</h1>
            <p>Manage your food listings, follow each rescue, and see the impact you’ve made.</p>
          </div>
          <Link to="/donor/listings/new" className="workspace-primary-action">
            <span aria-hidden="true">+</span> Post food
          </Link>
        </section>

        <section className="workspace-metrics" aria-label="Donation summary">
          <WorkspaceMetric label="Total listings" value={isLoading ? '—' : counts.all} detail="Food you have shared" />
          <WorkspaceMetric label="In progress" value={isLoading ? '—' : activeCount} detail="Available, claimed or picked up" tone="orange" />
          <WorkspaceMetric label="Delivered" value={isLoading ? '—' : deliveredCount} detail={`${formatKg(rescuedKg)} recorded`} tone="blue" />
        </section>

        <section className="workspace-preferences" aria-label="Donor preferences">
          <div className="workspace-section-intro">
            <div>
              <p className="workspace-eyebrow">YOUR PREFERENCES</p>
              <h2>Choose how you appear</h2>
            </div>
            <span>Only applies to your donor identity</span>
          </div>
          <AnonymityToggle />
        </section>

        <section className="workspace-listings" aria-labelledby="donor-listings-title">
          <div className="workspace-section-intro workspace-listings-heading">
            <div>
              <p className="workspace-eyebrow">DONATION ACTIVITY</p>
              <h2 id="donor-listings-title">Your listings</h2>
            </div>
            <span>{isLoading ? 'Loading listings…' : `${counts.all} total`}</span>
          </div>

          {tabs.length > 1 && (
            <div className="workspace-filter-tabs" role="group" aria-label="Filter listings by status">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                aria-pressed={filter === tab.value}
                className={`workspace-filter-tab ${
                  filter === tab.value
                    ? 'is-active'
                    : ''
                }`}
              >
                {tab.label}
                <span className="ml-1.5 opacity-60">{counts[tab.value]}</span>
              </button>
            ))}
            </div>
          )}

          {isLoading ? (
            <LoadingState label="Loading your listings" />
          ) : isError ? (
            <ErrorState error={error} onRetry={refetch} title="Could not load your listings" />
          ) : visible.length === 0 ? (
            <EmptyState
              title={items.length === 0 ? 'No food posted yet' : `Nothing ${STATUS_META[filter]?.label.toLowerCase() ?? ''}`}
              description={
                items.length === 0
                  ? 'Post your surplus food and a local charity can claim it within minutes.'
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
            <div className="workspace-donor-list">
              {visible.map((listing) => (
                <DonationCard
                  key={listing.id}
                  listing={listing}
                  onCancel={cancelListing.mutateAsync}
                  isCancelling={cancelListing.isPending && cancelListing.variables === listing.id}
                />
              ))}
            </div>
          )}
        </section>

        {cancelListing.isError && (
          <p className="workspace-action-error" role="alert">
            {cancelListing.error.message}
          </p>
        )}
      </main>
    </div>
  )
}
