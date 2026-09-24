import { useEffect, useState } from 'react'
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
	const [isVerifiedNgo, setIsVerifiedNgo] = useState(false)
	const [checkingNgoStatus, setCheckingNgoStatus] = useState(Boolean(supabase))
	const listing = listings.find((item) => String(item.id) === id)

	useEffect(() => {
		let isMounted = true
		const checkNgoVerification = async () => {
			if (!supabase) {
				if (isMounted) setCheckingNgoStatus(false)
				return
			}

			const { data: userData } = await supabase.auth.getUser()
			const userId = userData?.user?.id
			if (!userId) {
				if (isMounted) {
					setIsVerifiedNgo(false)
					setCheckingNgoStatus(false)
				}
				return
			}

			const [{ data: profileData }, { data: ngoData }] = await Promise.all([
				supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
				supabase.from('ngo_details').select('verification_status').eq('profile_id', userId).maybeSingle(),
			])

			if (isMounted) {
				const nextVerified = profileData?.role === 'ngo' && ngoData?.verification_status === 'verified'
				setIsVerifiedNgo(nextVerified)
				setCheckingNgoStatus(false)
			}
		}

		checkNgoVerification()
		return () => {
			isMounted = false
		}
	}, [])

	if (loading) return <main className="detail-shell"><Link to="/ngo" className="back-link">&#8592; Back to feed</Link><div className="empty-state"><div className="spinner" />Loading listing...</div></main>
	if (!listing) return <main className="detail-shell"><Link to="/ngo" className="back-link">&#8592; Back to feed</Link><div className="empty-state"><strong>Listing unavailable</strong><span>It may have been claimed or expired.</span></div></main>

	const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`
	const claimDonation = async () => {
		if (!supabase) {
			setClaimError('Live claims are unavailable until Supabase is configured.')
			return
		}
		if (!isVerifiedNgo) {
			setClaimError('Only verified NGOs can claim food.')
			return
		}

		setClaiming(true)
		setClaimError('')
		const { error } = await supabase.rpc('claim_donation', { p_donation_id: listing.id })
		if (error) setClaimError(error.message)
		else setClaimed(true)
		setClaiming(false)
	}

	const claimDisabled = claiming || claimed || !isVerifiedNgo || checkingNgoStatus || listing.status !== 'available'
	const claimLabel = claimed ? 'Claimed successfully' : checkingNgoStatus ? 'Checking verification...' : claiming ? 'Claiming...' : !isVerifiedNgo ? 'Verified NGOs only' : 'Claim this food'

	return <main className="detail-shell"><Link to="/ngo" className="back-link">&#8592; Back to feed</Link><article className="detail-card"><div className="detail-accent" /><p className="eyebrow">Available donation</p><h1>{listing.food}</h1><p className="detail-donor">Posted by <strong>{listing.donor}</strong></p><div className="detail-stats"><div><span>Food type</span><strong>{listing.type}</strong></div><div><span>Quantity</span><strong>{listing.quantity} {listing.unit}</strong></div><div><span>Weight</span><strong>{listing.kg} kg</strong></div></div><div className="detail-row"><span>Pickup window</span><strong>{formatTime(listing.pickupStart)}<br />to {formatTime(listing.pickupEnd)}</strong></div><div className="detail-row"><span>Pickup address</span><strong>{listing.address}</strong></div>{listing.description && <p className="description">{listing.description}</p>}<div className="detail-actions"><button className="claim-button" type="button" onClick={claimDonation} disabled={claimDisabled}>{claimLabel}</button><a className="map-link" href={maps} target="_blank" rel="noreferrer">Open in Google Maps <span aria-hidden="true">&#8599;</span></a></div>{!isVerifiedNgo && !checkingNgoStatus && <p className="notice error" role="alert">Verified NGO status is required before claiming donations.</p>}{claimError && <p className="notice error" role="alert">{claimError}</p>}</article></main>
}
