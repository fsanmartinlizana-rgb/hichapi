/**
 * lib/delivery/route-engine.service.ts
 *
 * RouteEngineService — Google Maps Directions API, vehicle-aware routing,
 * fallback mode, and Claude Haiku delivery briefing.
 * Requirements: 5.1, 5.2, 5.5, 5.6, 5.7, 5.9
 */
import Anthropic from '@anthropic-ai/sdk'
import type { PlannedRoute, RouteStep, VehicleType } from './types'

const GMAPS_BASE = 'https://maps.googleapis.com/maps/api/directions/json'

// ── Haversine distance (for Property 10 validation) ───────────────────────────

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Route step parser ─────────────────────────────────────────────────────────

function parseStep(step: Record<string, unknown>): RouteStep {
  const htmlInstruction = (step.html_instructions as string) ?? ''
  // Strip HTML tags for plain text instruction
  const instruction = htmlInstruction.replace(/<[^>]*>/g, '')
  const distance = step.distance as { value: number }
  const duration = step.duration as { value: number }
  return {
    instruction,
    distance_m: distance?.value ?? 0,
    duration_s: duration?.value ?? 0,
    maneuver:   (step.maneuver as string) ?? null,
  }
}

// ── Nominatim geocoder (free, no API key needed) ──────────────────────────────

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (mapboxToken) {
      // Clean query and target specifically Ovalle
      const query = address.replace(/\s+(mirador|depto|piso|local|of\.|apto|block|villa)\s+\S+$/i, '').trim()
      const bbox = '-71.25,-30.63,-71.15,-30.55' // Ovalle city area bounding box
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=cl&bbox=${bbox}`
      console.log('[geocode] Querying Mapbox Geocoding:', query)
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const feature = data.features?.[0]
        if (feature) {
          const [lng, lat] = feature.geometry.coordinates
          const result = { lat, lng }
          console.log('[geocode] Mapbox Result for', query, '->', result)
          return result
        }
      }
      console.log('[geocode] Mapbox Geocoding failed or returned no results. Falling back to Nominatim.')
    }

    // Nominatim fallback
    const streetOnly = address.replace(/\s+(mirador|depto|piso|local|of\.|apto|block|villa)\s+\S+$/i, '').trim()
    const params = new URLSearchParams({
      street:       streetOnly,
      city:         'Ovalle',
      country:      'Chile',
      format:       'json',
      limit:        '1',
      countrycodes: 'cl',
    })
    const url = `https://nominatim.openstreetmap.org/search?${params}`
    console.log('[geocode] Querying Nominatim:', streetOnly)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HichapiDeliveryApp/1.0' },
    })
    if (!res.ok) { console.log('[geocode] HTTP error:', res.status); return null }
    const data = await res.json()
    if (!data?.[0]) {
      console.log('[geocode] No results for:', streetOnly)
      return null
    }
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    console.log('[geocode] Nominatim Result for', streetOnly, '->', result)
    return result
  } catch (err) {
    console.log('[geocode] Error:', err)
    return null
  }
}

// ── Route calculation ─────────────────────────────────────────────────────────

export interface RouteResult {
  route: PlannedRoute | null
  fallback: boolean
  fallbackPickupAddress?: string
  fallbackDeliveryAddress?: string
}

