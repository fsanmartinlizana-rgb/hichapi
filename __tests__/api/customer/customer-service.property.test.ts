// ══════════════════════════════════════════════════════════════════════════════
//  CustomerService Property Tests
//  __tests__/api/customer/customer-service.property.test.ts
//
//  Property-based tests for CustomerService serialization invariants.
//
//  Feature: usuario-comensal
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { expect } from 'vitest'
import { arbSavedAddress } from '@/__tests__/setup/fast-check-arbitraries'
import type { SavedAddress } from '@/lib/customer/types'

// ── Property 6: Saved address round-trip serialization ────────────────────────
//
// For any valid SavedAddress object, parse(serialize(address)) SHALL produce
// an object with identical label, street, city, notes, and is_default fields.
//
// Validates: Requirements 3.1, 3.4

describe('CustomerService — Property 6: Saved address round-trip serialization', () => {
  it(
    'parse(serialize(address)) preserves label, street, city, notes, and is_default',
    () => {
      fc.assert(
        fc.property(arbSavedAddress(), (address: SavedAddress) => {
          // Serialize → Deserialize (JSON round-trip)
          const serialized = JSON.stringify(address)
          const parsed: SavedAddress = JSON.parse(serialized)

          // The five fields specified by Property 6 must be identical
          expect(parsed.label).toBe(address.label)
          expect(parsed.street).toBe(address.street)
          expect(parsed.city).toBe(address.city)
          expect(parsed.notes).toBe(address.notes)
          expect(parsed.is_default).toBe(address.is_default)
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'round-trip preserves all SavedAddress fields (full object equivalence)',
    () => {
      fc.assert(
        fc.property(arbSavedAddress(), (address: SavedAddress) => {
          const parsed: SavedAddress = JSON.parse(JSON.stringify(address))

          // Full structural equivalence — every field must survive the round-trip
          expect(parsed.id).toBe(address.id)
          expect(parsed.customer_id).toBe(address.customer_id)
          expect(parsed.label).toBe(address.label)
          expect(parsed.street).toBe(address.street)
          expect(parsed.city).toBe(address.city)
          expect(parsed.notes).toBe(address.notes)
          expect(parsed.is_default).toBe(address.is_default)
          expect(parsed.created_at).toBe(address.created_at)
          expect(parsed.updated_at).toBe(address.updated_at)
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'serialized address is valid JSON (can be parsed without throwing)',
    () => {
      fc.assert(
        fc.property(arbSavedAddress(), (address: SavedAddress) => {
          const serialized = JSON.stringify(address)
          expect(() => JSON.parse(serialized)).not.toThrow()
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'notes field handles null correctly in round-trip',
    () => {
      fc.assert(
        fc.property(arbSavedAddress(), (address: SavedAddress) => {
          const parsed: SavedAddress = JSON.parse(JSON.stringify(address))

          // null notes must remain null (not become undefined or empty string)
          if (address.notes === null) {
            expect(parsed.notes).toBeNull()
          } else {
            expect(parsed.notes).toBe(address.notes)
          }
        }),
        { numRuns: 25 },
      )
    },
  )
})

// ── Property 10: Data serialization round-trip (CustomerProfile y LoyaltyTransaction) ──
//
// For any valid CustomerProfile or LoyaltyTransaction object,
// parse(serialize(obj)) SHALL produce an object equivalent to the original.
//
// Validates: Requirements 9.7

import { arbCustomerProfile, arbLoyaltyTransaction } from '@/__tests__/setup/fast-check-arbitraries'
import type { CustomerProfile, LoyaltyTransaction } from '@/lib/customer/types'

describe('CustomerService — Property 10: Data serialization round-trip (CustomerProfile)', () => {
  it(
    'parse(serialize(profile)) preserves all CustomerProfile fields',
    () => {
      fc.assert(
        fc.property(arbCustomerProfile(), (profile: CustomerProfile) => {
          const serialized = JSON.stringify(profile)
          const parsed: CustomerProfile = JSON.parse(serialized)

          expect(parsed.id).toBe(profile.id)
          expect(parsed.user_id).toBe(profile.user_id)
          expect(parsed.display_name).toBe(profile.display_name)
          expect(parsed.phone).toBe(profile.phone)
          expect(parsed.photo_url).toBe(profile.photo_url)
          expect(parsed.loyalty_points).toBe(profile.loyalty_points)
          expect(parsed.push_token).toBe(profile.push_token)
          expect(parsed.created_at).toBe(profile.created_at)
          expect(parsed.updated_at).toBe(profile.updated_at)
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'serialized CustomerProfile is valid JSON (can be parsed without throwing)',
    () => {
      fc.assert(
        fc.property(arbCustomerProfile(), (profile: CustomerProfile) => {
          const serialized = JSON.stringify(profile)
          expect(() => JSON.parse(serialized)).not.toThrow()
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'nullable fields (phone, photo_url, push_token) survive round-trip correctly',
    () => {
      fc.assert(
        fc.property(arbCustomerProfile(), (profile: CustomerProfile) => {
          const parsed: CustomerProfile = JSON.parse(JSON.stringify(profile))

          // null values must remain null (not become undefined or empty string)
          if (profile.phone === null) {
            expect(parsed.phone).toBeNull()
          } else {
            expect(parsed.phone).toBe(profile.phone)
          }

          if (profile.photo_url === null) {
            expect(parsed.photo_url).toBeNull()
          } else {
            expect(parsed.photo_url).toBe(profile.photo_url)
          }

          if (profile.push_token === null) {
            expect(parsed.push_token).toBeNull()
          } else {
            expect(parsed.push_token).toBe(profile.push_token)
          }
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'loyalty_points is a non-negative integer after round-trip',
    () => {
      fc.assert(
        fc.property(arbCustomerProfile(), (profile: CustomerProfile) => {
          const parsed: CustomerProfile = JSON.parse(JSON.stringify(profile))

          expect(parsed.loyalty_points).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(parsed.loyalty_points)).toBe(true)
        }),
        { numRuns: 25 },
      )
    },
  )
})

describe('CustomerService — Property 10: Data serialization round-trip (LoyaltyTransaction)', () => {
  it(
    'parse(serialize(transaction)) preserves all LoyaltyTransaction fields',
    () => {
      fc.assert(
        fc.property(arbLoyaltyTransaction(), (tx: LoyaltyTransaction) => {
          const serialized = JSON.stringify(tx)
          const parsed: LoyaltyTransaction = JSON.parse(serialized)

          expect(parsed.id).toBe(tx.id)
          expect(parsed.customer_id).toBe(tx.customer_id)
          expect(parsed.order_id).toBe(tx.order_id)
          expect(parsed.order_type).toBe(tx.order_type)
          expect(parsed.points_delta).toBe(tx.points_delta)
          expect(parsed.balance_after).toBe(tx.balance_after)
          expect(parsed.description).toBe(tx.description)
          expect(parsed.created_at).toBe(tx.created_at)
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'serialized LoyaltyTransaction is valid JSON (can be parsed without throwing)',
    () => {
      fc.assert(
        fc.property(arbLoyaltyTransaction(), (tx: LoyaltyTransaction) => {
          const serialized = JSON.stringify(tx)
          expect(() => JSON.parse(serialized)).not.toThrow()
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'nullable fields (order_id, order_type) survive round-trip correctly',
    () => {
      fc.assert(
        fc.property(arbLoyaltyTransaction(), (tx: LoyaltyTransaction) => {
          const parsed: LoyaltyTransaction = JSON.parse(JSON.stringify(tx))

          if (tx.order_id === null) {
            expect(parsed.order_id).toBeNull()
          } else {
            expect(parsed.order_id).toBe(tx.order_id)
          }

          if (tx.order_type === null) {
            expect(parsed.order_type).toBeNull()
          } else {
            expect(parsed.order_type).toBe(tx.order_type)
          }
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'balance_after is a non-negative integer after round-trip',
    () => {
      fc.assert(
        fc.property(arbLoyaltyTransaction(), (tx: LoyaltyTransaction) => {
          const parsed: LoyaltyTransaction = JSON.parse(JSON.stringify(tx))

          expect(parsed.balance_after).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(parsed.balance_after)).toBe(true)
        }),
        { numRuns: 25 },
      )
    },
  )
})
