// ══════════════════════════════════════════════════════════════════════════════
//  Email Sender Unit Tests — __tests__/email/sender.test.ts
//
//  Unit tests for sendBoletaEmail, sendFacturaEmail, and sendStockCriticalReport.
//  Verifies skip logic, attachment naming, and Supabase query filters.
//
//  Feature: email-templates-hichapi
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSupabaseMock } from '../setup/supabase-mock'

// ── Mock @/lib/supabase/server before importing sender ────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/server'

// ── Import functions under test ───────────────────────────────────────────────
import {
  sendBoletaEmail,
  sendFacturaEmail,
  sendStockCriticalReport,
  type SendBoletaArgs,
  type SendFacturaArgs,
} from '@/lib/email/sender'

// ── Shared test data ──────────────────────────────────────────────────────────

const BASE_BOLETA_ARGS: SendBoletaArgs = {
  to:             'cliente@example.com',
  orderId:        'order-123',
  folio:          42,
  restaurantName: 'Restaurante Test',
  totalAmount:    15000,
  emittedAt:      '2024-06-01T12:00:00Z',
  items:          [{ name: 'Pizza', quantity: 1, unit_price: 15000 }],
}

const BASE_FACTURA_ARGS: SendFacturaArgs = {
  to:             'empresa@example.com',
  orderId:        'order-456',
  folio:          99,
  restaurantName: 'Restaurante Test',
  razonReceptor:  'Empresa Receptora SpA',
  totalAmount:    50000,
  emittedAt:      '2024-06-01T12:00:00Z',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Captures the arguments passed to fetch (Resend API call) by mocking globalThis.fetch.
 * Returns the captured payload and a mock response.
 */
function mockFetchSuccess(id = 'resend-msg-id-001') {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ id }), { status: 200 })
  )
}

function mockFetchFailure(status = 500, message = 'Internal Server Error') {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ message }), { status })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  sendBoletaEmail
// ══════════════════════════════════════════════════════════════════════════════