export async function calculateRoute(
  origin: { lat: number; lng: number },
  pickupAddress: string,
  deliveryAddress: string,
  vehicleType: VehicleType,
): Promise<RouteResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    // Geocode pickup and delivery addresses using Mapbox/Nominatim for real coordinates
    const [pickupGeo, deliveryGeo] = await Promise.all([
      geocodeAddress(pickupAddress),
      geocodeAddress(deliveryAddress),
    ])

    const geocodingFailed = !pickupGeo || !deliveryGeo

    // Use real geocoded coords if available, otherwise fall back to synthetic offsets
    const pickupLat   = pickupGeo?.lat   ?? origin.lat + 0.004
    const pickupLng   = pickupGeo?.lng   ?? origin.lng + 0.004
    const deliveryLat = deliveryGeo?.lat ?? origin.lat - 0.006
    const deliveryLng = deliveryGeo?.lng ?? origin.lng - 0.006

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (mapboxToken) {
      try {
        const profile = (vehicleType === 'bicycle' || vehicleType === 'cargo_bike') ? 'cycling' : 'driving'
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${origin.lng},${origin.lat};${pickupLng},${pickupLat};${deliveryLng},${deliveryLat}.json?access_token=${mapboxToken}&geometries=polyline&steps=true`
        
        console.log('[route] Querying Mapbox Directions:', profile)
        const directionsRes = await fetch(directionsUrl)
        if (directionsRes.ok) {
          const directionsData = await directionsRes.json()
          if (directionsData.code === 'Ok' && directionsData.routes?.[0]) {
            const mbRoute = directionsData.routes[0]
            const leg1 = mbRoute.legs?.[0]
            const totalDurationS = mbRoute.duration
            const now = Date.now()
            
            const planned: PlannedRoute = {
              polyline:         mbRoute.geometry,
              distance_km:      mbRoute.distance / 1000,
              duration_minutes: Math.ceil(totalDurationS / 60),
              steps:            (mbRoute.legs || []).flatMap((leg: any) => 
                (leg.steps || []).map((s: any) => ({
                  instruction: s.maneuver.instruction,
                  distance_m:  Math.round(s.distance),
                  duration_s:  Math.round(s.duration),
                  maneuver:    s.maneuver.type || null
                }))
              ),
              eta_pickup:   new Date(now + (leg1?.duration || 0) * 1000).toISOString(),
              eta_delivery: new Date(now + totalDurationS * 1000).toISOString(),
              bike_friendly: vehicleType === 'bicycle' || vehicleType === 'cargo_bike',
              waypoints: {
                origin:   { lat: origin.lat,  lng: origin.lng  },
                pickup:   { lat: pickupLat,   lng: pickupLng   },
                delivery: { lat: deliveryLat, lng: deliveryLng },
              }
            }
            console.log('[route] Mapbox Directions routing succeeded!')
            return { route: planned, fallback: geocodingFailed }
          }
        }
      } catch (err) {
        console.error('[route] Mapbox Directions routing error:', err)
      }
    }

    console.log('[route] Mapbox Directions unavailable. Using straight-line fallback.')
    const dist1 = haversineDistance(origin.lat, origin.lng, pickupLat, pickupLng)
    const dist2 = haversineDistance(pickupLat, pickupLng, deliveryLat, deliveryLng)
    const totalDistanceM = (dist1 + dist2) * 2500

    const speedKmh = vehicleType === 'bicycle' || vehicleType === 'cargo_bike' ? 15 : 30
    const durationSeconds1 = (dist1 * 2.5 / speedKmh) * 3600
    const durationSeconds2 = (dist2 * 2.5 / speedKmh) * 3600
    const totalDurationS = durationSeconds1 + durationSeconds2
    const now = Date.now()

    const planned: PlannedRoute = {
      polyline: 'mock_polyline',
      distance_km: totalDistanceM / 1000,
      duration_minutes: Math.ceil(totalDurationS / 60),
      steps: [
        { instruction: 'Inicia el viaje desde tu ubicación actual',                  distance_m: Math.round(dist1 * 300), duration_s: Math.round(durationSeconds1 * 0.3), maneuver: 'depart'     },
        { instruction: 'Avanza y gira a la derecha hacia el punto de recogida',      distance_m: Math.round(dist1 * 700), duration_s: Math.round(durationSeconds1 * 0.7), maneuver: 'turn-right' },
        { instruction: `Llegada al punto de recogida: ${pickupAddress}`,             distance_m: 0,                       duration_s: 0,                                  maneuver: 'arrive'     },
        { instruction: 'Retira el pedido y confirma en la aplicación',               distance_m: 100,                     duration_s: 30,                                 maneuver: 'depart'     },
        { instruction: `Dirígete al punto de entrega: ${deliveryAddress}`,           distance_m: Math.round(dist2 * 1000), duration_s: Math.round(durationSeconds2),      maneuver: 'straight'   },
        { instruction: '¡Llegada al destino! Entrega al cliente.',                   distance_m: 0,                       duration_s: 0,                                  maneuver: 'arrive'     },
      ],
      eta_pickup:   new Date(now + durationSeconds1 * 1000).toISOString(),
      eta_delivery: new Date(now + totalDurationS * 1000).toISOString(),
      bike_friendly: vehicleType === 'bicycle' || vehicleType === 'cargo_bike',
      waypoints: {
        origin:   { lat: origin.lat,  lng: origin.lng  },
        pickup:   { lat: pickupLat,   lng: pickupLng   },
        delivery: { lat: deliveryLat, lng: deliveryLng },
      },
    }

    return { route: planned, fallback: geocodingFailed }
  }



  const isBike = vehicleType === 'bicycle' || vehicleType === 'cargo_bike'
  const mode   = isBike ? 'bicycling' : 'driving'

  const params = new URLSearchParams({
    origin:      `${origin.lat},${origin.lng}`,
    destination: deliveryAddress,
    waypoints:   `via:${encodeURIComponent(pickupAddress)}`,
    mode,
    key:         apiKey,
  })

  try {
    const res = await fetch(`${GMAPS_BASE}?${params}`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`Google Maps API HTTP ${res.status}`)

    const data = await res.json()
    if (data.status !== 'OK') throw new Error(`Google Maps status: ${data.status}`)

    const route = data.routes[0]
    const leg1  = route.legs[0]  // origin → pickup
    const leg2  = route.legs[1]  // pickup → delivery

    const totalDistanceM  = (leg1.distance.value ?? 0) + (leg2.distance.value ?? 0)
    const totalDurationS  = (leg1.duration.value  ?? 0) + (leg2.duration.value  ?? 0)
    const now             = Date.now()

    const planned: PlannedRoute = {
      polyline:         route.overview_polyline.points,
      distance_km:      totalDistanceM / 1000,
      duration_minutes: Math.ceil(totalDurationS / 60),
      steps:            [
        ...(leg1.steps ?? []).map(parseStep),
        ...(leg2.steps ?? []).map(parseStep),
      ],
      eta_pickup:   new Date(now + (leg1.duration.value ?? 0) * 1000).toISOString(),
      eta_delivery: new Date(now + totalDurationS * 1000).toISOString(),
      bike_friendly: isBike,
      waypoints: {
        origin:   { lat: origin.lat,  lng: origin.lng },
        pickup:   { lat: leg1.end_location.lat,   lng: leg1.end_location.lng },
        delivery: { lat: leg2.end_location.lat,   lng: leg2.end_location.lng },
      },
    }

    return { route: planned, fallback: false }
  } catch {
    return {
      route: null,
      fallback: true,
      fallbackPickupAddress: pickupAddress,
      fallbackDeliveryAddress: deliveryAddress,
    }
  }
}

// ── Claude Haiku delivery briefing ────────────────────────────────────────────

export async function generateDeliveryBriefing(
  route: PlannedRoute,
  pickupAddress: string,
  deliveryAddress: string,
  restaurantNotes: string | null,
): Promise<string> {
  try {
    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 200,
      messages: [
        {
          role:    'user',
          content: `Genera un briefing conciso para un repartidor en español:
- Recogida en: ${pickupAddress}
- Entrega en: ${deliveryAddress}
- Distancia: ${route.distance_km.toFixed(1)} km
- Tiempo estimado: ${route.duration_minutes} minutos
- Notas del restaurante: ${restaurantNotes ?? 'ninguna'}
Máximo 3 oraciones. Sé directo y útil.`,
        },
      ],
    })

    const block = message.content[0]
    return block.type === 'text' ? block.text : ''
  } catch {
    // Briefing is optional — never fail the route calculation because of it
    return ''
  }
}
