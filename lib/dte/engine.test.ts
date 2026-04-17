// ══════════════════════════════════════════════════════════════════════════════
//  Emission_Engine unit tests — lib/dte/engine.test.ts
//
//  All external dependencies are mocked:
//    - @/lib/supabase/server
//    - @/lib/dte/folio
//    - @/lib/dte/signer
//    - @/lib/dte/sii-client
//
//  Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runEmission } from './engine'

// ── Mock modules ──────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/dte/folio', () => ({
  takeNextFolio: vi.fn(),
}))

vi.mock('@/lib/dte/signer', () => ({
  buildDteXml:       vi.fn(),
  signDte:           vi.fn(),
  loadCredentials:   vi.fn(),
}))

vi.mock('@/lib/dte/sii-client', () => ({
  getSiiToken:         vi.fn(),
  sendDteToSII:        vi.fn(),
  getSiiTokenFactura:  vi.fn(),
  sendFacturaToSII:    vi.fn(),
}))

// ── Import mocked modules ─────────────────────────────────────────────────────

import { createAdminClient } from '@/lib/supabase/server'
import { takeNextFolio }     from '@/lib/dte/folio'
import { buildDteXml, signDte, loadCredentials } from '@/lib/dte/signer'
import { getSiiToken, sendDteToSII, getSiiTokenFactura, sendFacturaToSII } from '@/lib/dte/sii-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMISSION_ID   = 'emission-uuid-1'
const RESTAURANT_ID = 'restaurant-uuid-1'
const ORDER_ID      = 'order-uuid-1'
const DOCUMENT_TYPE = 39 as const

/**
 * Builds a chainable Supabase mock that supports:
 *   .from(table).select(...).eq(...).maybeSingle()
 *   .from(table).update(...).eq(...)
 *
 * Each table can have a custom response configured via `tableResponses`.
 */
function buildSupabaseMock(tableResponses: Record<string, unknown>) {
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })

  const mock = {
    from: vi.fn((table: string) => {
      const response = tableResponses[table]
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue(response ?? { data: null, error: null }),
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
              neq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
              maybeSingle: vi.fn().mockResolvedValue(response ?? { data: null, error: null }),
            }),
            maybeSingle: vi.fn().mockResolvedValue(response ?? { data: null, error: null }),
            neq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        update: updateMock,
      }
    }),
    _updateMock: updateMock,
  }
  return mock
}

// ── Default happy-path data ───────────────────────────────────────────────────

const PAID_ORDER = {
  data: { id: ORDER_ID, status: 'paid', total: 11900, restaurant_id: RESTAURANT_ID },
  error: null,
}

const RESTAURANT = {
  data: {
    rut:           '12345678-9',
    razon_social:  'Test Restaurant SpA',
    giro:          'Restaurante',
    address:       'Av. Test 123',
    dte_environment: 'certification',
  },
  error: null,
}

