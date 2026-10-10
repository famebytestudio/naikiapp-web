import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import Navbar from '../../components/Navbar'
import { listDonorsForAdmin } from '../../lib/authApi'
import { supabase } from '../../lib/supabaseClient'

function formatDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
}

function normalizeDonor(donor) {
  return {
    ...donor,
    full_name: donor.full_name ?? '',
    organisation: donor.organisation ?? '',
    phone: donor.phone ?? '',
    donation_count: Number(donor.donation_count ?? 0),
  }
}

export default function RegisteredDonors() {
  const [search, setSearch] = useState('')
  const { data: donors = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'registered-donors'],
    queryFn: async () => {
      if (!supabase) return listDonorsForAdmin()
      const { data, error: queryError } = await supabase.rpc('list_donors_for_admin')
      if (queryError) throw queryError
      return (data ?? []).map(normalizeDonor)
    },
  })

  const visibleDonors = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return donors
    return donors.filter((donor) => (
      `${donor.full_name} ${donor.organisation} ${donor.email} ${donor.phone}`
        .toLowerCase()
        .includes(query)
    ))
  }, [donors, search])

  const activeCount = donors.filter((donor) => !donor.disabled_at).length
  const totalDonations = donors.reduce((sum, donor) => sum + donor.donation_count, 0)

  return (
    <>
      <Navbar />
      <main className="admin-page">
        <section className="admin-heading">
          <div>
            <p className="admin-eyebrow">DastarKhan / donor community</p>
            <h1>Registered Donors</h1>
            <p className="admin-heading-copy">Find donor accounts, contact details, and their listing activity.</p>
          </div>
          <div className="admin-total"><strong>{donors.length}</strong><span>registered donors</span></div>
        </section>

        <section className="admin-overview" aria-label="Donor directory overview">
          <article className="admin-metric">
            <span>Registered donors</span>
            <strong>{donors.length}</strong>
            <small>Donor accounts on the platform</small>
          </article>
          <article className="admin-metric">
            <span>Active accounts</span>
            <strong>{activeCount}</strong>
            <small>{donors.length - activeCount} disabled accounts</small>
          </article>
          <article className="admin-metric">
            <span>Food listings</span>
            <strong>{totalDonations}</strong>
            <small>Across all donor accounts</small>
          </article>
        </section>

        <section className="admin-listings-panel">
          <div className="admin-listings-toolbar">
            <div>
              <h2>Donor directory</h2>
              <p>{visibleDonors.length} of {donors.length} donor{donors.length === 1 ? '' : 's'}</p>
            </div>
            <label className="admin-search">
              <span className="sr-only">Search donors</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, organisation, or phone"
              />
            </label>
          </div>

          {error && <p className="notice error" role="alert">Could not load registered donors: {error.message}</p>}
          {isLoading ? (
            <div className="empty-state"><div className="spinner" />Loading registered donors…</div>
          ) : visibleDonors.length === 0 ? (
            <div className="empty-state">
              <strong>{donors.length ? 'No matching donors' : 'No donors registered yet'}</strong>
              <span>{donors.length ? 'Try a different name, email, organisation, or phone.' : 'Registered donors will appear here.'}</span>
            </div>
          ) : (
            <div className="admin-table-scroll" role="region" aria-label="Registered donors, scroll horizontally to view all columns" tabIndex={0}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Donor</th>
                    <th>Organisation</th>
                    <th>Contact</th>
                    <th>Listings</th>
                    <th>Profile visibility</th>
                    <th>Registered</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDonors.map((donor) => (
                    <tr key={donor.id}>
                      <td><strong>{donor.full_name || 'Name not provided'}</strong><span>Donor account</span></td>
                      <td>{donor.organisation || 'Not provided'}</td>
                      <td>
                        {donor.email ? <a className="ngo-contact-link" href={`mailto:${donor.email}`}>{donor.email}</a> : <span>Email unavailable</span>}
                        {donor.phone ? <a className="ngo-contact-link" href={`tel:${donor.phone}`}>{donor.phone}</a> : <small className="admin-city">Phone not provided</small>}
                      </td>
                      <td>{donor.donation_count}</td>
                      <td>{donor.is_anonymous ? 'Anonymous to community' : 'Public profile'}</td>
                      <td>{formatDate(donor.created_at)}</td>
                      <td>
                        <span className={`ngo-access-badge ${donor.disabled_at ? 'disabled' : 'active'}`}>
                          {donor.disabled_at ? 'Disabled' : 'Active'}
                        </span>
                        {donor.disabled_reason && <small className="admin-city">{donor.disabled_reason}</small>}
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
