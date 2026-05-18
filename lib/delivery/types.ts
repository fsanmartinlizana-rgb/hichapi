/**
 * lib/delivery/types.ts
 *
 * TypeScript types, interfaces, and Zod schemas for the Rider Delivery Module.
 *
 * Storage bucket convention:
 *   Bucket name: rider-documents
 *   Path pattern: {rider_id}/{doc_type}.{ext}
 *   Doc types: national_id | license | insurance
 *   Access: private — only the rider (by user_id) and super_admin can read/write
 */

import { z } from 'zod'

// ── Type Aliases ──────────────────────────────────────────────────────────────

export type VehicleType = 'bicycle' | 'motorcycle' | 'car' | 'cargo_bike'

export type RiderStatus =
  | 'pending_verification'
  | 'available'
  | 'offline'
  | 'busy'
  | 'suspended'

export type DocumentStatus =
  | 'pending'
  | 'documents_submitted'
  | 'approved'
  | 'rejected'

export type DeliveryStatus =
  | 'pending_assignment'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'failed'

export type FailureReason =
  | 'customer_not_found'
  | 'address_incorrect'
  | 'refused_delivery'
  | 'vehicle_breakdown'
  | 'other'

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

// ── Rider Profile ─────────────────────────────────────────────────────────────

export interface RiderProfile {
  id: string
  user_id: string
  full_name: string
  phone: string
  national_id: string           // RUT — never exposed to restaurants
  profile_photo_url: string | null
  vehicle_type: VehicleType
  license_plate: string | null
  vehicle_model: string | null
  status: RiderStatus
  document_status: DocumentStatus
  doc_national_id_url: string | null
  doc_license_url: string | null
  doc_insurance_url: string | null
  avg_rating: number | null
  total_ratings: number
  created_at: string
  updated_at: string
}

/** Public view of a rider exposed to restaurants — no sensitive data */
export interface RiderPublicProfile {
  id: string
  full_name: string
  profile_photo_url: string | null
  vehicle_type: VehicleType
  vehicle_model: string | null
  status: RiderStatus
  avg_rating: number | null
  total_ratings: number
}

// ── Delivery Zone ─────────────────────────────────────────────────────────────

export interface DeliveryZone {
  id: string
  restaurant_id: string
  radius_km: number
  center_lat: number
  center_lng: number
  active: boolean
  created_at: string
}

// ── Delivery Fee Tier ─────────────────────────────────────────────────────────

export interface DeliveryFeeTier {
  id: string
  restaurant_id: string
  min_km: number
  max_km: number | null         // null = no upper limit
  fee_clp: number
  vehicle_types: VehicleType[]  // empty array = all vehicle types accepted
  created_at: string
}

// ── Delivery Order ────────────────────────────────────────────────────────────

