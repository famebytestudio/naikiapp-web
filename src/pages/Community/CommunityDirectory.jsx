import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import PublicHeader from '../../components/PublicHeader'
import { getPublicCommunity } from '../../lib/communityApi'
import { supabase } from '../../lib/supabaseClient'
import './community.css'

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
const number = (value) => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)

export default function CommunityDirectory({ kind }) {
  const isNgo = kind === 'ngos'
  const [searches, setSearches] = useState({ ngos: '', donors: '' })
  const search = searches[kind]
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['public-community'],
    queryFn: getPublicCommunity,
    refetchInterval: 30_000,
  })
  const all = data?.[kind] ?? []
  const countLabel = isNgo
    ? all.length + ' registered organisation' + (all.length === 1 ? '' : 's')
    : all.length + ' donor' + (all.length === 1 ? '' : 's') + ' with completed deliveries'
  // Keep the full leaderboard rank when filtering.
  const rows = all.map((row, i) => ({ ...row, rank: i + 1 })).filter(row => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  return (
    <div className="community-page">
      <PublicHeader />
      <main>
        <section className="community-intro">
          <div className="community-intro-inner">
            <Link to="/" className="community-back">← Back to home</Link>
            <p className="community-eyebrow">{isNgo ? 'LOCAL ORGANISATIONS. SHARED PURPOSE.' : 'A LITTLE GENEROSITY GOES A LONG WAY.'}</p>
            <h1>{isNgo ? 'Registered NGOs' : 'Top Donors'}<span>{isNgo ? 'A community that cares.' : 'Good worth celebrating.'}</span></h1>
            <p>{isNgo ? 'Meet the charity organisations registered on DastarKhan and helping give surplus food a new purpose.' : 'Celebrating the people and kitchens turning extra food into recorded deliveries. Ranked by actual kilograms delivered, across all time.'}</p>
            <div className="community-intro-links"><Link to={isNgo ? '/auth/signup?role=ngo' : '/auth/signup'} className="community-primary">{isNgo ? 'Join the charity network' : 'Start your giving journey'} <span aria-hidden="true">↗</span></Link><Link to={isNgo ? '/top-donors' : '/registered-ngos'}>{isNgo ? 'Meet our donors' : 'Explore our NGO network'} →</Link></div>
            <div className="community-intro-mark" aria-hidden="true">{isNgo ? '◎' : '♡'}</div>
          </div>
        </section>
        <section className="community-content" aria-label={isNgo ? 'Charity directory' : 'Donor leaderboard'}>
          <div className="community-toolbar">
            <div><h2>{isNgo ? 'Our charity network' : 'Every delivery makes a difference'}</h2><p>{isPending ? 'Loading the community…' : error ? 'Directory unavailable' : countLabel}</p></div>
            <label className="community-search"><span className="sr-only">{isNgo ? 'Search NGOs' : 'Search donors'}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input type="search" placeholder={isNgo ? 'Search organisations' : 'Search donors'} value={search} onChange={event => setSearches({ ...searches, [kind]: event.target.value })} /></label>
          </div>
          {!supabase && <p className="community-demo">Demo directory · These records belong to this browser's demo workspace.</p>}
          {isPending ? <div className="community-state" role="status">Gathering our community…</div> : error ? <div className="community-state" role="alert"><h3>We couldn't load the directory.</h3><p>Please try again in a moment.</p><button type="button" onClick={() => refetch()}>Try again</button></div> : rows.length === 0 ? <div className="community-state"><span aria-hidden="true">♡</span><h3>{search ? 'No matches just yet.' : isNgo ? 'The next chapter starts with you.' : 'The first delivery is just the beginning.'}</h3><p>{search ? 'Try another name or clear your search.' : isNgo ? 'Registered organisations will appear here as they join.' : 'Donors will appear here once their first delivery is recorded.'}</p>{search && <button type="button" onClick={() => setSearches({ ...searches, [kind]: '' })}>Clear search</button>}</div> : isNgo ? <div className="community-ngo-grid">{rows.map(row => <article className="community-ngo-card" key={row.rank}><div className="community-card-top"><span className="community-avatar">{initials(row.name)}</span><span className="community-tag">NGO account</span></div><h3>{row.name}</h3><p>Part of the DastarKhan food rescue community.</p><div className="community-card-bottom"><span aria-hidden="true">◎</span> Registered on DastarKhan</div></article>)}</div> : <ol className="community-donors">{rows.map(row => <li key={row.rank} className={row.rank === 1 ? 'community-first' : ''}><span className="community-rank">{String(row.rank).padStart(2, '0')}</span><span className="community-avatar">{initials(row.name)}</span><div className="community-donor-name"><h3>{row.name}</h3><p>{row.rank === 1 ? 'Leading with kindness' : 'Making good food count'}</p></div><div className="community-donor-stat"><strong>{number(row.deliveredKg)} <small>kg</small></strong><span>food delivered</span></div><div className="community-donor-stat"><strong>{number(row.deliveries)}</strong><span>{row.deliveries === 1 ? 'delivery' : 'deliveries'}</span></div></li>)}</ol>}
          <p className="community-note">{isNgo ? 'This directory lists registered accounts; registration is not an endorsement or an independent verification.' : 'Only completed deliveries count. Anonymous donors are not shown. Ties are ordered by delivery count, then name. Showing up to 50 donors.'}</p>
        </section>
        <section className="community-invitation"><span aria-hidden="true">✳</span><div><h2>There is always room for more good.</h2><p>Bring your kitchen or your charity into the circle.</p></div><Link to="/auth/signup">Join DastarKhan ↗</Link></section>
      </main>
    </div>
  )
}
