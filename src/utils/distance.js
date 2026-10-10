export const DELIVERY_RADIUS_KM = 10

export function distanceKm(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  const rawValues = [fromLatitude, fromLongitude, toLatitude, toLongitude]
  if (rawValues.some((value) => value === null || value === undefined || value === '')) return null
  const values = rawValues.map(Number)
  if (!values.every(Number.isFinite)) return null

  const [fromLat, fromLon, toLat, toLon] = values.map((value) => (value * Math.PI) / 180)
  const latitudeDelta = toLat - fromLat
  const longitudeDelta = toLon - fromLon
  const rawHaversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(longitudeDelta / 2) ** 2
  const haversine = Math.min(1, Math.max(0, rawHaversine))

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function isWithinDeliveryRange(donation, latitude, longitude) {
  const distance = distanceKm(latitude, longitude, donation.pickup_latitude, donation.pickup_longitude)
  return distance !== null && distance <= DELIVERY_RADIUS_KM
}
