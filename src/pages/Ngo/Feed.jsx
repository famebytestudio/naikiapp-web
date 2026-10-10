import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import CountdownTag from '../../components/CountdownTag.jsx'
import Navbar from '../../components/Navbar'
import WorkspaceMetric from '../../components/WorkspaceMetric'
import { useAuth } from '../../context/useAuth'
import { useListings } from '../../hooks/useListings'
import { getCurrentLocation } from '../../lib/geoLocation'
import { supabase } from '../../lib/supabaseClient'
import { DELIVERY_RADIUS_KM, distanceKm, isWithinDeliveryRange } from '../../utils/distance'
import { formatKg } from '../../utils/formatKg'

const formatTime = (value) => (value ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'Flexible pickup')
const mapsUrl = (listing) => `https://www.google.com/maps/search/?api=1&query=${listing.pickup_latitude},${listing.pickup_longitude}`

function ListingCard({ listing, ngoLocation }) {
  const distance = distanceKm(
    ngoLocation.latitude,
    ngoLocation.longitude,
    listing.pickup_latitude,
    listing.pickup_longitude,
  )
  return (
    <article className="listing-card">
      <div className="card-topline"><span className="food-type">{listing.type}</span><CountdownTag expiresAt={listing.expiresAt} /></div>
      <h2>{listing.food}</h2>
      <p className="donor">{listing.donor}</p>
      <div className="facts">
        <div><span>Quantity</span><strong>{listing.quantity} {listing.unit}</strong></div>
        <div><span>Weight</span><strong>{listing.kg} kg</strong></div>
      </div>
      <div className="location"><span aria-hidden="true">&#9678;</span><span>{listing.area}, {listing.city}</span></div>
      <p className="text-xs font-semibold text-emerald-800">{distance.toFixed(1)} km away · within {DELIVERY_RADIUS_KM} km delivery range</p>
      <div className="pickup"><span>Pickup window</span><strong>{formatTime(listing.pickupStart)} - {formatTime(listing.pickupEnd)}</strong></div>
      <div className="card-actions"><Link to={`/ngo/listings/${listing.id}`} state={{ ngoLocation }} className="primary-button">View details</Link><a href={mapsUrl(listing)} target="_blank" rel="noreferrer" className="map-link">Open pickup pin in Maps <span aria-hidden="true">&#8599;</span></a></div>
    </article>
  )
}

