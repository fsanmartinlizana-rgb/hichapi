/**
 * services/rider/api.ts
 *
 * Typed HTTP client for all /api/delivery/* endpoints.
 * Uses Bearer token auth (rider JWT from Supabase Auth).
 * Requirements: 8.5, 10.9
 */
import type {
  RiderProfile,
  DeliveryOrder,
  MarketplaceRestaurant,
  RiderRating,
  HeatMapCell,
  HeatMapFilters,
  DeliveryAnalytics,
  UpdateRiderProfileInput,
  CreateRiderProfileInput,
  CreateRiderRatingInput,
  VehicleType,
} from '../../../lib/delivery/types'

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''

async function request<T>(
  path: string,
  options: RequestInit & { token: string },
): Promise<T> {
  const { token, ...rest } = options
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(rest.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ── Rider profile ─────────────────────────────────────────────────────────────

export async function getRiderProfile(token: string): Promise<RiderProfile> {
  return request<RiderProfile>('/api/delivery/rider/profile', { method: 'GET', token })
}

export async function createRiderProfile(
  token: string,
  input: CreateRiderProfileInput,
): Promise<RiderProfile> {
  return request<RiderProfile>('/api/delivery/rider/profile', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  })
}

export async function updateRiderProfile(
  token: string,
  input: UpdateRiderProfileInput,
): Promise<RiderProfile> {
  return request<RiderProfile>('/api/delivery/rider/profile', {
    method: 'PATCH',
    token,
    body: JSON.stringify(input),
  })
}

export async function getRiderStatus(token: string): Promise<{ status: string }> {
  return request<{ status: string }>('/api/delivery/rider/status', { method: 'GET', token })
}

export async function updateRiderStatus(
  token: string,
  status: 'available' | 'offline',
): Promise<{ status: string }> {
  return request<{ status: string }>('/api/delivery/rider/status', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  })
}

export async function setDocumentUrl(
  token: string,
  docType: 'national_id' | 'license' | 'insurance' | 'permit' | 'inspection' | 'driver_record',
  url: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/api/delivery/rider/profile/documents', {
    method: 'POST',
    token,
    body: JSON.stringify({ doc_type: docType, url }),
  })
}

// ── GPS location ──────────────────────────────────────────────────────────────

export async function postRiderLocation(
  token: string,
  deliveryOrderId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await request<{ ok: boolean }>('/api/delivery/rider/location', {
    method: 'POST',
    token,
    body: JSON.stringify({ delivery_order_id: deliveryOrderId, lat, lng }),
  })
}

// ── Marketplace ───────────────────────────────────────────────────────────────

export async function getMarketplace(
  token: string,
  lat: number | null,
  lng: number | null,
  filters?: { vehicle_type?: VehicleType; min_fee?: number },
): Promise<MarketplaceRestaurant[]> {
  const params = new URLSearchParams()
  if (lat !== null) params.set('lat', String(lat))
  if (lng !== null) params.set('lng', String(lng))
  if (filters?.vehicle_type) params.set('vehicle_type', filters.vehicle_type)
  if (filters?.min_fee !== undefined) params.set('min_fee', String(filters.min_fee))
  const qs = params.toString()
  return request<MarketplaceRestaurant[]>(`/api/delivery/marketplace${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
  })
}

export async function assignOrder(token: string, restaurantId: string): Promise<DeliveryOrder> {
  return request<DeliveryOrder>('/api/delivery/marketplace/assign', {
    method: 'POST',
    token,
    body: JSON.stringify({ restaurant_id: restaurantId })
  })
}

export interface PendingOrderPreview {
  id: string
  client_name: string
  client_phone: string
  pickup_address: string
  delivery_address: string
  total_clp: number
  created_at: string
}

export async function getRestaurantPendingOrders(
  token: string,
  restaurantId: string,
): Promise<PendingOrderPreview[]> {
  return request<PendingOrderPreview[]>(
    `/api/delivery/marketplace/orders?restaurant_id=${restaurantId}`,
    { method: 'GET', token },
  )
}

export async function assignSpecificOrder(token: string, orderId: string): Promise<DeliveryOrder> {
  return request<DeliveryOrder>(`/api/delivery/orders/${orderId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status: 'assigned' }),
  })
}

// ── Delivery orders ───────────────────────────────────────────────────────────

export async function getDeliveryOrders(
  token: string,
  status?: string,
): Promise<DeliveryOrder[]> {
  const qs = status ? `?status=${status}` : ''
  return request<DeliveryOrder[]>(`/api/delivery/orders${qs}`, { method: 'GET', token })
}

export async function updateDeliveryOrderStatus(
  token: string,
  orderId: string,
  status: string,
  failureReason?: string,
): Promise<DeliveryOrder> {
  return request<DeliveryOrder>(`/api/delivery/orders/${orderId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status, ...(failureReason && { failure_reason: failureReason }) }),
  })
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function calculateRoute(
  token: string,
  origin: { lat: number; lng: number },
  pickup: string,
  delivery: string,
  vehicleType: VehicleType,
  withBriefing = false,
) {
  return request<{
    route: import('../../../lib/delivery/types').PlannedRoute | null
    fallback: boolean
    briefing?: string
    fallback_map_link?: string
  }>('/api/delivery/routes', {
    method: 'POST',
    token,
    body: JSON.stringify({ origin, pickup, delivery, vehicle_type: vehicleType, with_briefing: withBriefing }),
  })
}

// ── Heat map ──────────────────────────────────────────────────────────────────

export async function getHeatMap(
  token: string,
  filters?: HeatMapFilters,
): Promise<HeatMapCell[]> {
  const params = new URLSearchParams()
  if (filters?.days) params.set('days', String(filters.days))
  if (filters?.time_of_day) params.set('time_of_day', filters.time_of_day)
  if (filters?.day_of_week !== undefined) params.set('day_of_week', String(filters.day_of_week))
  const qs = params.toString()
  return request<HeatMapCell[]>(`/api/delivery/heatmap${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
  })
}

// ── Ratings ───────────────────────────────────────────────────────────────────

export async function submitRating(
  token: string,
  input: CreateRiderRatingInput,
): Promise<RiderRating> {
  return request<RiderRating>('/api/delivery/ratings', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  })
}

// ── Push token ────────────────────────────────────────────────────────────────

/**
 * Registers or updates the Expo push token for the authenticated rider.
 * Call this after the rider logs in and push permissions are granted.
 */
export async function syncPushToken(
  bearerToken: string,
  expoPushToken: string,
): Promise<void> {
  await request<{ ok: boolean }>('/api/delivery/rider/push-token', {
    method: 'PATCH',
    token:  bearerToken,
    body:   JSON.stringify({ token: expoPushToken }),
  })
}

/**
 * Removes the Expo push token from the backend (call on logout).
 */
export async function deletePushToken(bearerToken: string): Promise<void> {
  await request<{ ok: boolean }>('/api/delivery/rider/push-token', {
    method: 'DELETE',
    token:  bearerToken,
  })
}