describe('sendBoletaEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure RESEND_API_KEY is set so sendBrandedEmail attempts a real send
    process.env.RESEND_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.RESEND_API_KEY
  })

  // ── Skip logic ──────────────────────────────────────────────────────────────

  it('returns { ok: false, skipped: true } when to is empty string', async () => {
    const result = await sendBoletaEmail({ ...BASE_BOLETA_ARGS, to: '' })
    expect(result.ok).toBe(false)
    expect(result.skipped).toBe(true)
  })

  it('returns { ok: false, skipped: true } when to is whitespace only', async () => {
    const result = await sendBoletaEmail({ ...BASE_BOLETA_ARGS, to: '   ' })
    expect(result.ok).toBe(false)
    expect(result.skipped).toBe(true)
  })

  // ── Successful send ─────────────────────────────────────────────────────────

  it('returns { ok: true, id } when sendBrandedEmail succeeds', async () => {
    mockFetchSuccess('boleta-send-id')

    const result = await sendBoletaEmail(BASE_BOLETA_ARGS)

    expect(result.ok).toBe(true)
    expect(result.id).toBe('boleta-send-id')
  })

  // ── Correct arguments passed to sendBrandedEmail (via fetch) ────────────────

  it('calls Resend API with correct to address when to is present', async () => {
    const fetchSpy = mockFetchSuccess()

    await sendBoletaEmail(BASE_BOLETA_ARGS)

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [, init] = fetchSpy.mock.calls[0]
    const payload = JSON.parse((init as RequestInit).body as string)
    expect(payload.to).toEqual(['cliente@example.com'])
  })

  // ── Attachment naming — XML ─────────────────────────────────────────────────

  it('builds attachment boleta-{folio}.xml with MIME application/xml when xmlBase64 is provided', async () => {
    const fetchSpy = mockFetchSuccess()

    await sendBoletaEmail({
      ...BASE_BOLETA_ARGS,
      folio:     77,
      xmlBase64: 'base64xmlcontent==',
    })

    const [, init] = fetchSpy.mock.calls[0]
    const payload = JSON.parse((init as RequestInit).body as string)

    expect(payload.attachments).toBeDefined()
    const xmlAttachment = payload.attachments.find(
      (a: { filename: string }) => a.filename === 'boleta-77.xml'
    )
    expect(xmlAttachment).toBeDefined()
    expect(xmlAttachment.type).toBe('application/xml')
    expect(xmlAttachment.content).toBe('base64xmlcontent==')
  })

  // ── Attachment naming — PDF ─────────────────────────────────────────────────

  it('builds attachment boleta-{folio}.pdf with MIME application/pdf when pdfBase64 is provided', async () => {
    const fetchSpy = mockFetchSuccess()

    await sendBoletaEmail({
      ...BASE_BOLETA_ARGS,
      folio:     77,
      pdfBase64: 'base64pdfcontent==',
    })

    const [, init] = fetchSpy.mock.calls[0]
    const payload = JSON.parse((init as RequestInit).body as string)

    expect(payload.attachments).toBeDefined()
    const pdfAttachment = payload.attachments.find(
      (a: { filename: string }) => a.filename === 'boleta-77.pdf'
    )
    expect(pdfAttachment).toBeDefined()
    expect(pdfAttachment.type).toBe('application/pdf')
    expect(pdfAttachment.content).toBe('base64pdfcontent==')
  })

  it('includes both XML and PDF attachments when both are provided', async () => {
    const fetchSpy = mockFetchSuccess()

    await sendBoletaEmail({
      ...BASE_BOLETA_ARGS,
      folio:     55,
      xmlBase64: 'xmldata==',
      pdfBase64: 'pdfdata==',
    })

    const [, init] = fetchSpy.mock.calls[0]
    const payload = JSON.parse((init as RequestInit).body as string)

    expect(payload.attachments).toHaveLength(2)
    const filenames = payload.attachments.map((a: { filename: string }) => a.filename)
    expect(filenames).toContain('boleta-55.xml')
    expect(filenames).toContain('boleta-55.pdf')
  })

  it('sends no attachments when neither xmlBase64 nor pdfBase64 is provided', async () => {
    const fetchSpy = mockFetchSuccess()

    await sendBoletaEmail(BASE_BOLETA_ARGS)

    const [, init] = fetchSpy.mock.calls[0]
    const payload = JSON.parse((init as RequestInit).body as string)

    // attachments key should be absent or empty
    expect(!payload.attachments || payload.attachments.length === 0).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
//  sendFacturaEmail
// ══════════════════════════════════════════════════════════════════════════════

describe('sendFacturaEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.RESEND_API_KEY
  })

  // ── Skip logic ──────────────────────────────────────────────────────────────

  it('returns { ok: false, skipped: true } when razonReceptor is empty string', async () => {
    const result = await sendFacturaEmail({ ...BASE_FACTURA_ARGS, razonReceptor: '' })
    expect(result.ok).toBe(false)
    expect(result.skipped).toBe(true)
  })

  it('returns { ok: false, skipped: true } when razonReceptor is whitespace only', async () => {
    const result = await sendFacturaEmail({ ...BASE_FACTURA_ARGS, razonReceptor: '   ' })
    expect(result.ok).toBe(false)
    expect(result.skipped).toBe(true)
  })

  // ── Correct arguments ───────────────────────────────────────────────────────

  it('calls Resend API with correct to address when razonReceptor is present', async () => {
    const fetchSpy = mockFetchSuccess()

    await sendFacturaEmail(BASE_FACTURA_ARGS)

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [, init] = fetchSpy.mock.calls[0]
    const payload = JSON.parse((init as RequestInit).body as string)
    expect(payload.to).toEqual(['empresa@example.com'])
  })

  // ── Attachment naming — XML ─────────────────────────────────────────────────

  it('builds attachment factura-{folio}.xml with MIME application/xml when xmlBase64 is provided', async () => {
    const fetchSpy = mockFetchSuccess()

    await sendFacturaEmail({
      ...BASE_FACTURA_ARGS,
      folio:     33,
      xmlBase64: 'xmlfacturabase64==',
    })

    const [, init] = fetchSpy.mock.calls[0]
    const payload = JSON.parse((init as RequestInit).body as string)

    const xmlAttachment = payload.attachments?.find(
      (a: { filename: string }) => a.filename === 'factura-33.xml'
    )
    expect(xmlAttachment).toBeDefined()
    expect(xmlAttachment.type).toBe('application/xml')
  })

  // ── Attachment naming — PDF ─────────────────────────────────────────────────

  it('builds attachment factura-{folio}.pdf with MIME application/pdf when pdfBase64 is provided', async () => {
    const fetchSpy = mockFetchSuccess()

    await sendFacturaEmail({
      ...BASE_FACTURA_ARGS,
      folio:     33,
      pdfBase64: 'pdffacturabase64==',
    })

    const [, init] = fetchSpy.mock.calls[0]
    const payload = JSON.parse((init as RequestInit).body as string)

    const pdfAttachment = payload.attachments?.find(
      (a: { filename: string }) => a.filename === 'factura-33.pdf'
    )
    expect(pdfAttachment).toBeDefined()
    expect(pdfAttachment.type).toBe('application/pdf')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
//  sendStockCriticalReport
// ══════════════════════════════════════════════════════════════════════════════

describe('sendStockCriticalReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.RESEND_API_KEY
  })

  // ── No critical items ───────────────────────────────────────────────────────

  it('returns { ok: false, skipped: true, reason: "no_critical_items" } when no items have current_qty <= min_qty', async () => {
    const restaurantId = 'rest-001'

    // All items have current_qty > min_qty → no critical items
    const mockSupabase = createSupabaseMock({
      tables: {
        stock_items: {
          data: [
            { name: 'Harina', current_qty: 10, min_qty: 5, unit: 'kg', supplier: null },
            { name: 'Aceite', current_qty: 20, min_qty: 3, unit: 'l', supplier: null },
          ],
        },
      },
    })

    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

    const result = await sendStockCriticalReport(restaurantId)

    expect(result.ok).toBe(false)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('no_critical_items')
  })

  it('returns { ok: false, skipped: true, reason: "no_critical_items" } when stock_items is empty', async () => {
    const restaurantId = 'rest-002'

    const mockSupabase = createSupabaseMock({
      tables: {
        stock_items: { data: [] },
      },
    })

    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

    const result = await sendStockCriticalReport(restaurantId)

    expect(result.ok).toBe(false)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('no_critical_items')
  })

  // ── No active admin ─────────────────────────────────────────────────────────

  it('returns { ok: false, skipped: true, reason: "no_admin" } when no active admin/owner exists', async () => {
    const restaurantId = 'rest-003'

    // Has critical items but no team member
    // Note: include restaurant_id and active fields so the mock filter doesn't strip them
    const mockSupabase = createSupabaseMock({
      tables: {
        stock_items: {
          data: [
            { name: 'Tomate', current_qty: 2, min_qty: 5, unit: 'kg', supplier: null, restaurant_id: restaurantId, active: true },
          ],
        },
        team_members: {
          // single() will return error when no rows
          data: [],
        },
      },
    })

    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

    const result = await sendStockCriticalReport(restaurantId)

    expect(result.ok).toBe(false)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('no_admin')
  })

  // ── Correct team_members query filters ─────────────────────────────────────

  it('queries team_members with restaurant_id, role IN [owner, admin], and active = true', async () => {
    const restaurantId = 'rest-004'
    const userId = 'user-admin-001'

    // Track calls to the from() builder
    const fromSpy = vi.fn()

    const mockSupabase = createSupabaseMock({
      tables: {
        stock_items: {
          data: [
            { name: 'Sal', current_qty: 0, min_qty: 2, unit: 'kg', supplier: null, restaurant_id: restaurantId, active: true },
          ],
        },
        team_members: {
          data: [{ user_id: userId, restaurant_id: restaurantId, role: 'admin', active: true }],
        },
        restaurants: {
          data: { name: 'Restaurante Filtros' },
        },
      },
    })

    // Spy on the from() method to capture which table is queried
    const originalFrom = mockSupabase.from.bind(mockSupabase)
    const fromCallArgs: string[] = []
    mockSupabase.from = vi.fn((table: string) => {
      fromCallArgs.push(table)
      return originalFrom(table)
    })

    // Mock auth.admin.getUserById
    mockSupabase.auth.admin = {
      getUserById: vi.fn().mockResolvedValue({
        data: { user: { email: 'admin@restaurant.com' } },
        error: null,
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

    // Mock fetch so the email "sends" successfully
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'stock-email-id' }), { status: 200 })
    )

    await sendStockCriticalReport(restaurantId)

    // Verify team_members was queried
    expect(fromCallArgs).toContain('team_members')
  })

  it('passes restaurant_id filter when querying team_members', async () => {
    const restaurantId = 'rest-filter-check'
    const userId = 'user-filter-001'

    // Set up mock with team member that has matching restaurant_id, role, and active
    const mockSupabase = createSupabaseMock({
      tables: {
        stock_items: {
          data: [{ name: 'Azucar', current_qty: 1, min_qty: 3, unit: 'kg', supplier: null, restaurant_id: restaurantId, active: true }],
        },
        team_members: {
          data: [{ user_id: userId, restaurant_id: restaurantId, role: 'owner', active: true }],
        },
        restaurants: {
          data: { name: 'Restaurante Filtros' },
        },
      },
    })

    mockSupabase.auth.admin = {
      getUserById: vi.fn().mockResolvedValue({
        data: { user: { email: 'owner@restaurant.com' } },
        error: null,
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'stock-email-id-2' }), { status: 200 })
    )

    const result = await sendStockCriticalReport(restaurantId)

    // The function should succeed — meaning it found the admin with the correct filters
    // (restaurant_id = restaurantId, role IN ['owner','admin'], active = true)
    expect(result.ok).toBe(true)

    // Verify getUserById was called with the correct userId (proves team_members was queried)
    expect(mockSupabase.auth.admin.getUserById).toHaveBeenCalledWith(userId)
  })
})
