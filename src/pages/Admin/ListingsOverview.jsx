import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import StatusBadge from '../../components/StatusBadge'
import { cancelByAdmin, listAllForAdmin } from '../../lib/listingsApi'
import { supabase } from '../../lib/supabaseClient'
import { normalizeListing } from '../../hooks/useListings'

const STATUS_FILTERS = ['all', 'available', 'claimed', 'picked_up', 'delivered', 'expired', 'cancelled']

export default function ListingsOverview() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [pendingId, setPendingId] = useState('')
  const [notice, setNotice] = useState('')

  const loadListings = useCallback(async () => {
    setLoading(true)
    try {
      if (supabase) {
        const { data, error: queryError } = await supabase
          .from('donations')
          .select('*')
          .order('created_at', { ascending: false })
        if (queryError) throw queryError
        setListings((data ?? []).map(normalizeListing))
      } else {
        setListings((await listAllForAdmin()).map(normalizeListing))
      }
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadListings()
    if (!supabase) {
      window.addEventListener('naikiapp:listings-changed', loadListings)
      return () => window.removeEventListener('naikiapp:listings-changed', loadListings)
    }

    const channel = supabase
      .channel('admin-donations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, loadListings)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadListings])

  const counts = useMemo(() => listings.reduce((result, listing) => {
    result.all += 1
    result[listing.status] = (result[listing.status] ?? 0) + 1
    return result
  }, { all: 0 }), [listings])
  const metrics = [
    { label: 'Available now', value: counts.available ?? 0, detail: 'Open for charity claims' },
    { label: 'In progress', value: (counts.claimed ?? 0) + (counts.picked_up ?? 0), detail: 'Claimed or picked up' },
    { label: 'Delivered', value: counts.delivered ?? 0, detail: 'Completed donations' },
    { label: 'Closed records', value: (counts.expired ?? 0) + (counts.cancelled ?? 0), detail: 'Expired or cancelled' },
  ]

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return listings.filter((listing) => (
      (filter === 'all' || listing.status === filter)
      && (!query || `${listing.food} ${listing.city} ${listing.area} ${listing.donor}`.toLowerCase().includes(query))
    ))
  }, [listings, search, filter])

  async function moderate(id) {
    if (!window.confirm('Remove this active donation from the feed? Its history will be retained as cancelled.')) return
    setPendingId(id)
    setNotice('')
    setError('')
    try {
      if (supabase) {
        const { error: rpcError } = await supabase.rpc('cancel_donation_as_admin', { p_donation_id: id })
        if (rpcError) throw rpcError
      } else {
        await cancelByAdmin(id)
      }
      setNotice('Donation removed from the active feed. Its history is retained.')
      await loadListings()
    } catch (moderationError) {
      setError(moderationError.message)
    } finally {
      setPendingId('')
    }
  }

  return (
    <>
      <Navbar />
      <main className="admin-page">
        <section className="admin-heading">
          <div>
            <p className="admin-eyebrow">DastarKhan / platform operations</p>
            <h1>Donation oversight</h1>
            <p className="admin-heading-copy">A clear view of food moving through the rescue network.</p>
          </div>
          <div className="admin-total"><strong>{counts.all}</strong><span>total donations</span></div>
        </section>

        <section className="admin-overview" aria-label="Donation overview">
          {metrics.map((metric) => (
            <article className="admin-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </section>

        <section className="admin-filter-panel" aria-label="Filter donations by status">
          <div className="admin-filter-heading">
            <div><h2>Donation records</h2><p>Choose a status to narrow the list.</p></div>
            <span>{visible.length} result{visible.length === 1 ? '' : 's'}</span>
          </div>
          <div className="admin-stats">
          {STATUS_FILTERS.map((status) => (
            <button
              className={`admin-stat ${filter === status ? 'selected' : ''}`}
              type="button"
              key={status}
              aria-pressed={filter === status}
              onClick={() => setFilter(filter === status ? 'all' : status)}
            >
              <span>{status === 'all' ? 'All records' : status.replace('_', ' ')}</span>
              <strong>{counts[status] ?? 0}</strong>
            </button>
          ))}
          </div>
        </section>

        <section className="admin-listings-panel">
          <div className="admin-listings-toolbar">
            <div>
              <h2>All donations</h2>
              <p>Create, update, and safely remove active donation records.</p>
            </div>
            <div className="admin-listing-actions">
              <label className="admin-search">
                <span className="sr-only">Search donations</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search food or location" />
              </label>
              <Link to="/admin/listings/new" className="admin-create-button">Create listing</Link>
            </div>
          </div>

          {error && <p className="notice error" role="alert">Could not complete request: {error}</p>}
          {notice && <p className="admin-success" role="status">{notice}</p>}
          {loading ? (
            <div className="empty-state"><div className="spinner" />Loading donation records…</div>
          ) : visible.length === 0 ? (
            <div className="empty-state"><strong>No matching donations</strong><span>Try another status or search term.</span></div>
          ) : (
            <div className="admin-table-scroll" role="region" aria-label="Donation records, scroll horizontally to view all columns" tabIndex={0}>
              <table className="admin-table">
                <thead>
                  <tr><th>Donation</th><th>Donor</th><th>Pickup location</th><th>Created</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {visible.map((listing) => (
                    <tr key={listing.id}>
                      <td><strong>{listing.food}</strong><span>{listing.quantity} {listing.unit} <i aria-hidden="true">·</i> {listing.kg} kg</span></td>
                      <td><span className="admin-donor-name">{listing.donor}</span></td>
                      <td><span>{listing.area}</span><small className="admin-city">{listing.city}</small></td>
                      <td>{listing.createdAt ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(listing.createdAt)) : '—'}</td>
                      <td><StatusBadge status={listing.status} className="admin-status-badge" /></td>
                      <td>
                        <div className="admin-row-actions">
                          <Link className="admin-edit-button" to={`/admin/listings/${listing.id}/edit`}>Edit</Link>
                          {['available', 'claimed'].includes(listing.status) && (
                            <button type="button" className="admin-remove-button" onClick={() => moderate(listing.id)} disabled={pendingId === listing.id}>
                              {pendingId === listing.id ? 'Removing…' : 'Remove'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
