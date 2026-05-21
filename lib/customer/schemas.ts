// lib/customer/schemas.ts
// Zod v4 validation schemas for the Usuario Comensal module.
// Requirements: 9.7

import { z } from 'zod'

// ── Profile ───────────────────────────────────────────────────────────────────

export const UpdateCustomerProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  phone:        z.string().min(8).max(20).optional(),
  photo_url:    z.string().url().optional(),
})

// ── Saved Addresses ───────────────────────────────────────────────────────────

export const CreateSavedAddressSchema = z.object({
  label:      z.string().min(1).max(50),
  street:     z.string().min(5).max(300),
  city:       z.string().min(1).max(100),
  notes:      z.string().max(300).optional(),
  is_default: z.boolean().optional().default(false),
})

export const UpdateSavedAddressSchema = CreateSavedAddressSchema.partial()

// ── Ratings ───────────────────────────────────────────────────────────────────

export const CreateCustomerRatingSchema = z.object({
  entity_type: z.enum(['rider', 'restaurant']),
  entity_id:   z.string().uuid(),
  order_id:    z.string().uuid(),
  order_type:  z.enum(['delivery', 'presencial']),
  stars:       z.number().int().min(1).max(5),
  comment:     z.string().max(500).optional(),
})

// ── Loyalty ───────────────────────────────────────────────────────────────────

export const RedeemLoyaltyPointsSchema = z.object({
  points_to_redeem: z.number().int().min(500),
  order_id:         z.string().uuid().optional(),
})

// ── Push Notifications ────────────────────────────────────────────────────────

export const RegisterPushTokenSchema = z.object({
  push_token: z.string().min(1).max(500),
})

export const DeleteCustomerAccountSchema = z.object({
  password: z.string().min(1),
})

// ── Order History Query ───────────────────────────────────────────────────────

export const OrderHistoryQuerySchema = z.object({
  type:      z.enum(['delivery', 'presencial', 'all']).optional().default('all'),
  from:      z.string().date().optional(),
  to:        z.string().date().optional(),
  page:      z.coerce.number().int().min(1).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(50).optional().default(20),
})

// ── Geofence Configuration ────────────────────────────────────────────────────

export const GeofenceConfigSchema = z.object({
  geofence_enabled:  z.boolean(),
  geofence_radius_m: z.number().int().min(100).max(2000).optional(),
  geofence_message:  z.string().max(140).optional(),
  points_multiplier: z.number().min(0.5).max(5.0).optional(),
})

// ── Inferred Types ────────────────────────────────────────────────────────────

export type UpdateCustomerProfileInput  = z.infer<typeof UpdateCustomerProfileSchema>
export type CreateSavedAddressInput     = z.infer<typeof CreateSavedAddressSchema>
export type UpdateSavedAddressInput     = z.infer<typeof UpdateSavedAddressSchema>
export type CreateCustomerRatingInput   = z.infer<typeof CreateCustomerRatingSchema>
export type RedeemLoyaltyPointsInput    = z.infer<typeof RedeemLoyaltyPointsSchema>
export type RegisterPushTokenInput      = z.infer<typeof RegisterPushTokenSchema>
export type DeleteCustomerAccountInput  = z.infer<typeof DeleteCustomerAccountSchema>
export type OrderHistoryQueryInput      = z.infer<typeof OrderHistoryQuerySchema>
export type GeofenceConfigInput         = z.infer<typeof GeofenceConfigSchema>
