/**
 * Customer API client — /api/customer/* endpoints (Bearer auth via apiClient).
 */
import { apiClient } from '../api/APIClient'
import type {
  CustomerProfile,
  SavedAddress,
  UnifiedOrder,
  LoyaltyTransaction,
  TrackingData,
  CustomerRating,
  CustomerOrderType,
} from '../../types/customer'

export async function getCustomerProfile(): Promise<CustomerProfile> {
  return apiClient.get<CustomerProfile>('/api/customer/profile')
}

export async function updateCustomerProfile(input: {
  display_name?: string
  phone?: string
  photo_url?: string
}): Promise<CustomerProfile> {
  return apiClient.patch<CustomerProfile>('/api/customer/profile', input)
}

export async function listAddresses(): Promise<SavedAddress[]> {
  return apiClient.get<SavedAddress[]>('/api/customer/addresses')
}

export async function createAddress(input: {
  label: string
  street: string
  city: string
  notes?: string
  is_default?: boolean
}): Promise<SavedAddress> {
  return apiClient.post<SavedAddress>('/api/customer/addresses', input)
}

export async function updateAddress(
  id: string,
  input: Partial<{
    label: string
    street: string
    city: string
    notes: string
    is_default: boolean
  }>,
): Promise<SavedAddress> {
  return apiClient.patch<SavedAddress>(`/api/customer/addresses/${id}`, input)
}

export async function deleteAddress(id: string): Promise<void> {
  await apiClient.delete(`/api/customer/addresses/${id}`)
}

export async function listOrders(params: {
  type?: 'all' | CustomerOrderType
  from?: string
  to?: string
  page?: number
  page_size?: number
}): Promise<{ orders: UnifiedOrder[]; total: number }> {
  return apiClient.get('/api/customer/orders', params as Record<string, unknown>)
}

export async function getOrder(id: string): Promise<UnifiedOrder> {
  return apiClient.get<UnifiedOrder>(`/api/customer/orders/${id}`)
}

export async function getLoyalty(): Promise<{
  balance: number
  transactions: LoyaltyTransaction[]
}> {
  return apiClient.get('/api/customer/loyalty')
}

export async function redeemPoints(points_to_redeem: number, order_id?: string) {
  return apiClient.post<{ discount_clp: number; points_redeemed: number }>(
    '/api/customer/loyalty/redeem',
    { points_to_redeem, order_id },
  )
}

export async function getTracking(deliveryOrderId: string): Promise<TrackingData> {
  return apiClient.get<TrackingData>(`/api/customer/tracking/${deliveryOrderId}`)
}

export async function listRatings(): Promise<CustomerRating[]> {
  return apiClient.get<CustomerRating[]>('/api/customer/ratings')
}

export async function submitRating(input: {
  entity_type: 'rider' | 'restaurant'
  entity_id: string
  order_id: string
  order_type: CustomerOrderType
  stars: number
  comment?: string
}) {
  return apiClient.post('/api/customer/ratings', input)
}

export async function registerPushToken(push_token: string): Promise<void> {
  await apiClient.post('/api/customer/push-token', { push_token })
}

export async function clearPushToken(): Promise<void> {
  await apiClient.delete('/api/customer/push-token')
}

export async function deleteAccount(password: string): Promise<void> {
  await apiClient.delete('/api/customer/account', { password })
}

export async function checkGeofence(lat: number, lng: number) {
  return apiClient.post<{
    eligible: Array<{ restaurant_id: string; restaurant_name: string; geofence_message: string | null }>
    skipped: Array<{ restaurant_id: string; reason: string }>
  }>('/api/customer/geofence/check', { lat, lng })
}
