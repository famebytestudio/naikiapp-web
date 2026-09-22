import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useListings } from '../../hooks/useListings'

const formatTime = (value) => value ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'Flexible pickup'
const mapsUrl = (listing) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`

function ListingCard({ listing }) {
	return (
		<article className="listing-card">
			<div className="card-topline"><span className="food-type">{listing.type}</span><span className="live-dot">Available now</span></div>
			<h2>{listing.food}</h2>
			<p className="donor">{listing.donor}</p>
			<div className="facts">
				<div><span>Quantity</span><strong>{listing.quantity} {listing.unit}</strong></div>
				<div><span>Weight</span><strong>{listing.kg} kg</strong></div>
			</div>
			<div className="location"><span aria-hidden="true">&#9678;</span><span>{listing.area}, {listing.city}</span></div>
			<div className="pickup"><span>Pickup window</span><strong>{formatTime(listing.pickupStart)} - {formatTime(listing.pickupEnd)}</strong></div>
			<div className="card-actions"><Link to={`/ngo/listings/${listing.id}`} className="primary-button">View details</Link><a href={mapsUrl(listing)} target="_blank" rel="noreferrer" className="map-link">Open in Maps <span aria-hidden="true">&#8599;</span></a></div>
		</article>
	)
}

export default function Feed() {
	const { listings, loading, error } = useListings()
	const [city, setCity] = useState('All cities')
	const [area, setArea] = useState('All areas')
	const [type, setType] = useState('All food types')
	const [search, setSearch] = useState('')

	const options = (key, fallback) => [fallback, ...new Set(listings.map((listing) => listing[key]).filter(Boolean))]
	const filteredListings = useMemo(() => listings.filter((listing) => {
		const haystack = `${listing.food} ${listing.donor} ${listing.area} ${listing.city}`.toLowerCase()
		return (city === 'All cities' || listing.city === city) && (area === 'All areas' || listing.area === area) && (type === 'All food types' || listing.type === type) && haystack.includes(search.toLowerCase())
	}).sort((a, b) => new Date(a.expiresAt || 0) - new Date(b.expiresAt || 0)), [listings, city, area, type, search])

	return (
		<main className="feed-shell">
			<header className="app-header"><Link to="/ngo" className="brand"><span>n</span> naiki<span className="brand-mark">/</span></Link><nav><Link className="active" to="/ngo">Live feed</Link><Link to="/ngo/claims">My claims</Link></nav><button className="profile-button" type="button" aria-label="Open profile">R</button></header>
			<section className="feed-heading"><div><p className="eyebrow">NGO workspace / live nearby</p><h1>Good food is waiting.</h1><p className="subtitle">Find surplus food around you, claim what your community can use, and make today count.</p></div><div className="feed-status"><span className="status-pulse" />Live updates on</div></section>
			<section className="filters" aria-label="Filter listings"><label className="search-field"><span aria-hidden="true">&#8981;</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search food, donor, or area" /></label><select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Filter by city">{options('city', 'All cities').map((value) => <option key={value}>{value}</option>)}</select><select value={area} onChange={(event) => setArea(event.target.value)} aria-label="Filter by area">{options('area', 'All areas').map((value) => <option key={value}>{value}</option>)}</select><select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by food type">{options('type', 'All food types').map((value) => <option key={value}>{value}</option>)}</select><span className="sort-label">Expiring soonest <span aria-hidden="true">&#8595;</span></span></section>
			{error && <p className="notice error">Could not load live listings: {error}</p>}
			{loading ? <div className="empty-state"><div className="spinner" />Loading nearby listings...</div> : filteredListings.length ? <section className="listing-grid" aria-live="polite">{filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</section> : <div className="empty-state"><strong>No matching listings</strong><span>Try widening your filters. New donations will appear here automatically.</span></div>}
		</main>
	)
}
