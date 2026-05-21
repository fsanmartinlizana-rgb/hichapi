/**
 * lib/customer/customer-service.ts
 *
 * CustomerService — profile CRUD, saved addresses, account deletion (anonymization).
 * Requirements: 1.5, 1.8, 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 10.7
 */
import { createAdminClient } from '@/lib/supabase/server'
import type { CustomerProfile, SavedAddress } from './types'
import type {
  UpdateCustomerProfileInput,
  CreateSavedAddressInput,
  UpdateSavedAddressInput,
  RegisterPushTokenInput,
} from './schemas'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ADDRESSES = 10

// ── Profile ───────────────────────────────────────────────────────────────────

/**
 * Returns the customer profile for the given customer_id.
 * Returns null if not found.
 */
export async function getProfile(customerId: string): Promise<CustomerProfile | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('id', customerId)
    .maybeSingle()
  return data as CustomerProfile | null
}

/**
 * Returns the customer profile for the given user_id (auth.users.id).
 * Returns null if not found.
 */
export async function getProfileByUserId(userId: string): Promise<CustomerProfile | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as CustomerProfile | null
}

/**
 * Updates the customer profile fields: display_name, phone, photo_url.
 * Throws if the profile is not found or the update fails.
 */
export async function updateProfile(
  customerId: string,
  input: UpdateCustomerProfileInput,
): Promise<CustomerProfile> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('customer_profiles')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', customerId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CustomerProfile
}

// ── Saved Addresses ───────────────────────────────────────────────────────────

/**
 * Returns all saved addresses for the given customer, ordered by creation date.
 */
