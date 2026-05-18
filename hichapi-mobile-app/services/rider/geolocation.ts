/**
 * services/rider/geolocation.ts
 *
 * GPS tracking service — requests expo-location permission,
 * sends coordinates every 15 seconds while in_transit.
 * Requirements: 3.7, 10.7
 */
import * as Location from 'expo-location'
import { postRiderLocation } from './api'

let gpsInterval: ReturnType<typeof setInterval> | null = null

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  return status === 'granted'
}

export async function startGpsTracking(
  orderId: string,
  token: string,
): Promise<void> {
  const granted = await requestLocationPermission()
  if (!granted) throw new Error('Permiso de ubicación denegado')

  // Clear any existing interval
  stopGpsTracking()

  gpsInterval = setInterval(async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      await postRiderLocation(
        token,
        orderId,
        location.coords.latitude,
        location.coords.longitude,
      )
    } catch (err) {
      // GPS transmission failure is non-fatal — log and continue
      console.warn('GPS tracking error:', err)
    }
  }, 15_000) // every 15 seconds
}

export function stopGpsTracking(): void {
  if (gpsInterval !== null) {
    clearInterval(gpsInterval)
    gpsInterval = null
  }
}

export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  console.log('[GPS] getCurrentPosition called');
  try {
    const granted = await requestLocationPermission()
    console.log('[GPS] requestLocationPermission granted:', granted);
    if (!granted) {
      console.log('[GPS] Location permission denied, using development fallback (Ovalle)')
      return { lat: -30.6011, lng: -71.2011 }
    }
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })
    console.log('[GPS] getCurrentPositionAsync success:', location.coords.latitude, location.coords.longitude);
    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    }
  } catch (err) {
    console.log('[GPS] getCurrentPositionAsync failed, using development fallback (Ovalle):', err)
    return { lat: -30.6011, lng: -71.2011 }
  }
}