const ORDER_ITEMS = {
  data: [{ name: 'Hamburguesa', quantity: 1, unit_price: 11900 }],
  error: null,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runEmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Guard: ORDER_NOT_PAID ──────────────────────────────────────────────────

  describe('ORDER_NOT_PAID guard', () => {
    it('returns ORDER_NOT_PAID when order status is "pending"', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders: { data: { id: ORDER_ID, status: 'pending', total: 5000, restaurant_id: RESTAURANT_ID }, error: null },
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      const result = await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('ORDER_NOT_PAID')
    })

    it('returns ORDER_NOT_PAID when order status is "open"', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders: { data: { id: ORDER_ID, status: 'open', total: 5000, restaurant_id: RESTAURANT_ID }, error: null },
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      const result = await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('ORDER_NOT_PAID')
    })

    it('does NOT call takeNextFolio when order is not paid', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders: { data: { id: ORDER_ID, status: 'cancelled', total: 5000, restaurant_id: RESTAURANT_ID }, error: null },
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(takeNextFolio).not.toHaveBeenCalled()
    })
  })

  // ── Guard: DUPLICATE_EMISSION ──────────────────────────────────────────────

  describe('DUPLICATE_EMISSION guard', () => {
    it('returns DUPLICATE_EMISSION when order already has an active emission', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: { id: 'other-emission-id', status: 'sent' }, error: null },
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      const result = await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('DUPLICATE_EMISSION')
    })

    it('does NOT call takeNextFolio when duplicate emission exists', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: { id: 'other-emission-id', status: 'draft' }, error: null },
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(takeNextFolio).not.toHaveBeenCalled()
    })
  })

  // ── Successful full pipeline ───────────────────────────────────────────────

  describe('successful full pipeline', () => {
    it('returns ok:true with folio, signed_xml, and track_id', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 42 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE>...</DTE>')
      vi.mocked(signDte).mockResolvedValue({ signed_xml: '<DTE signed>...</DTE>' })
      vi.mocked(loadCredentials).mockResolvedValue({
        privateKeyPem: 'fake-key',
        certificate: {} as any,
        rutEnvia: '12345678-9',
      })
      vi.mocked(getSiiToken).mockResolvedValue({ token: 'TOKEN-ABC' })
      vi.mocked(sendDteToSII).mockResolvedValue({ success: true, track_id: 'TRACK-123' })

      const result = await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(result.ok).toBe(true)
      expect(result.folio).toBe(42)
      expect(result.signed_xml).toBe('<DTE signed>...</DTE>')
      expect(result.track_id).toBe('TRACK-123')
    })

    it('calls takeNextFolio with correct restaurantId and documentType', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 42 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ signed_xml: '<signed/>' })
      vi.mocked(loadCredentials).mockResolvedValue({
        privateKeyPem: 'fake-key',
        certificate: {} as any,
        rutEnvia: '12345678-9',
      })
      vi.mocked(getSiiTokenFactura).mockResolvedValue({ token: 'TOKEN-FACTURA' })
      vi.mocked(sendFacturaToSII).mockResolvedValue({ success: true, track_id: 'T1' })

      // Type 33 requires all receptor fields
      await runEmission(
        EMISSION_ID, RESTAURANT_ID, ORDER_ID, 33,
        '12345678-9', 'Empresa SA',
        'Comercio', 'Av. Test 123', 'Santiago'
      )

      expect(takeNextFolio).toHaveBeenCalledWith(RESTAURANT_ID, 33)
    })

    it('calls signDte with the restaurantId', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 10 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ signed_xml: '<signed/>' })
      vi.mocked(loadCredentials).mockResolvedValue({
        privateKeyPem: 'fake-key',
        certificate: {} as any,
        rutEnvia: '12345678-9',
      })
      vi.mocked(getSiiToken).mockResolvedValue({ token: 'TOKEN-ABC' })
      vi.mocked(sendDteToSII).mockResolvedValue({ success: true, track_id: 'T2' })

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(signDte).toHaveBeenCalledWith(RESTAURANT_ID, '<DTE/>', 'caf-1')
    })
  })

  // ── Step (a) failure: NO_CAF_AVAILABLE ────────────────────────────────────

  describe('step (a) failure — NO_CAF_AVAILABLE', () => {
    it('returns NO_CAF_AVAILABLE error when takeNextFolio fails', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ error: 'NO_CAF_AVAILABLE' })

      const result = await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('NO_CAF_AVAILABLE')
    })

    it('does NOT call signDte when folio reservation fails', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ error: 'NO_CAF_AVAILABLE' })

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(signDte).not.toHaveBeenCalled()
    })

    it('writes error_detail when step (a) fails', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ error: 'NO_CAF_AVAILABLE' })

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      // error_detail should be written via update
      expect(supabase._updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ error_detail: 'NO_CAF_AVAILABLE' })
      )
    })
  })

  // ── Step (b) failure: CERT_NOT_FOUND ──────────────────────────────────────

  describe('step (b) failure — CERT_NOT_FOUND', () => {
    it('returns CERT_NOT_FOUND error when signDte fails', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 5 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ error: 'CERT_NOT_FOUND' })

      const result = await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('CERT_NOT_FOUND')
    })

    it('does NOT call sendDteToSII when signing fails', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 5 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ error: 'CERT_NOT_FOUND' })

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(sendDteToSII).not.toHaveBeenCalled()
    })

    it('does NOT decrement folio when signing fails (folio is consumed)', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 5 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ error: 'CERT_NOT_FOUND' })

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      // takeNextFolio was called once and never "undone"
      expect(takeNextFolio).toHaveBeenCalledTimes(1)
      // No call to decrement folio (no such function exists — folios are never decremented)
    })

    it('writes error_detail when step (b) fails', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 5 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ error: 'CERT_NOT_FOUND' })

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(supabase._updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ error_detail: 'CERT_NOT_FOUND' })
      )
    })
  })

  // ── Step (c) failure: SII_TIMEOUT ─────────────────────────────────────────

  describe('step (c) failure — SII upload error', () => {
    it('returns SII_UPLOAD_ERROR when sendDteToSII fails', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 7 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ signed_xml: '<signed/>' })
      vi.mocked(loadCredentials).mockResolvedValue({
        privateKeyPem: 'fake-key',
        certificate: {} as any,
        rutEnvia: '12345678-9',
      })
      vi.mocked(getSiiToken).mockResolvedValue({ token: 'TOKEN-ABC' })
      vi.mocked(sendDteToSII).mockResolvedValue({ success: false, error: 'SII_UPLOAD_ERROR', message: 'timeout' })

      const result = await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(result.ok).toBe(false)
      expect(result.error).toContain('SII_UPLOAD_ERROR')
    })

    it('does NOT decrement folio when SII submission fails', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 7 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ signed_xml: '<signed/>' })
      vi.mocked(loadCredentials).mockResolvedValue({
        privateKeyPem: 'fake-key',
        certificate: {} as any,
        rutEnvia: '12345678-9',
      })
      vi.mocked(getSiiToken).mockResolvedValue({ token: 'TOKEN-ABC' })
      vi.mocked(sendDteToSII).mockResolvedValue({ success: false, error: 'SII_UPLOAD_ERROR', message: 'timeout' })

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      // takeNextFolio was called once and never reversed
      expect(takeNextFolio).toHaveBeenCalledTimes(1)
    })

    it('writes error_detail when step (c) fails', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 7 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ signed_xml: '<signed/>' })
      vi.mocked(loadCredentials).mockResolvedValue({
        privateKeyPem: 'fake-key',
        certificate: {} as any,
        rutEnvia: '12345678-9',
      })
      vi.mocked(getSiiToken).mockResolvedValue({ token: 'TOKEN-ABC' })
      vi.mocked(sendDteToSII).mockResolvedValue({ success: false, error: 'SII_UPLOAD_ERROR', message: 'timeout' })

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      expect(supabase._updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ error_detail: expect.stringContaining('SII_UPLOAD_ERROR') })
      )
    })
  })

  // ── emitted_at and signed_at ───────────────────────────────────────────────

  describe('timestamps', () => {
    it('sets signed_at when emission succeeds', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 1 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ signed_xml: '<signed/>' })
      vi.mocked(loadCredentials).mockResolvedValue({
        privateKeyPem: 'fake-key',
        certificate: {} as any,
        rutEnvia: '12345678-9',
      })
      vi.mocked(getSiiToken).mockResolvedValue({ token: 'TOKEN-ABC' })
      vi.mocked(sendDteToSII).mockResolvedValue({ success: true, track_id: 'T99' })

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      // The final update sets status='sent' with signed_at
      expect(supabase._updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status:    'sent',
          signed_at: expect.any(String),
        })
      )
    })

    it('sets emitted_at when emission succeeds', async () => {
      const supabase = buildFlexibleSupabaseMock({
        orders:        PAID_ORDER,
        dte_emissions: { data: null, error: null },
        restaurants:   RESTAURANT,
        order_items:   ORDER_ITEMS,
      })
      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(takeNextFolio).mockResolvedValue({ caf_id: 'caf-1', folio: 1 })
      vi.mocked(buildDteXml).mockReturnValue('<DTE/>')
      vi.mocked(signDte).mockResolvedValue({ signed_xml: '<signed/>' })
      vi.mocked(loadCredentials).mockResolvedValue({
        privateKeyPem: 'fake-key',
        certificate: {} as any,
        rutEnvia: '12345678-9',
      })
      vi.mocked(getSiiToken).mockResolvedValue({ token: 'TOKEN-ABC' })
      vi.mocked(sendDteToSII).mockResolvedValue({ success: true, track_id: 'T99' })

      await runEmission(EMISSION_ID, RESTAURANT_ID, ORDER_ID, DOCUMENT_TYPE)

      // emitted_at is set in the final 'sent' update
      expect(supabase._updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status:     'sent',
          emitted_at: expect.any(String),
        })
      )
    })
  })
})

