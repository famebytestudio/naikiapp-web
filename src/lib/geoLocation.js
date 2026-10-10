import { DELIVERY_RADIUS_KM } from '../utils/distance'

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support location services.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? `Location access was denied. Allow location access in your browser to find donations within ${DELIVERY_RADIUS_KM} km.`
          : 'Could not determine your location. Please try again.'
        reject(new Error(message))
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}