export default function Feed() {
  const { profile } = useAuth()
  const { listings, loading, error } = useListings()
  const [city, setCity] = useState('All cities')
  const [area, setArea] = useState('All areas')
  const [type, setType] = useState('All food types')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('expiry')
  const [ngoLocation, setNgoLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [requestingLocation, setRequestingLocation] = useState(false)
  const [nearbyAlertsEnabled, setNearbyAlertsEnabled] = useState(false)
  const [nearbyAlertError, setNearbyAlertError] = useState('')
  const ngoName = profile?.organisation || profile?.full_name?.trim().split(/\s+/)[0]

  async function findNearbyDonations() {
    setRequestingLocation(true)
    setLocationError('')
    try {
      setNgoLocation(await getCurrentLocation())
    } catch (error) {
      setLocationError(error.message)
      setNgoLocation(null)
    } finally {
      setRequestingLocation(false)
    }
  }

  async function enableNearbyAlerts() {
    setNearbyAlertError('')
    if (!supabase) {
      setNearbyAlertError('Nearby listing alerts require the connected Supabase backend.')
      return
    }
    if (!('Notification' in window)) {
      setNearbyAlertError('This browser does not support notifications.')
      return
    }
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
    if (permission !== 'granted') {
      setNearbyAlertError('Allow notifications in your browser settings to receive nearby listing alerts.')
      return
    }
    setNearbyAlertsEnabled(true)
  }

  useEffect(() => {
    if (!supabase || !ngoLocation || !nearbyAlertsEnabled) return undefined
    const channel = supabase
      .channel('nearby-donation-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'donations',
      }, ({ new: donation }) => {
        if (
          donation.status !== 'available'
          || !isWithinDeliveryRange(donation, ngoLocation.latitude, ngoLocation.longitude)
          || Notification.permission !== 'granted'
        ) return

        const alert = new Notification('New nearby food donation', {
          body: `${donation.title} is within ${DELIVERY_RADIUS_KM} km of your current location.`,
          tag: `donation-${donation.id}`,
        })
        alert.onclick = () => {
          window.focus()
          window.location.assign(`/ngo/listings/${donation.id}`)
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [ngoLocation, nearbyAlertsEnabled])

  const options = (key, fallback) => [fallback, ...new Set(listings.map((listing) => listing[key]).filter(Boolean))]
  const nearbyListings = useMemo(() => ngoLocation
    ? listings.filter((listing) => isWithinDeliveryRange(listing, ngoLocation.latitude, ngoLocation.longitude))
    : [], [listings, ngoLocation])
  const availableKg = nearbyListings.reduce((total, listing) => total + Number(listing.kg ?? 0), 0)
  const cityCount = new Set(nearbyListings.map((listing) => listing.city).filter(Boolean)).size
  const filteredListings = useMemo(() => nearbyListings.filter((listing) => {
    const haystack = `${listing.food} ${listing.donor} ${listing.area} ${listing.city}`.toLowerCase()
    return (city === 'All cities' || listing.city === city)
      && (area === 'All areas' || listing.area === area)
      && (type === 'All food types' || listing.type === type)
      && haystack.includes(search.toLowerCase())
  }).sort((a, b) => {
    if (sort === 'weight') return b.kg - a.kg
    if (sort === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    return new Date(a.expiresAt || 0) - new Date(b.expiresAt || 0)
  }), [nearbyListings, city, area, type, search, sort])

	return (
		<>
		<Navbar />
		<main className="feed-shell workspace-page workspace-page--ngo">
			<section className="workspace-hero workspace-hero--ngo">
				<div className="workspace-hero-copy">
					<p className="workspace-eyebrow"><span aria-hidden="true" /> CHARITY WORKSPACE</p>
					<h1>{ngoName ? `Welcome, ${ngoName}.` : 'Good food is waiting.'}</h1>
					<p>Find surplus food within {DELIVERY_RADIUS_KM} km of your current location, then claim it for your community.</p>
				</div>
				<div className="workspace-hero-actions">
					<Link to="/ngo/claims" className="workspace-secondary-action">View my claims <span aria-hidden="true">↗</span></Link>
					<div className="feed-status"><span className="status-pulse" />Live updates on</div>
				</div>
			</section>

			<section className="workspace-metrics" aria-label="Available food summary">
				<WorkspaceMetric label="Available donations" value={loading || !ngoLocation ? '—' : nearbyListings.length} detail={`Within the ${DELIVERY_RADIUS_KM} km range`} />
				<WorkspaceMetric label="Food available" value={loading || !ngoLocation ? '—' : formatKg(availableKg)} detail="Estimated combined weight nearby" tone="orange" />
				<WorkspaceMetric label="Cities covered" value={loading || !ngoLocation ? '—' : cityCount} detail="Within the delivery range" tone="blue" />
			</section>

			<section className="workspace-feed" aria-labelledby="available-food-title">
				<div className="workspace-section-intro workspace-feed-heading">
					<div>
						<p className="workspace-eyebrow">LIVE DONATIONS</p>
						<h2 id="available-food-title">Available food</h2>
					</div>
					<span className="workspace-results-count">{loading ? 'Loading…' : `${filteredListings.length} ${filteredListings.length === 1 ? 'donation' : 'donations'}`}</span>
				</div>
				<div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
					<div className="flex-1 text-sm text-emerald-950">
						<strong>{ngoLocation ? 'Nearby delivery search is active' : 'Set your location to find nearby donations'}</strong>
						<p className="text-xs text-emerald-800">{ngoLocation ? `Showing pickup pins within ${DELIVERY_RADIUS_KM} km of ${ngoLocation.latitude.toFixed(4)}, ${ngoLocation.longitude.toFixed(4)}. Your location is used for this search and claim checks, not saved.` : `Only donations within ${DELIVERY_RADIUS_KM} km of your device location are shown.`}</p>
					</div>
					<button type="button" onClick={findNearbyDonations} disabled={requestingLocation} className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
						{requestingLocation ? 'Finding location…' : ngoLocation ? 'Refresh my location' : 'Use my location'}
					</button>
					{ngoLocation && (
						<button type="button" onClick={enableNearbyAlerts} disabled={nearbyAlertsEnabled} className="rounded-full border border-emerald-700 px-5 py-2.5 text-sm font-bold text-emerald-800 disabled:opacity-60">
							{nearbyAlertsEnabled ? 'Nearby alerts on' : 'Enable nearby alerts'}
						</button>
					)}
				</div>
				{locationError && <p className="notice error" role="alert">{locationError}</p>}
				{nearbyAlertError && <p className="notice error" role="alert">{nearbyAlertError}</p>}
				<section className="filters workspace-feed-filters" aria-label="Filter listings"><label className="search-field"><span aria-hidden="true">&#8981;</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search food, donor, or area" /></label><select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Filter by city">{options('city', 'All cities').map((value) => <option key={value}>{value}</option>)}</select><select value={area} onChange={(event) => setArea(event.target.value)} aria-label="Filter by area">{options('area', 'All areas').map((value) => <option key={value}>{value}</option>)}</select><select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by food type">{options('type', 'All food types').map((value) => <option key={value}>{value}</option>)}</select><label className="sort-control">Sort<select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort listings"><option value="expiry">Expiring soonest</option><option value="newest">Newest first</option><option value="weight">Largest quantity</option></select></label></section>
				{error && <p className="notice error" role="alert">Could not load live listings: {error}</p>}
				{loading ? <div className="empty-state" role="status"><div className="spinner" />Loading nearby listings...</div> : !ngoLocation ? <div className="empty-state"><strong>Location needed</strong><span>Allow location access to see donations in the {DELIVERY_RADIUS_KM} km delivery range.</span></div> : filteredListings.length ? <section className="listing-grid" aria-live="polite">{filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} ngoLocation={ngoLocation} />)}</section> : <div className="empty-state"><strong>No donations within {DELIVERY_RADIUS_KM} km</strong><span>Try again later or refresh your current location.</span></div>}
			</section>
		</main>
		</>
	)
}
