/**
 * lib/customer/rating-service.ts
 *
 * RatingService — envío y consulta de calificaciones del comensal.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.10
 */
import { createAdminClient } from '@/lib/supabase/server'
import type { CustomerRating, RatingEntityType } from './types'
import type { CreateCustomerRatingInput } from './schemas'

// ── Submit Rating ─────────────────────────────────────────────────────────────

/**
 * Submits a new Customer_Rating for a Rider or Restaurant.
 *
 * Validations:
 * - Uniqueness: only one rating per (customer_id, order_id, entity_type) is allowed.
 *   Returns an error with code 409 if a duplicate is detected (Requirement 4.7).
 *
 * Steps:
 * 1. Check for an existing rating with the same (customer_id, order_id, entity_type).
 * 2. Insert the new rating into `customer_ratings`.
 * 3. Return the created CustomerRating record.
 *
 * The DB trigger `trg_update_rider_avg_from_customer` automatically updates
 * `rider_profiles.avg_rating` when entity_type = 'rider' (Requirement 4.6 / 9.6).
 *
 * @param customer_id  UUID of the customer profile submitting the rating
 * @param payload      Validated rating payload (entity_type, entity_id, order_id, order_type, stars, comment)
 * @returns            The created CustomerRating record
 * @throws             Error with code 409 if a duplicate rating exists
 * @throws             Error with code 404 if the customer profile is not found
 */
export async function submitRating(
  customer_id: string,
  payload: CreateCustomerRatingInput,
): Promise<CustomerRating> {
  const supabase = createAdminClient()

  // 1. Check uniqueness: (customer_id, order_id, entity_type)
  const { data: existing, error: checkError } = await supabase
    .from('customer_ratings')
    .select('id')
    .eq('customer_id', customer_id)
    .eq('order_id', payload.order_id)
    .eq('entity_type', payload.entity_type)
    .maybeSingle()

  if (checkError) throw new Error(checkError.message)

  if (existing) {
    const err = new Error('Ya existe una calificación para este pedido y entidad') as Error & { code: number }
    err.code = 409
    throw err
  }

  // 2. Insert the new rating
  const { data, error } = await supabase
    .from('customer_ratings')
    .insert({
      customer_id,
      entity_type: payload.entity_type,
      entity_id:   payload.entity_id,
      order_id:    payload.order_id,
      order_type:  payload.order_type,
      stars:       payload.stars,
      comment:     payload.comment ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CustomerRating
}

// ── Get Ratings by Customer ───────────────────────────────────────────────────

/**
 * Returns all Customer_Ratings submitted by a given customer, ordered by date descending.
 *
 * Requirements: 4.10
 *
 * @param customer_id UUID of the customer profile
 * @returns           Array of CustomerRating records ordered by created_at DESC
 */
export async function getRatingsByCustomer(customer_id: string): Promise<CustomerRating[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('customer_ratings')
    .select('*')
    .eq('customer_id', customer_id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as CustomerRating[]
}

// ── Get Ratings by Entity ─────────────────────────────────────────────────────

/**
 * Returns all Customer_Ratings for a given entity (Rider or Restaurant),
 * ordered by date descending.
 *
 * Used by the Restaurant_Panel to display customer ratings (Requirement 4.8)
 * and by the Rider_App to display customer ratings on the rider's profile (Requirement 4.9).
 *
 * @param entity_type  'rider' | 'restaurant'
 * @param entity_id    UUID of the rated entity (rider_profiles.id or restaurants.id)
 * @returns            Array of CustomerRating records ordered by created_at DESC
 */
export async function getRatingsByEntity(
  entity_type: RatingEntityType,
  entity_id: string,
): Promise<CustomerRating[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('customer_ratings')
    .select('*')
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as CustomerRating[]
}
