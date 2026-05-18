/**
 * lib/delivery/geolocation.service.ts
 *
 * GeolocationService — GPS recording, offline validation, latest position.
 * Requirements: 3.7, 10.7
 */
import { createAdminClient } from '@/lib/supabase/server'
import type { RiderLocation } from './types'

// ── Validation ────────────────────────────────────────────────────────────────

export function validateCoordinates(lat: number, lng: number): void {
  if (lat < -90 || lat > 90) {
    throw new Error(`Latitud inválida: ${lat}. Debe estar entre -90 y 90.`)
  }
  if (lng < -180 || lng > 180) {
    throw new Error(`Longitud inválida: ${lng}. Debe estar entre -180 y 180.`)
  }
}

// ── GPS recording ─────────────────────────────────────────────────────────────

export async function recordRiderLocation(
  riderId: string,
  deliveryOrderId: string,
  lat: number,
  lng: number,
): Promise<void> {
  // Validate coordinate ranges first
  validateCoordinates(lat, lng)

  const supabase = createAdminClient()

  // Validate rider is not offline
  const { data: rider } = await supabase
    .from('rider_profiles')
    .select('status')
    .eq('id', riderId)
    .maybeSingle()

  if (!rider) throw new Error('Rider no encontrado')
  if (rider.status === 'offline') {
    throw new Error('No se puede registrar GPS: rider offline')
  }

  const { error } = await supabase.from('rider_locations').insert({
    rider_id:          riderId,
    delivery_order_id: deliveryOrderId,
    lat,
    lng,
  })

  if (error) throw new Error(error.message)
  // Supabase Realtime propagates the INSERT automatically to subscribed channels
}

// ── Latest position ───────────────────────────────────────────────────────────

export async function getLatestRiderLocation(
  riderId: string,
): Promise<RiderLocation | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('rider_locations')
    .select('*')
    .eq('rider_id', riderId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as RiderLocation | null
}

// ── Location history for an order ─────────────────────────────────────────────

export async function getOrderLocationHistory(
  deliveryOrderId: string,
): Promise<RiderLocation[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('rider_locations')
    .select('*')
    .eq('delivery_order_id', deliveryOrderId)
    .order('recorded_at', { ascending: true })

  return (data ?? []) as RiderLocation[]
}
