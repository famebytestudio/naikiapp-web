import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useListings } from '../../hooks/useListings'
import { supabase } from '../../lib/supabaseClient'

const formatTime = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Flexible pickup'

export default function ListingDetail() {
	const { id } = useParams()
	const { listings, loading } = useListings()
	const [claiming, setClaiming] = useState(false)
	const [claimed, setClaimed] = useState(false)
	const [claimError, setClaimError] = useState('')
	const listing = listings.find((item) => String(item.id) === id)

	if (loading) return <main className="detail-shell"><Link to="/ngo" className="back-link">&#8592; Back to feed</Link><div className="empty-state"><div className="spinner" />Loading listing...</div></main>
	if (!listing) return <main className="detail-shell"><Link to="/ngo" className="back-link">&#8592; Back to feed</Link><div className="empty-state"><strong>Listing unavailable</strong><span>It may have been claimed or expired.</span></div></main>

	const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`
	const claimDonation = async () => {
		if (!supabase) {
			setClaimError('Live claims are unavailable until Supabase is configured.')
			return
		}

		setClaiming(true)
		setClaimError('')
		const { error } = await supabase.rpc('claim_donation', { p_donation_id: listing.id })
		if (error) setClaimError(error.message)
		else setClaimed(true)
		setClaiming(false)
	}

	return <main className="detail-shell"><Link to="/ngo" className="back-link">&#8592; Back to feed</Link><article className="detail-card"><div className="detail-accent" /><p className="eyebrow">Available donation</p><h1>{listing.food}</h1><p className="detail-donor">Posted by <strong>{listing.donor}</strong></p><div className="detail-stats"><div><span>Food type</span><strong>{listing.type}</strong></div><div><span>Quantity</span><strong>{listing.quantity} {listing.unit}</strong></div><div><span>Weight</span><strong>{listing.kg} kg</strong></div></div><div className="detail-row"><span>Pickup window</span><strong>{formatTime(listing.pickupStart)}<br />to {formatTime(listing.pickupEnd)}</strong></div><div className="detail-row"><span>Pickup address</span><strong>{listing.address}</strong></div>{listing.description && <p className="description">{listing.description}</p>}<div className="detail-actions"><button className="claim-button" type="button" onClick={claimDonation} disabled={claiming || claimed}>{claimed ? 'Claimed successfully' : claiming ? 'Claiming...' : 'Claim this food'}</button><a className="map-link" href={maps} target="_blank" rel="noreferrer">Open in Google Maps <span aria-hidden="true">&#8599;</span></a></div>{claimError && <p className="notice error" role="alert">{claimError}</p>}</article></main>
}
