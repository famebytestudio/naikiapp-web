import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useClaims } from '../../hooks/useClaims'

const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded'
const activeStatuses = new Set(['claimed', 'picked_up'])

function ClaimCard({ claim, onStatusUpdate, updatingId }) {
	const nextStatus = claim.status === 'claimed' ? 'picked_up' : claim.status === 'picked_up' ? 'delivered' : null
	const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(claim.address)}`
	const [deliveryKg, setDeliveryKg] = useState(claim.actualKg ?? claim.kg ?? '')
	const [deliveryError, setDeliveryError] = useState('')
	const handleStatusClick = () => {
		if (nextStatus === 'delivered') {
			const trimmedKg = String(deliveryKg).trim()
			const actualKg = Number(trimmedKg)
			if (trimmedKg === '' || !Number.isFinite(actualKg) || actualKg < 0) {
				setDeliveryError('Enter the actual kilograms delivered.')
				return
			}
			setDeliveryError('')
			onStatusUpdate(claim.id, nextStatus, actualKg)
			return
		}
		onStatusUpdate(claim.id, nextStatus)
	}
	return <article className="claim-card"><div className="claim-card-heading"><div><p className="food-type">{claim.type}</p><h2>{claim.food}</h2><p className="donor">{claim.quantity} {claim.unit} / {claim.kg} kg</p></div><span className={`claim-status ${claim.status}`}>{claim.status.replace('_', ' ')}</span></div><div className="claim-details"><span>Claimed {formatDate(claim.claimedAt)}</span><span>Pickup {formatDate(claim.pickupStart)}</span><span>{claim.area}, {claim.city}</span></div>{nextStatus === 'delivered' && <label className="delivery-kg-field"><span>Actual kg delivered</span><input type="number" min="0" step="0.1" value={deliveryKg} onChange={(event) => setDeliveryKg(event.target.value)} placeholder="e.g. 18.5" /></label>}{deliveryError && nextStatus === 'delivered' && <p className="delivery-error">{deliveryError}</p>}{claim.actualKg !== null && claim.actualKg !== undefined && claim.status === 'delivered' && <p className="delivered-weight">Recorded: {claim.actualKg} kg</p>}<div className="claim-card-actions">{nextStatus && <button className="claim-button" type="button" onClick={handleStatusClick} disabled={updatingId === claim.id}>{updatingId === claim.id ? 'Updating...' : nextStatus === 'picked_up' ? 'Mark picked up' : 'Mark delivered'}</button>}<Link to={`/ngo/listings/${claim.id}`} className="map-link">View donation <span aria-hidden="true">&#8594;</span></Link><a className="map-link" href={maps} target="_blank" rel="noreferrer">Open in Google Maps <span aria-hidden="true">&#8599;</span></a></div></article>
}

export default function MyClaims() {
	const { claims, loading, error, updateStatus } = useClaims()
	const [updatingId, setUpdatingId] = useState('')
	const [statusError, setStatusError] = useState('')
	const activeClaims = claims.filter((claim) => activeStatuses.has(claim.status))
	const completedClaims = claims.filter((claim) => !activeStatuses.has(claim.status))
	const handleStatusUpdate = async (donationId, status, actualKg = null) => {
		setUpdatingId(donationId)
		setStatusError('')
		const result = await updateStatus(donationId, status, actualKg)
		if (result.error) setStatusError(result.error.message)
		setUpdatingId('')
	}

	return <main className="feed-shell"><header className="app-header"><Link to="/ngo" className="brand"><span>n</span> naiki<span className="brand-mark">/</span></Link><nav><Link to="/ngo">Live feed</Link><Link className="active" to="/ngo/claims">My claims</Link><Link to="/dashboard">Impact</Link></nav><button className="profile-button" type="button" aria-label="Open profile">R</button></header><section className="feed-heading claims-heading"><div><p className="eyebrow">NGO workspace / your activity</p><h1>My claims.</h1><p className="subtitle">Keep track of food you are collecting and the impact already delivered.</p></div><div className="claims-summary"><strong>{activeClaims.length}</strong><span>active claims</span></div></section>{error && <p className="notice error">Could not load claims: {error}</p>}{statusError && <p className="notice error" role="alert">Could not update status: {statusError}</p>}{loading ? <div className="empty-state"><div className="spinner" />Loading your claims...</div> : <div className="claims-sections"><section className="claims-section"><div className="section-heading"><h2>Active</h2><span>{activeClaims.length}</span></div>{activeClaims.length ? <div className="claims-grid">{activeClaims.map((claim) => <ClaimCard key={claim.id} claim={claim} onStatusUpdate={handleStatusUpdate} updatingId={updatingId} />)}</div> : <div className="claims-empty">No active claims yet. Browse the <Link to="/ngo">live feed</Link> to find available food.</div>}</section><section className="claims-section"><div className="section-heading"><h2>Completed</h2><span>{completedClaims.length}</span></div>{completedClaims.length ? <div className="claims-grid">{completedClaims.map((claim) => <ClaimCard key={claim.id} claim={claim} onStatusUpdate={handleStatusUpdate} updatingId={updatingId} />)}</div> : <div className="claims-empty">Completed claims will appear here after delivery or expiry.</div>}</section></div>}</main>
}
