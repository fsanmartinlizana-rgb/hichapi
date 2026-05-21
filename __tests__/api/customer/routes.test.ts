// ══════════════════════════════════════════════════════════════════════════════
//  Customer API Routes — validation & auth tests
//  __tests__/api/customer/routes.test.ts
//
//  Requirements: 9.7
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { PATCH as PatchProfile } from '@/app/api/customer/profile/route'
import { POST as PostAddress } from '@/app/api/customer/addresses/route'
import { POST as PostRating } from '@/app/api/customer/ratings/route'
import { POST as RedeemLoyalty } from '@/app/api/customer/loyalty/redeem/route'
import { mockNextRequest, extractResponse } from '@/__tests__/setup/test-helpers'

vi.mock('@/lib/supabase/auth-guard', () => ({
  requireCustomer: vi.fn(),
  requireUser: vi.fn(),
}))

vi.mock('@/lib/customer/customer-service', () => ({
  updateProfile: vi.fn(),
  createAddress: vi.fn(),
}))

vi.mock('@/lib/customer/rating-service', () => ({
  submitRating: vi.fn(),
}))

vi.mock('@/lib/customer/loyalty-service', () => ({
  redeemPoints: vi.fn(),
}))

import { requireCustomer } from '@/lib/supabase/auth-guard'
import { createAddress } from '@/lib/customer/customer-service'

const CUSTOMER = {
  id: 'cust-uuid',
  user_id: 'user-uuid',
  display_name: 'Test',
  phone: null,
  photo_url: null,
  loyalty_points: 1000,
  push_token: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('Customer API routes — auth guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when requireCustomer fails with no session', async () => {
    vi.mocked(requireCustomer).mockResolvedValue({
      customer: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    })

    const res = await PatchProfile(
      mockNextRequest({ display_name: 'Nuevo' }, undefined, { method: 'PATCH' }),
    )
    const { status } = await extractResponse(res)
    expect(status).toBe(401)
  })

  it('returns 403 when customer profile does not exist', async () => {
    vi.mocked(requireCustomer).mockResolvedValue({
      customer: null,
      error: NextResponse.json({ error: 'Perfil de comensal no encontrado' }, { status: 403 }),
    })

    const res = await PostRating(
      mockNextRequest({
        entity_type: 'restaurant',
        entity_id: '00000000-0000-4000-8000-000000000001',
        order_id: '00000000-0000-4000-8000-000000000002',
        order_type: 'delivery',
        stars: 5,
      }),
    )
    const { status } = await extractResponse(res)
    expect(status).toBe(403)
  })
})

describe('Customer API routes — Zod validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireCustomer).mockResolvedValue({ customer: CUSTOMER, error: null })
  })

  it('PATCH /profile returns 400 for invalid photo_url', async () => {
    const res = await PatchProfile(
      mockNextRequest({ photo_url: 'not-a-url' }, undefined, { method: 'PATCH' }),
    )
    const { status, data } = await extractResponse(res)
    expect(status).toBe(400)
    expect(data.error).toBe('Datos inválidos')
  })

  it('POST /ratings returns 400 for stars out of range', async () => {
    const res = await PostRating(
      mockNextRequest({
        entity_type: 'restaurant',
        entity_id: '00000000-0000-4000-8000-000000000001',
        order_id: '00000000-0000-4000-8000-000000000002',
        order_type: 'delivery',
        stars: 6,
      }),
    )
    const { status } = await extractResponse(res)
    expect(status).toBe(400)
  })

  it('POST /loyalty/redeem returns 400 when points below minimum', async () => {
    const res = await RedeemLoyalty(
      mockNextRequest({ points_to_redeem: 100 }),
    )
    const { status } = await extractResponse(res)
    expect(status).toBe(400)
  })
})

describe('Customer API routes — business limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireCustomer).mockResolvedValue({ customer: CUSTOMER, error: null })
  })

  it('POST /addresses returns 422 when address limit is reached', async () => {
    vi.mocked(createAddress).mockRejectedValue(
      new Error('Límite de direcciones alcanzado (máximo 10)'),
    )

    const res = await PostAddress(
      mockNextRequest({
        label: 'Casa',
        street: 'Av. Providencia 1234',
        city: 'Santiago',
      }),
    )
    const { status, data } = await extractResponse(res)
    expect(status).toBe(422)
    expect(data.error).toContain('Límite de direcciones')
  })
})
