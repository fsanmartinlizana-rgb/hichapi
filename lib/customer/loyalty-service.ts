/**
 * lib/customer/loyalty-service.ts
 *
 * LoyaltyService — acumulación y canje de puntos de fidelidad del comensal.
 *
 * Requirements: 5.1, 5.2, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11
 */
import { createAdminClient } from '@/lib/supabase/server'
import type { LoyaltyTransaction, LoyaltyRedemption, OrderType } from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum points required to initiate a redemption (Requirement 5.6, 5.7) */
const MIN_REDEMPTION_POINTS = 500

// ── Pure calculation helpers ──────────────────────────────────────────────────

/**
 * Calculates the loyalty points earned for a given order total and multiplier.
 *
 * Formula: floor(total_clp / 100) * multiplier
 *
 * Requirements: 5.2
 *
 * @param total_clp   Order total in Chilean Pesos (must be >= 0)
 * @param multiplier  Restaurant points multiplier (typically 0.5–5.0, defaults to 1.0)
 * @returns           Non-negative integer representing points earned
 */
export function calculatePoints(total_clp: number, multiplier: number): number {
  if (total_clp < 0) return 0
  return Math.floor(total_clp / 100) * multiplier
}

/**
 * Calculates the CLP discount for a given number of points to redeem.
 *
 * Formula: floor(points / 100) * 100
 *
 * Requirements: 5.7
 *
 * @param points  Points to redeem (must be >= MIN_REDEMPTION_POINTS)
 * @returns       Discount amount in CLP
 */
export function calculateRedemptionDiscount(points: number): number {
  return Math.floor(points / 100) * 100
}

// ── Service methods ───────────────────────────────────────────────────────────

/**
 * Adds loyalty points to a customer's balance after a completed order.
 *
 * Steps:
 * 1. Fetches the restaurant's points_multiplier (defaults to 1.0 if not set).
 * 2. Calculates points using calculatePoints().
 * 3. Atomically increments loyalty_points in customer_profiles.
 * 4. Inserts a record in loyalty_transactions.
 *
 * Requirements: 5.1, 5.2, 5.11
 *
 * @param customer_id   UUID of the customer profile
 * @param order_id      UUID of the completed order
 * @param order_type    'delivery' | 'presencial'
 * @param total_clp     Order total in CLP
 * @param restaurant_id UUID of the restaurant (used to fetch multiplier)
 * @returns             The created LoyaltyTransaction record
 */