export interface DeliveryOrder {
  id: string
  restaurant_id: string
  order_id: string | null       // nullable FK to existing orders table
  rider_id: string | null
  status: DeliveryStatus
  pickup_address: string
  delivery_address: string
  client_name: string
  client_phone: string
  total_clp: number
  delivery_fee_clp: number | null
  failure_reason: FailureReason | null
  planned_route: PlannedRoute | null
  actual_gps_track: GpsPoint[] | null
  picked_up_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

export interface PlannedRoute {
  polyline: string              // encoded polyline from Google Maps
  distance_km: number
  duration_minutes: number
  steps: RouteStep[]
  eta_pickup: string            // ISO timestamp
  eta_delivery: string          // ISO timestamp
  bike_friendly: boolean
  waypoints?: {
    origin:   { lat: number; lng: number }
    pickup:   { lat: number; lng: number }
    delivery: { lat: number; lng: number }
  }
}

export interface RouteStep {
  instruction: string
  distance_m: number
  duration_s: number
  maneuver: string | null
}

export interface GpsPoint {
  lat: number
  lng: number
  recorded_at: string
}

// ── Rider Location ────────────────────────────────────────────────────────────

export interface RiderLocation {
  id: string
  rider_id: string
  delivery_order_id: string | null
  lat: number
  lng: number
  recorded_at: string
}

// ── Rider Rating ──────────────────────────────────────────────────────────────

export interface RiderRating {
  id: string
  delivery_order_id: string
  rider_id: string
  restaurant_id: string
  rated_by: string
  stars: number
  comment: string | null
  created_at: string
}

// ── Heat Map ──────────────────────────────────────────────────────────────────

export interface HeatMapCell {
  cell_lat: number
  cell_lng: number
  order_count: number
  avg_fee_clp: number
}

export interface HeatMapFilters {
  days?: number
  time_of_day?: TimeOfDay
  day_of_week?: number          // 0 = Sunday
  restaurant_id?: string
}

// ── Marketplace ───────────────────────────────────────────────────────────────

export interface MarketplaceRestaurant {
  restaurant_id: string
  name: string
  cuisine_type: string | null
  neighborhood: string | null
  distance_km: number
  fee_range: { min: number; max: number }
  pending_orders_count: number
  delivery_zone: DeliveryZone
  fee_tiers: DeliveryFeeTier[]
  avg_delivery_minutes: number | null
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface DeliveryAnalytics {
  total_completed: number
  avg_delivery_minutes: number | null
  avg_rider_rating: number | null
  total_fees_paid_clp: number
  success_rate: number          // 0–1
  daily_volumes: DailyVolume[]
  status_breakdown: StatusBreakdown
  top_riders: TopRider[]
}

export interface DailyVolume {
  date: string                  // YYYY-MM-DD
  count: number
}

export interface StatusBreakdown {
  delivered: number
  failed: number
  cancelled: number
}

export interface TopRider {
  rider: RiderPublicProfile
  completed_count: number
}

// ── Zod Schemas ───────────────────────────────────────────────────────────────

export const CreateDeliveryOrderSchema = z.object({
  pickup_address:   z.string().min(5).max(300),
  delivery_address: z.string().min(5).max(300),
  client_name:      z.string().min(1).max(100),
  client_phone:     z.string().min(8).max(20),
  total_clp:        z.number().int().min(0),
  order_id:         z.string().uuid().optional(),
  notes:            z.string().max(500).optional(),
})

export const UpdateDeliveryOrderSchema = z.object({
  status: z
    .enum(['assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed'])
    .optional(),
  failure_reason: z
    .enum([
      'customer_not_found',
      'address_incorrect',
      'refused_delivery',
      'vehicle_breakdown',
      'other',
    ])
    .optional(),
}).refine(
  data => !(data.status === 'failed' && !data.failure_reason),
  { message: 'failure_reason es requerido cuando status es failed', path: ['failure_reason'] }
)

export const UpdateRiderStatusSchema = z.object({
  status: z.enum(['available', 'offline']),
})

export const UpdateRiderProfileSchema = z.object({
  full_name:     z.string().min(1).max(100).optional(),
  phone:         z.string().min(8).max(20).optional(),
  vehicle_type:  z.enum(['bicycle', 'motorcycle', 'car', 'cargo_bike']).optional(),
  license_plate: z.string().max(20).optional(),
  vehicle_model: z.string().max(100).optional(),
})

export const CreateRiderRatingSchema = z.object({
  delivery_order_id: z.string().uuid(),
  stars:             z.number().int().min(1).max(5),
  comment:           z.string().max(500).optional(),
})

export const DeliveryZoneSchema = z.object({
  radius_km:  z.number().min(1).max(50),
  center_lat: z.number().min(-90).max(90),
  center_lng: z.number().min(-180).max(180),
})

export const DeliveryFeeTierSchema = z.object({
  min_km:        z.number().min(0),
  max_km:        z.number().positive().nullable(),
  fee_clp:       z.number().int().min(0),
  vehicle_types: z.array(z.enum(['bicycle', 'motorcycle', 'car', 'cargo_bike'])),
})

export const AnalyticsQuerySchema = z.object({
  from: z.string().date(),
  to:   z.string().date(),
}).refine(
  data => {
    const diff = (new Date(data.to).getTime() - new Date(data.from).getTime()) / 86_400_000
    return diff >= 1 && diff <= 90
  },
  { message: 'El rango de fechas debe ser entre 1 y 90 días' }
)

// ── Inferred Types from Zod Schemas ──────────────────────────────────────────

export type CreateDeliveryOrderInput  = z.infer<typeof CreateDeliveryOrderSchema>
export type UpdateDeliveryOrderInput  = z.infer<typeof UpdateDeliveryOrderSchema>
export type UpdateRiderStatusInput    = z.infer<typeof UpdateRiderStatusSchema>
export type UpdateRiderProfileInput   = z.infer<typeof UpdateRiderProfileSchema>
export type CreateRiderRatingInput    = z.infer<typeof CreateRiderRatingSchema>
export type DeliveryZoneInput         = z.infer<typeof DeliveryZoneSchema>
export type DeliveryFeeTierInput      = z.infer<typeof DeliveryFeeTierSchema>
export type AnalyticsQueryInput       = z.infer<typeof AnalyticsQuerySchema>
