import { useEffect, useState } from 'react'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

const PAKISTAN_CENTER = [30.3753, 69.3451]
const RADIUS_METERS = 10_000

const markerIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect?.(event.latlng)
    },
  })
  return null
}

function MapCenter({ latitude, longitude, zoom }) {
  const map = useMap()
  useEffect(() => {
    map.setView([latitude, longitude], zoom)
  }, [map, latitude, longitude, zoom])
  return null
}

export default function PickupLocationMap({ latitude, longitude, onChange, interactive = true }) {
  const [locationError, setLocationError] = useState('')
  const hasLocation = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
  const position = hasLocation ? [Number(latitude), Number(longitude)] : PAKISTAN_CENTER

  function useCurrentLocation() {
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('This browser does not support location. Select the pickup point on the map instead.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => onChange({ latitude: coords.latitude, longitude: coords.longitude }),
      () => setLocationError('Could not get your location. Allow location access or select the pickup point on the map.'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">{interactive ? 'Set the pickup pin' : 'Pickup point and delivery range'}</p>
          {interactive && <p className="text-xs text-slate-500">Click the map to place the exact pickup point.</p>}
        </div>
        {interactive && (
          <button
            type="button"
            onClick={useCurrentLocation}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Use my location
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-300">
        <MapContainer center={position} zoom={hasLocation ? 10 : 5} scrollWheelZoom className="h-72 w-full">
          <MapCenter latitude={position[0]} longitude={position[1]} zoom={hasLocation ? 10 : 5} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onSelect={interactive ? onChange : null} />
          {hasLocation && (
            <>
              <Circle center={position} radius={RADIUS_METERS} pathOptions={{ color: '#16804a', fillColor: '#35a66b', fillOpacity: 0.12 }} />
              <Marker position={position} icon={markerIcon} />
            </>
          )}
        </MapContainer>
      </div>
      {hasLocation ? (
        <p className="mt-2 text-xs text-slate-600">
          Pickup pin: {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)} · delivery range: 10 km
        </p>
      ) : interactive ? (
        <p className="mt-2 text-xs font-semibold text-rose-600" role="status">
          Select a pickup location to continue. The green circle shows the fixed 10 km delivery range.
        </p>
      ) : <p className="mt-2 text-xs text-slate-600">Pickup location was not pinned for this listing.</p>}
      {interactive && locationError && <p className="mt-2 text-xs font-semibold text-rose-600" role="alert">{locationError}</p>}
    </div>
  )
}
