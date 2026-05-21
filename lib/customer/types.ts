// lib/customer/types.ts
// TypeScript interfaces and types for the Usuario Comensal module

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

export type RatingEntityType = 'rider' | 'restaurant'
export type OrderType = 'delivery' | 'presencial'

export interface CustomerRating {
  id: string
  customer_id: string
  entity_type: RatingEntityType
  entity_id: string
  order_id: string
  order_type: OrderType
  stars: number
  comment: string | null
  created_at: string
}

export interface LoyaltyTransaction {
  id: string
  customer_id: string
  order_id: string | null
  order_type: OrderType | null
  points_delta: number
  balance_after: number
  description: string
  created_at: string
}

export interface LoyaltyRedemption {
  id: string
  customer_id: string
  order_id: string | null
  points_redeemed: number
  discount_clp: number
  created_at: string
}

export interface GeofenceEvent {
  id: string
  customer_id: string
  restaurant_id: string
  entered_at: string
  notification_sent: boolean
}

export interface OrderItem {
  name: string
  quantity: number
  unit_price: number
}

export interface UnifiedOrder {
  id: string
  order_type: OrderType
  restaurant_id: string
  restaurant_name: string
  status: string
  total_clp: number
  created_at: string
  items?: OrderItem[]
  delivery_address?: string
  notes?: string
  /** Solo pedidos delivery — para calificar al rider */
  rider_id?: string | null
}