export async function earnPoints(
  customer_id: string,
  order_id: string,
  order_type: OrderType,
  total_clp: number,
  restaurant_id: string,
): Promise<LoyaltyTransaction> {
  const supabase = createAdminClient()

  // 1. Fetch restaurant multiplier
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('points_multiplier')
    .eq('id', restaurant_id)
    .maybeSingle()

  const multiplier: number = restaurant?.points_multiplier ?? 1.0

  // 2. Calculate points to earn
  const pointsEarned = calculatePoints(total_clp, multiplier)

  // 3. Atomically update loyalty_points.
  //    We fetch the current balance, compute the new value, and update using
  //    an optimistic-lock guard (.eq('loyalty_points', currentBalance)) so that
  //    concurrent modifications are detected. The DB CHECK (loyalty_points >= 0)
  //    acts as an additional safety net (Requirement 5.11).
  const { data: currentProfile, error: fetchError } = await supabase
    .from('customer_profiles')
    .select('loyalty_points')
    .eq('id', customer_id)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!currentProfile) throw new Error('Perfil de comensal no encontrado')

  const currentBalance: number = currentProfile.loyalty_points
  const newBalance = currentBalance + pointsEarned

  const { error: balanceError, count } = await supabase
    .from('customer_profiles')
    .update({
      loyalty_points: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customer_id)
    // Optimistic lock: only update if balance hasn't changed since we read it
    .eq('loyalty_points', currentBalance)
    .select('id', { count: 'exact', head: true })

  if (balanceError) throw new Error(balanceError.message)

  // If count is 0, a concurrent modification occurred — retry by re-reading
  if ((count ?? 0) === 0) {
    // Re-fetch and apply the increment (single retry)
    const { data: retryProfile, error: retryFetchError } = await supabase
      .from('customer_profiles')
      .select('loyalty_points')
      .eq('id', customer_id)
      .maybeSingle()

    if (retryFetchError) throw new Error(retryFetchError.message)
    if (!retryProfile) throw new Error('Perfil de comensal no encontrado')

    const retryNewBalance = retryProfile.loyalty_points + pointsEarned

    const { error: retryUpdateError } = await supabase
      .from('customer_profiles')
      .update({
        loyalty_points: retryNewBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer_id)

    if (retryUpdateError) throw new Error(retryUpdateError.message)

    // Use the retry balance for the transaction record
    const retryDescription = `Puntos ganados por pedido ${order_type} — $${total_clp.toLocaleString('es-CL')} CLP`
    const { data: retryTransaction, error: retryTxError } = await supabase
      .from('loyalty_transactions')
      .insert({
        customer_id,
        order_id,
        order_type,
        points_delta:  pointsEarned,
        balance_after: retryNewBalance,
        description:   retryDescription,
      })
      .select()
      .single()

    if (retryTxError) throw new Error(retryTxError.message)
    return retryTransaction as LoyaltyTransaction
  }

  // 4. Insert loyalty transaction record
  const description = `Puntos ganados por pedido ${order_type} — $${total_clp.toLocaleString('es-CL')} CLP`

  const { data: transaction, error: txError } = await supabase
    .from('loyalty_transactions')
    .insert({
      customer_id,
      order_id,
      order_type,
      points_delta:  pointsEarned,
      balance_after: newBalance,
      description,
    })
    .select()
    .single()

  if (txError) throw new Error(txError.message)
  return transaction as LoyaltyTransaction
}

/**
 * Redeems loyalty points for a discount on an order.
 *
 * Validations:
 * - points_to_redeem must be >= 500 (MIN_REDEMPTION_POINTS)
 * - customer must have sufficient balance
 *
 * Steps:
 * 1. Validates minimum redemption amount.
 * 2. Fetches current balance and validates sufficiency.
 * 3. Atomically deducts points from customer_profiles (never below 0).
 * 4. Inserts records in loyalty_redemptions and loyalty_transactions.
 *
 * Requirements: 5.6, 5.7, 5.8, 5.9, 5.11
 *
 * @param customer_id      UUID of the customer profile
 * @param points_to_redeem Number of points to redeem (>= 500)
 * @param order_id         Optional UUID of the order this redemption applies to
 * @returns                The created LoyaltyRedemption record
 */
export async function redeemPoints(
  customer_id: string,
  points_to_redeem: number,
  order_id?: string,
): Promise<LoyaltyRedemption> {
  const supabase = createAdminClient()

  // 1. Validate minimum redemption
  if (points_to_redeem < MIN_REDEMPTION_POINTS) {
    throw new Error(`El mínimo de canje es ${MIN_REDEMPTION_POINTS} puntos`)
  }

  // 2. Fetch current balance
  const { data: profile, error: profileError } = await supabase
    .from('customer_profiles')
    .select('loyalty_points')
    .eq('id', customer_id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile) throw new Error('Perfil de comensal no encontrado')

  const currentBalance: number = profile.loyalty_points

  // 3. Validate sufficient balance
  if (currentBalance < points_to_redeem) {
    throw new Error(`Puntos insuficientes. Balance actual: ${currentBalance}`)
  }

  // 4. Calculate discount and new balance
  const discount_clp = calculateRedemptionDiscount(points_to_redeem)
  const newBalance = currentBalance - points_to_redeem

  // Safety guard: balance must never go below 0 (Requirement 5.11)
  if (newBalance < 0) {
    throw new Error('La operación resultaría en un balance negativo')
  }

  // 5. Atomically deduct points from customer_profiles
  const { error: updateError } = await supabase
    .from('customer_profiles')
    .update({
      loyalty_points: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customer_id)
    // Atomic guard: only update if balance is still sufficient
    .gte('loyalty_points', points_to_redeem)

  if (updateError) throw new Error(updateError.message)

  // Verify the update actually happened (concurrent modification guard)
  const { data: verifiedProfile } = await supabase
    .from('customer_profiles')
    .select('loyalty_points')
    .eq('id', customer_id)
    .maybeSingle()

  if (!verifiedProfile || verifiedProfile.loyalty_points !== newBalance) {
    throw new Error('Error de concurrencia al canjear puntos. Intente nuevamente.')
  }

  // 6. Insert loyalty_redemptions record
  const { data: redemption, error: redemptionError } = await supabase
    .from('loyalty_redemptions')
    .insert({
      customer_id,
      order_id:        order_id ?? null,
      points_redeemed: points_to_redeem,
      discount_clp,
    })
    .select()
    .single()

  if (redemptionError) throw new Error(redemptionError.message)

  // 7. Insert loyalty_transactions record (negative delta for redemption)
  const description = `Canje de ${points_to_redeem} puntos — descuento $${discount_clp.toLocaleString('es-CL')} CLP`

  const { error: txError } = await supabase
    .from('loyalty_transactions')
    .insert({
      customer_id,
      order_id:      order_id ?? null,
      order_type:    null,
      points_delta:  -points_to_redeem,
      balance_after: newBalance,
      description,
    })

  if (txError) throw new Error(txError.message)

  return redemption as LoyaltyRedemption
}

/**
 * Returns the current loyalty points balance for a customer.
 *
 * Requirements: 5.4, 5.5
 *
 * @param customer_id UUID of the customer profile
 * @returns           Current loyalty_points balance (integer >= 0)
 */
export async function getBalance(customer_id: string): Promise<number> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('customer_profiles')
    .select('loyalty_points')
    .eq('id', customer_id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Perfil de comensal no encontrado')

  return data.loyalty_points as number
}

/**
 * Returns the loyalty transaction history for a customer, ordered by date descending.
 *
 * Requirements: 5.5, 5.10
 *
 * @param customer_id UUID of the customer profile
 * @returns           Array of LoyaltyTransaction records
 */
export async function getTransactions(customer_id: string): Promise<LoyaltyTransaction[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('customer_id', customer_id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as LoyaltyTransaction[]
}