// ── Flexible Supabase mock ────────────────────────────────────────────────────

/**
 * A more flexible Supabase mock that handles the complex chaining patterns
 * used in engine.ts. Each table can return a custom response.
 *
 * Supports:
 *   .from(table).select().eq().maybeSingle()
 *   .from(table).select().eq().neq().neq().maybeSingle()
 *   .from(table).select().eq().neq().neq().maybeSingle()
 *   .from(table).update().eq()
 *   .from(table).select().eq().neq().neq().maybeSingle()
 */
function buildFlexibleSupabaseMock(tableResponses: Record<string, { data: unknown; error: unknown }>) {
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })

  // Track which table is being queried for select chains
  let currentTable = ''

  const getResponse = (table: string) =>
    tableResponses[table] ?? { data: null, error: null }

  // Build a deeply chainable select mock
  const buildSelectChain = (table: string) => {
    const response = getResponse(table)

    // For order_items, we need to return an array (not maybeSingle)
    if (table === 'order_items') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockResolvedValue(response),
          }),
        }),
        update: updateMock,
      }
    }

    // For dte_emissions duplicate check: .select().eq().neq().neq().maybeSingle()
    if (table === 'dte_emissions') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue(response),
              }),
            }),
            maybeSingle: vi.fn().mockResolvedValue(response),
          }),
        }),
        update: updateMock,
      }
    }

    // Default: .select().eq().maybeSingle()
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue(response),
        }),
      }),
      update: updateMock,
    }
  }

  const mock = {
    from: vi.fn((table: string) => {
      currentTable = table
      return buildSelectChain(table)
    }),
    _updateMock: updateMock,
  }

  return mock
}