export async function listAddresses(customerId: string): Promise<SavedAddress[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('saved_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as SavedAddress[]
}

/**
 * Creates a new saved address for the customer.
 * Enforces the 10-address limit.
 * If is_default is true, unsets the previous default address first.
 * Throws with a descriptive message if the limit is reached.
 */
export async function createAddress(
  customerId: string,
  input: CreateSavedAddressInput,
): Promise<SavedAddress> {
  const supabase = createAdminClient()

  // Enforce address limit
  const { count, error: countError } = await supabase
    .from('saved_addresses')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)

  if (countError) throw new Error(countError.message)
  if ((count ?? 0) >= MAX_ADDRESSES) {
    throw new Error('Límite de direcciones alcanzado (máximo 10)')
  }

  // If this address is default, unset the previous default
  if (input.is_default) {
    await supabase
      .from('saved_addresses')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .eq('is_default', true)
  }

  const { data, error } = await supabase
    .from('saved_addresses')
    .insert({
      customer_id: customerId,
      label:       input.label,
      street:      input.street,
      city:        input.city,
      notes:       input.notes ?? null,
      is_default:  input.is_default ?? false,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as SavedAddress
}

/**
 * Updates an existing saved address.
 * If is_default is set to true, unsets the previous default address first.
 * Throws if the address is not found or does not belong to the customer.
 */
export async function updateAddress(
  customerId: string,
  addressId: string,
  input: UpdateSavedAddressInput,
): Promise<SavedAddress> {
  const supabase = createAdminClient()

  // Verify ownership
  const { data: existing } = await supabase
    .from('saved_addresses')
    .select('id')
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (!existing) throw new Error('Dirección no encontrada')

  // If setting as default, unset the previous default
  if (input.is_default === true) {
    await supabase
      .from('saved_addresses')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .eq('is_default', true)
      .neq('id', addressId)
  }

  const { data, error } = await supabase
    .from('saved_addresses')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as SavedAddress
}

/**
 * Deletes a saved address.
 * Throws if the address is not found or does not belong to the customer.
 */
export async function deleteAddress(customerId: string, addressId: string): Promise<void> {
  const supabase = createAdminClient()

  // Verify ownership before deleting
  const { data: existing } = await supabase
    .from('saved_addresses')
    .select('id')
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (!existing) throw new Error('Dirección no encontrada')

  const { error } = await supabase
    .from('saved_addresses')
    .delete()
    .eq('id', addressId)
    .eq('customer_id', customerId)

  if (error) throw new Error(error.message)
}

// ── Push Token ────────────────────────────────────────────────────────────────

/**
 * Updates the Expo/push notification token for a customer profile.
 * Requirement 8.1
 */
export async function updatePushToken(
  customerId: string,
  input: RegisterPushTokenInput,
): Promise<CustomerProfile> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('customer_profiles')
    .update({
      push_token: input.push_token,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CustomerProfile
}

/** Elimina el push token del perfil (desactivar notificaciones). */
export async function clearPushToken(customerId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('customer_profiles')
    .update({ push_token: null, updated_at: new Date().toISOString() })
    .eq('id', customerId)

  if (error) throw new Error(error.message)
}

// ── Account Deletion (Anonymization) ─────────────────────────────────────────

/**
 * Deletes a customer account following the anonymization policy (Requirement 10.7):
 *
 * 1. Sets customer_id = NULL in: orders, delivery_orders, customer_ratings,
 *    loyalty_transactions, loyalty_redemptions
 * 2. Deletes all records in: saved_addresses, geofence_events
 * 3. Deletes the customer_profiles record (cascades to saved_addresses and
 *    geofence_events via ON DELETE CASCADE, but we do it explicitly for clarity)
 *
 * The customer_ratings, loyalty_transactions, and loyalty_redemptions tables
 * use ON DELETE SET NULL on the FK, but we set NULL explicitly here to ensure
 * the operation is atomic and auditable.
 *
 * Throws if the customer profile is not found.
 */
export async function deleteAccount(customerId: string): Promise<void> {
  const supabase = createAdminClient()

  // Verify the customer exists
  const { data: customer } = await supabase
    .from('customer_profiles')
    .select('id, user_id')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer) throw new Error('Perfil de comensal no encontrado')

  const now = new Date().toISOString()

  // Step 1: Anonymize references in orders (presencial)
  const { error: ordersError } = await supabase
    .from('orders')
    .update({ customer_id: null })
    .eq('customer_id', customerId)

  if (ordersError) throw new Error(`Error anonimizando orders: ${ordersError.message}`)

  // Step 2: Anonymize references in delivery_orders
  const { error: deliveryOrdersError } = await supabase
    .from('delivery_orders')
    .update({ customer_id: null })
    .eq('customer_id', customerId)

  if (deliveryOrdersError) throw new Error(`Error anonimizando delivery_orders: ${deliveryOrdersError.message}`)

  // Step 3: Anonymize references in customer_ratings
  // (FK is ON DELETE SET NULL, but we do it explicitly)
  const { error: ratingsError } = await supabase
    .from('customer_ratings')
    .update({ customer_id: null })
    .eq('customer_id', customerId)

  if (ratingsError) throw new Error(`Error anonimizando customer_ratings: ${ratingsError.message}`)

  // Step 4: Anonymize references in loyalty_transactions
  const { error: transactionsError } = await supabase
    .from('loyalty_transactions')
    .update({ customer_id: null })
    .eq('customer_id', customerId)

  if (transactionsError) throw new Error(`Error anonimizando loyalty_transactions: ${transactionsError.message}`)

  // Step 5: Anonymize references in loyalty_redemptions
  const { error: redemptionsError } = await supabase
    .from('loyalty_redemptions')
    .update({ customer_id: null })
    .eq('customer_id', customerId)

  if (redemptionsError) throw new Error(`Error anonimizando loyalty_redemptions: ${redemptionsError.message}`)

  // Step 6: Delete saved_addresses (also handled by ON DELETE CASCADE on customer_profiles)
  const { error: addressesError } = await supabase
    .from('saved_addresses')
    .delete()
    .eq('customer_id', customerId)

  if (addressesError) throw new Error(`Error eliminando saved_addresses: ${addressesError.message}`)

  // Step 7: Delete customer_geofence_events (also handled by ON DELETE CASCADE)
  const { error: geofenceError } = await supabase
    .from('customer_geofence_events')
    .delete()
    .eq('customer_id', customerId)

  if (geofenceError) throw new Error(`Error eliminando customer_geofence_events: ${geofenceError.message}`)

  // Step 8: Delete the customer_profiles record
  // This will also cascade-delete any remaining saved_addresses and geofence_events
  const { error: profileError } = await supabase
    .from('customer_profiles')
    .delete()
    .eq('id', customerId)

  if (profileError) throw new Error(`Error eliminando customer_profiles: ${profileError.message}`)
}
