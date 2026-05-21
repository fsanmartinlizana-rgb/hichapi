/**
 * Types for the authenticated customer (comensal) module — mirrors web API.
 */

export type CustomerOrderType = 'delivery' | 'presencial'

export interface CustomerProfile {
  id: string
  user_id: string
  display_name: string
  phone: string | null
  photo_url: string | null
  loyalty_points: number
  push_token: string | null
  created_at: string
  updated_at: string
}

export interface SavedAddress {
  id: string
  customer_id: string
  label: string
  street: string
  city: string
  notes: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface OrderItem {
  name: string
  quantity: number
  unit_price: number
}

export interface UnifiedOrder {
  id: string
  order_type: CustomerOrderType
  restaurant_id: string
  restaurant_name: string
  status: string
  total_clp: number
  created_at: string
  items?: OrderItem[]
  delivery_address?: string
  notes?: string
  rider_id?: string | null
}

export interface LoyaltyTransaction {
  id: string
  customer_id: string
  order_id: string | null
  order_type: CustomerOrderType | null
  points_delta: number
  balance_after: number
  description: string
  created_at: string
}

export interface TrackingData {
  delivery_order_id: string
  status: string
  rider: {
    id: string
    first_name: string
    profile_photo_url: string | null
  } | null
  last_location: {
    lat: number
    lng: number
    recorded_at: string
  } | null
  delivery_address: string
  delivered_at: string | null
}

export interface CustomerRating {
  id: string
  order_id: string
  entity_type: 'rider' | 'restaurant'
  stars: number
}
