import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import Navbar from '../../components/Navbar'
import { useAuth } from '../../context/useAuth'
import { claimDonation, getById } from '../../lib/listingsApi'
import PickupLocationMap from '../../components/LazyPickupLocationMap'
import { getCurrentLocation } from '../../lib/geoLocation'
import { supabase } from '../../lib/supabaseClient'
import { normalizeListing } from '../../hooks/useListings'
import { DELIVERY_RADIUS_KM, distanceKm } from '../../utils/distance'

const formatTime = (value) => value
  ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Flexible pickup'
const formatTimestamp = (value) => value
  ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Not recorded'

export default function ListingDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { role } = useAuth()
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState('')
  const [ngoLocation, setNgoLocation] = useState(location.state?.ngoLocation ?? null)

  const {
    data: listing = null,
    isLoading: loading,
    error: listingError,
  } = useQuery({
    queryKey: ['ngo', 'listing-detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (supabase) {
        const { data, error } = await supabase.from('donations').select('*').eq('id', id).maybeSingle()
        if (error) throw error
        return data ? {
          ...normalizeListing(data),
          claimedAt: data.claimed_at,
          pickedUpAt: data.picked_up_at,
          deliveredAt: data.delivered_at,
        } : null
      }
      const data = await getById(id)
      return data ? {
        ...normalizeListing(data),
        claimedAt: data.claimed_at,
        pickedUpAt: data.picked_up_at,
        deliveredAt: data.delivered_at,
      } : null
    },
  })

  const {
    data: statusTimeline = [],
    error: timelineQueryError,
  } = useQuery({
    queryKey: ['ngo', 'donation-timeline', id],
    enabled: Boolean(id && supabase),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donation_status_log')
        .select('*')
        .eq('donation_id', id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  useEffect(() => {
    if (!id || !supabase) return undefined

    const channel = supabase
      .channel(`donation-status-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'donation_status_log',
        filter: `donation_id=eq.${id}`,
      }, () => queryClient.invalidateQueries({ queryKey: ['ngo', 'donation-timeline', id] }))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id, queryClient])

  const timeline = useMemo(() => {
    if (supabase) return statusTimeline
    if (!listing) return []
    return [
      { id: 'available', to_status: 'available', created_at: listing.createdAt },
      { id: 'claimed', to_status: 'claimed', created_at: listing.claimedAt },
      { id: 'picked_up', to_status: 'picked_up', created_at: listing.pickedUpAt },
      { id: 'delivered', to_status: 'delivered', created_at: listing.deliveredAt, actual_kg: listing.actualKg },
      { id: 'cancelled', to_status: 'cancelled', created_at: listing.cancelled_at },
    ].filter((event) => event.created_at)
  }, [listing, statusTimeline])

  const loadError = listingError?.message ?? ''
  const timelineError = timelineQueryError?.message ?? ''

  async function handleClaim() {
    setClaiming(true)
    setClaimError('')
    try {
      const destination = ngoLocation ?? await getCurrentLocation()
      setNgoLocation(destination)
      if (supabase) {
        const { error } = await supabase.rpc('claim_donation', {
          p_donation_id: id,
          p_ngo_latitude: destination.latitude,
          p_ngo_longitude: destination.longitude,
        })
        if (error) throw error
      } else {
        await claimDonation(id, destination)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ngo', 'listing-detail', id] }),
        queryClient.invalidateQueries({ queryKey: ['ngo', 'donation-timeline', id] }),
      ])
      navigate('/ngo/claims', { replace: true, state: { claimed: true } })
    } catch (error) {
      setClaimError(error.message)
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="detail-shell">
          <Link to="/ngo/feed" className="back-link">← Back to feed</Link>
          <div className="empty-state"><div className="spinner" />Loading listing…</div>
        </main>
      </>
    )
  }

  if (!listing) {
    return (
      <>
        <Navbar />
        <main className="detail-shell">
          <Link to="/ngo/feed" className="back-link">← Back to feed</Link>
          <div className="empty-state">
            <strong>{loadError ? 'Could not load this donation' : 'Listing unavailable'}</strong>
            <span>{loadError || 'It may have been removed or you may not have access to it.'}</span>
          </div>
        </main>
      </>
    )
  }

  const hasPickupPin = listing.pickup_latitude !== null && listing.pickup_longitude !== null
  const maps = `https://www.google.com/maps/search/?api=1&query=${hasPickupPin
    ? `${listing.pickup_latitude},${listing.pickup_longitude}`
    : encodeURIComponent(listing.address)}`
  const distance = ngoLocation && hasPickupPin
    ? distanceKm(ngoLocation.latitude, ngoLocation.longitude, listing.pickup_latitude, listing.pickup_longitude)
    : null
  const withinRange = distance !== null && distance <= (listing.delivery_radius_km ?? DELIVERY_RADIUS_KM)
  const canClaim = role === 'ngo' && listing.status === 'available'

  return (
    <>
      <Navbar />
      <main className="detail-shell">
        <Link to="/ngo/feed" className="back-link">← Back to feed</Link>
        <article className="detail-card">
          <div className="detail-accent" />
          <p className="eyebrow">Donation details</p>
          <h1>{listing.food}</h1>
          <p className="detail-donor">Posted by <strong>{listing.donor}</strong></p>

          <div className="detail-stats">
            <div><span>Food type</span><strong>{listing.type}</strong></div>
            <div><span>Quantity</span><strong>{listing.quantity} {listing.unit}</strong></div>
            <div><span>Estimated weight</span><strong>{listing.kg} kg</strong></div>
          </div>
          <div className="detail-row">
            <span>Pickup window</span>
            <strong>{formatTime(listing.pickupStart)}<br />to {formatTime(listing.pickupEnd)}</strong>
          </div>
          <div className="detail-row"><span>Pickup address</span><strong>{listing.address}</strong></div>
          {hasPickupPin && (
            <>
              <PickupLocationMap
                latitude={listing.pickup_latitude}
                longitude={listing.pickup_longitude}
                interactive={false}
              />
              <div className="detail-row">
                <span>Delivery range</span>
                <strong>
                  {listing.delivery_radius_km ?? DELIVERY_RADIUS_KM} km
                  {distance !== null ? ` · ${distance.toFixed(1)} km from your location` : ''}
                </strong>
              </div>
              {distance !== null && !withinRange && (
                <p className="notice error" role="status">This pickup is outside your {listing.delivery_radius_km ?? DELIVERY_RADIUS_KM} km delivery range and cannot be claimed.</p>
              )}
            </>
          )}
          {listing.description && <p className="description">{listing.description}</p>}

          {timeline.length > 0 && (
            <div className="status-timeline">
              <div className="timeline-heading"><h2>Status timeline</h2></div>
              {timeline.map((event) => (
                <div key={event.id} className="timeline-row">
                  <span className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-meta">
                      <strong>{event.to_status?.replace('_', ' ') ?? 'Updated'}</strong>
                      <time>{formatTimestamp(event.created_at)}</time>
                    </div>
                    {event.actual_kg !== null && event.actual_kg !== undefined && (
                      <small>Delivered weight: {Number(event.actual_kg).toFixed(1).replace(/\.0$/, '')} kg</small>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {timelineError && <p className="notice error" role="alert">Could not load status history: {timelineError}</p>}
          {claimError && <p className="notice error" role="alert">Could not claim donation: {claimError}</p>}

          <div className="detail-actions">
            {canClaim && (
              <button className="claim-button" type="button" onClick={handleClaim} disabled={claiming || (distance !== null && !withinRange)}>
                {claiming ? 'Claiming…' : withinRange ? 'Claim this food' : 'Check location to claim'}
              </button>
            )}
            {listing.status !== 'available' && (
              <p className="muted">This donation is {listing.status.replace('_', ' ')}.</p>
            )}
            <a className="map-link" href={maps} target="_blank" rel="noreferrer">
              Open in Google Maps <span aria-hidden="true">↗</span>
            </a>
          </div>
        </article>
      </main>
    </>
  )
}
