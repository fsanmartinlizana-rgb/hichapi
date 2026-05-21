/**
 * Geofencing del comensal — permisos GPS + check periódico vía API.
 */
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { checkGeofence, registerPushToken } from './api'
import { notificationService } from '../notifications/NotificationService'

const GEO_OPT_OUT_KEY = '@hichapi:geolocation_opt_out'
const MIN_MOVE_METERS = 80

let watchSubscription: Location.LocationSubscription | null = null
let lastCheck: { lat: number; lng: number } | null = null

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

async function runCheck(lat: number, lng: number) {
  const result = await checkGeofence(lat, lng)
  for (const r of result.eligible) {
    if (r.geofence_message) {
      await notificationService.scheduleLocalNotification(
        r.restaurant_name,
        r.geofence_message,
      )
    }
  }
}

async function onPositionUpdate(location: Location.LocationObject) {
  const { latitude: lat, longitude: lng } = location.coords
  if (lastCheck && distanceMeters(lastCheck, { lat, lng }) < MIN_MOVE_METERS) {
    return
  }
  lastCheck = { lat, lng }
  try {
    await runCheck(lat, lng)
  } catch (e) {
    console.warn('[geofence] check failed', e)
  }
}

export async function isGeolocationOptedOut(): Promise<boolean> {
  return (await AsyncStorage.getItem(GEO_OPT_OUT_KEY)) === '1'
}

export async function setGeolocationOptOut(optOut: boolean): Promise<void> {
  if (optOut) {
    await AsyncStorage.setItem(GEO_OPT_OUT_KEY, '1')
    await stopCustomerGeofencing()
  } else {
    await AsyncStorage.removeItem(GEO_OPT_OUT_KEY)
  }
}

export async function startCustomerGeofencing(): Promise<boolean> {
  if (await isGeolocationOptedOut()) return false

  const { status: existing } = await Location.getForegroundPermissionsAsync()
  let status = existing
  if (existing !== 'granted') {
    const req = await Location.requestForegroundPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') return false

  const token = await notificationService.registerForPushNotifications()
  if (token) {
    try {
      await registerPushToken(token)
    } catch (e) {
      console.warn('[geofence] push token sync failed', e)
    }
  }

  await stopCustomerGeofencing()

  watchSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: MIN_MOVE_METERS,
      timeInterval: 60_000,
    },
    onPositionUpdate,
  )

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  })
  await onPositionUpdate(pos)

  return true
}

export async function stopCustomerGeofencing(): Promise<void> {
  if (watchSubscription) {
    watchSubscription.remove()
    watchSubscription = null
  }
  lastCheck = null
}
