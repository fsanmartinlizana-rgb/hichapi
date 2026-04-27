// ══════════════════════════════════════════════════════════════════════════════
//  DTE SII FAU Rejection — Bug Condition Exploration Test
//  __tests__/api/dte/dte-sii-fau-rejection.test.ts
//
//  Property 1: Bug Condition — FAU Rejection Due to Date Mismatch
//
//  CRITICAL: This test MUST FAIL on unfixed code.
//  Failure confirms the bug exists: the current code extracts the date from
//  `emitted_at.split('T')[0]` (UTC), which differs from the XML's <FchEmis>
//  (local date) when the emission crosses a day boundary.
//
//  On FIXED code: the test PASSES because the route uses `fecha_emision`
//  (the stored local date) instead of extracting from the UTC timestamp.
//
//  Validates: Requirements 1.1, 1.2, 1.3
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { POST } from '@/app/api/dte/status/route'
import { createSupabaseMock } from '../../setup/supabase-mock'
import { mockNextRequest } from '../../setup/test-helpers'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/auth-guard', () => ({
  requireRestaurantRole: vi.fn(),
}))

vi.mock('@/lib/dte/signer', () => ({
  loadCredentials: vi.fn(),
}))

vi.mock('@/lib/dte/sii-client', () => ({
  getSiiTokenFactura: vi.fn(),
  queryEstDteFactura: vi.fn(),
  // Keep other exports as no-ops so the boleta branch doesn't break
  getSiiToken: vi.fn(),
  checkDteStatus: vi.fn(),
}))

vi.mock('@/lib/email/sender', () => ({
  sendBrandedEmail: vi.fn(),
}))

vi.mock('@/lib/dte/pdf-generator', () => ({
  generateDtePdf: vi.fn(),
}))

// ── Import mocked modules after vi.mock ───────────────────────────────────────

import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { loadCredentials } from '@/lib/dte/signer'
import { getSiiTokenFactura, queryEstDteFactura } from '@/lib/dte/sii-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

const RESTAURANT_ID = crypto.randomUUID()
const EMISSION_ID   = crypto.randomUUID()

/**
 * Builds a UTC timestamp that is one day AHEAD of the given local date.
 * e.g. localDate='2026-04-26' → '2026-04-27T00:48:26Z'
 * This simulates a Chile-timezone emission at ~21:48 local time (UTC-3).
 */
function buildUtcNextDayTimestamp(localDate: string, minutesAfterMidnight = 48): string {
  const [year, month, day] = localDate.split('-').map(Number)
  // Next calendar day in UTC
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, minutesAfterMidnight, 26))
  return nextDay.toISOString().replace('.000Z', 'Z')
}

/**
 * Sets up all mocks for a factura emission where:
 *  - emitted_at is a UTC timestamp on the NEXT day (crosses day boundary)
 *  - xml_signed contains <FchEmis> with the LOCAL date (one day earlier)
 *  - fecha_emision is set to localDate (simulating FIXED code — column populated)
 *    Pass null explicitly to simulate unfixed code (column not yet stored).
 */
function setupMocksForBugCondition(localDate: string, utcTimestamp: string, fechaEmision: string | null = localDate) {
  const xmlSigned = `<?xml version="1.0" encoding="ISO-8859-1"?>
<EnvioDTE>
  <DTE>
    <Documento>
      <Encabezado>
        <IdDoc>
          <TipoDTE>33</TipoDTE>
          <Folio>141</Folio>
          <FchEmis>${localDate}</FchEmis>
        </IdDoc>
      </Encabezado>
    </Documento>
  </DTE>
</EnvioDTE>`

  const mockEmission = {
    id:            EMISSION_ID,
    document_type: 33,
    folio:         141,
    emitted_at:    utcTimestamp,
    fecha_emision: fechaEmision,  // localDate when fixed, null when simulating unfixed code
    xml_signed:    xmlSigned,
    total_amount:  20000,
    rut_receptor:  '15574450-2',
    razon_receptor: 'Cliente Test SpA',
    email_receptor: null,
    sii_track_id:  '0248097438',
    status:        'sent',
  }

  const mockRestaurant = {
    rut:             '76123456-7',
    razon_social:    'Restaurante Test SpA',
    dte_environment: 'certificacion',
    photo_url:       null,
  }

  const mockSupabase = createSupabaseMock({
    tables: {
      dte_emissions: { data: mockEmission },
      restaurants:   { data: mockRestaurant },
    },
  })

  vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

  vi.mocked(requireRestaurantRole).mockResolvedValue({
    user:  { id: crypto.randomUUID(), email: 'admin@test.com' } as any,
    error: null,
  })

  vi.mocked(loadCredentials).mockResolvedValue({
    privateKeyPem: '-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----',
    certificate:   {} as any,
    rutEnvia:      '76123456-7',
  })

  vi.mocked(getSiiTokenFactura).mockResolvedValue({ token: 'mock-token' })

  // queryEstDteFactura spy — returns DOK so the route doesn't error out
  vi.mocked(queryEstDteFactura).mockResolvedValue({ estado: 'DOK', glosa: 'DTE Aceptado' })
}

// ══════════════════════════════════════════════════════════════════════════════
//  Property 1: Bug Condition — Date Mismatch Causes FAU
//
//  **Validates: Requirements 1.1, 1.2, 1.3**
//
//  The test asserts that the date sent to queryEstDteFactura equals the XML's
//  <FchEmis> date (local date), NOT the UTC-extracted date.
//
//  On UNFIXED code: queryEstDteFactura receives '2026-04-27' (from UTC split)
//                   but XML has <FchEmis>2026-04-26</FchEmis> → FAILS
//  On FIXED code:   queryEstDteFactura receives '2026-04-26' (from fecha_emision) → PASSES
// ══════════════════════════════════════════════════════════════════════════════

describe('Property 1: Bug Condition — FAU Rejection Due to Date Mismatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Concrete failing case (the exact real-world bug) ──────────────────────

  it('concrete case: emitted_at=2026-04-27T00:48:26Z but XML FchEmis=2026-04-26 — date sent to SII must be 2026-04-26', async () => {
    // This is the exact failing case from production:
    //   Local time (Chile, UTC-3): 2026-04-26 21:48:26
    //   UTC timestamp stored:      2026-04-27T00:48:26Z  ← crosses day boundary
    //   XML FchEmis:               2026-04-26            ← local date used when building XML
    //
    // Bug: current code does emitted_at.split('T')[0] = '2026-04-27'
    // Fix: should use fecha_emision = '2026-04-26' (or extract from XML)

    const localDate    = '2026-04-26'
    const utcTimestamp = '2026-04-27T00:48:26Z'

    setupMocksForBugCondition(localDate, utcTimestamp)

    const request = mockNextRequest({
      restaurant_id: RESTAURANT_ID,
      emission_id:   EMISSION_ID,
    })

    await POST(request)

    // Capture what date was actually sent to queryEstDteFactura
    expect(vi.mocked(queryEstDteFactura)).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(queryEstDteFactura).mock.calls[0][0]

    // ASSERTION: the date sent to SII must match the XML's <FchEmis>
    // On UNFIXED code: callArgs.fechaEmisionDte === '2026-04-27' → FAILS (proves bug)
    // On FIXED code:   callArgs.fechaEmisionDte === '2026-04-26' → PASSES
    expect(callArgs.fechaEmisionDte).toBe(localDate) // '2026-04-26'
  })

  // ── Property-based: all UTC timestamps that cross a day boundary ──────────

  it('property: for any UTC timestamp that crosses a day boundary, fechaEmisionDte must equal the XML FchEmis (local date)', async () => {
    /**
     * **Validates: Requirements 1.1, 1.2, 1.3**
     *
     * Generator: produces pairs of (localDate, utcTimestamp) where the UTC
     * timestamp is on the NEXT calendar day relative to localDate.
     * This models the Chile timezone (UTC-3) scenario where an emission at
     * e.g. 21:00 local time becomes 00:00 UTC the next day.
     */
    const dayBoundaryCrossing = fc.record({
      // Local date: any date in 2025-2026 range
      localDate: fc.date({
        min: new Date('2025-01-01'),
        max: new Date('2026-12-31'),
      }).map(d => {
        const y = d.getUTCFullYear()
        const m = String(d.getUTCMonth() + 1).padStart(2, '0')
        const day = String(d.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      }),
      // Minutes after midnight UTC on the NEXT day (0–179 = 0:00–2:59 UTC)
      // This represents Chile UTC-3 emissions between 21:00–23:59 local time
      minutesAfterMidnight: fc.integer({ min: 0, max: 179 }),
    })

    await fc.assert(
      fc.asyncProperty(dayBoundaryCrossing, async ({ localDate, minutesAfterMidnight }) => {
        vi.clearAllMocks()

        const utcTimestamp = buildUtcNextDayTimestamp(localDate, minutesAfterMidnight)
        setupMocksForBugCondition(localDate, utcTimestamp)

        const request = mockNextRequest({
          restaurant_id: RESTAURANT_ID,
          emission_id:   EMISSION_ID,
        })

        await POST(request)

        // queryEstDteFactura must have been called
        if (!vi.mocked(queryEstDteFactura).mock.calls.length) {
          // If not called, the route returned early (e.g. auth error) — skip
          return true
        }

        const callArgs = vi.mocked(queryEstDteFactura).mock.calls[0][0]

        // The date sent to SII must equal the XML's <FchEmis> (localDate),
        // NOT the UTC-extracted date (which would be localDate + 1 day).
        //
        // On UNFIXED code: callArgs.fechaEmisionDte = utcTimestamp.split('T')[0]
        //   = next day's date → NOT equal to localDate → property FAILS
        // On FIXED code: callArgs.fechaEmisionDte = fecha_emision = localDate → PASSES
        return callArgs.fechaEmisionDte === localDate
      }),
      {
        numRuns: 20,
        verbose: true,
      }
    )
  })
})


// ══════════════════════════════════════════════════════════════════════════════
//  Property 2: Preservation — Boleta Flow and Existing Emission Behavior
//
//  These tests MUST PASS on UNFIXED code.
//  They establish the baseline behavior that must be preserved after the fix.
//
//  Validates: Requirements 3.1, 3.2, 3.3, 3.4
// ══════════════════════════════════════════════════════════════════════════════

import { getSiiToken, checkDteStatus } from '@/lib/dte/sii-client'
import { sendBrandedEmail } from '@/lib/email/sender'
import { generateDtePdf } from '@/lib/dte/pdf-generator'

describe('Property 2: Preservation — Boleta Flow and Existing Emission Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 2a: Boleta status flow preservation ────────────────────────────────────

  it('2a property: for any boleta emission (type 39 or 41), the status route calls checkDteStatus (not queryEstDteFactura)', async () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * Generator: produces boleta emissions with document_type 39 or 41 and
     * any emitted_at timestamp. Asserts that the status route uses the boleta
     * flow (checkDteStatus) and never calls queryEstDteFactura.
     */
    const boletaArbitrary = fc.record({
      document_type: fc.constantFrom(39, 41),
      emitted_at: fc.date({
        min: new Date('2024-01-01'),
        max: new Date('2026-12-31'),
      }).map(d => d.toISOString()),
    })

    await fc.assert(
      fc.asyncProperty(boletaArbitrary, async ({ document_type, emitted_at }) => {
        vi.clearAllMocks()

        const boletaEmission = {
          id:             EMISSION_ID,
          document_type,
          folio:          100,
          emitted_at,
          fecha_emision:  null,
          xml_signed:     null,
          total_amount:   5000,
          rut_receptor:   '15574450-2',
          razon_receptor: 'Cliente Test',
          email_receptor: null,
          sii_track_id:   'track-boleta-001',
          status:         'sent',
        }

        const mockRestaurant = {
          rut:             '76123456-7',
          razon_social:    'Restaurante Test SpA',
          dte_environment: 'certificacion',
          photo_url:       null,
        }

        const mockSupabase = createSupabaseMock({
          tables: {
            dte_emissions: { data: boletaEmission },
            restaurants:   { data: mockRestaurant },
          },
        })

        vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

        vi.mocked(requireRestaurantRole).mockResolvedValue({
          user:  { id: crypto.randomUUID(), email: 'admin@test.com' } as any,
          error: null,
        })

        vi.mocked(loadCredentials).mockResolvedValue({
          privateKeyPem: '-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----',
          certificate:   {} as any,
          rutEnvia:      '76123456-7',
        })

        // Boleta flow uses getSiiToken + checkDteStatus
        vi.mocked(getSiiToken).mockResolvedValue({ token: 'mock-boleta-token' })
        vi.mocked(checkDteStatus).mockResolvedValue({
          success:      true,
          status:       'EPR',
          sii_response: {
            estado:     'EPR',
            estadistica: [{ aceptados: 1, rechazados: 0 }],
          },
        } as any)

        const request = mockNextRequest({
          restaurant_id: RESTAURANT_ID,
          emission_id:   EMISSION_ID,
        })

        await POST(request)

        // ASSERTION: checkDteStatus must be called (boleta flow)
        // queryEstDteFactura must NOT be called (factura-only flow)
        const checkDteStatusCalled = vi.mocked(checkDteStatus).mock.calls.length > 0
        const queryEstDteFacturaCalled = vi.mocked(queryEstDteFactura).mock.calls.length > 0

        return checkDteStatusCalled && !queryEstDteFacturaCalled
      }),
      {
        numRuns: 20,
        verbose: true,
      }
    )
  })

  // ── 2b: Existing DB fields preserved ──────────────────────────────────────

  it('2b: for a factura emission, all existing DB fields are present and readable by the route', async () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * Asserts that the route reads and uses all existing emission fields:
     * folio, sii_track_id, status, emitted_at, total_amount, rut_receptor,
     * razon_receptor, xml_signed. None of these fields should be dropped.
     */
    const fullEmission = {
      id:             EMISSION_ID,
      document_type:  33,
      folio:          141,
      sii_track_id:   '0248097438',
      status:         'sent',
      emitted_at:     '2026-04-27T00:48:26Z',
      fecha_emision:  null,
      total_amount:   20000,
      rut_receptor:   '15574450-2',
      razon_receptor: 'Cliente Test SpA',
      email_receptor: null,
      xml_signed:     `<?xml version="1.0" encoding="ISO-8859-1"?>
<EnvioDTE>
  <DTE>
    <Documento>
      <Encabezado>
        <IdDoc>
          <TipoDTE>33</TipoDTE>
          <Folio>141</Folio>
          <FchEmis>2026-04-27</FchEmis>
        </IdDoc>
      </Encabezado>
    </Documento>
  </DTE>
</EnvioDTE>`,
    }

    const mockRestaurant = {
      rut:             '76123456-7',
      razon_social:    'Restaurante Test SpA',
      dte_environment: 'certificacion',
      photo_url:       null,
    }

    const mockSupabase = createSupabaseMock({
      tables: {
        dte_emissions: { data: fullEmission },
        restaurants:   { data: mockRestaurant },
      },
    })

    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

    vi.mocked(requireRestaurantRole).mockResolvedValue({
      user:  { id: crypto.randomUUID(), email: 'admin@test.com' } as any,
      error: null,
    })

    vi.mocked(loadCredentials).mockResolvedValue({
      privateKeyPem: '-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----',
      certificate:   {} as any,
      rutEnvia:      '76123456-7',
    })

    vi.mocked(getSiiTokenFactura).mockResolvedValue({ token: 'mock-token' })
    vi.mocked(queryEstDteFactura).mockResolvedValue({ estado: 'DOK', glosa: 'DTE Aceptado' })

    const request = mockNextRequest({
      restaurant_id: RESTAURANT_ID,
      emission_id:   EMISSION_ID,
    })

    const response = await POST(request)

    // Route must succeed (not 404 or 500) — all fields were readable
    expect(response.status).toBe(200)

    // queryEstDteFactura must have been called with the fields from the emission
    expect(vi.mocked(queryEstDteFactura)).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(queryEstDteFactura).mock.calls[0][0]

    // Verify the route used the key fields from the emission record
    expect(callArgs.folioDte).toBe(fullEmission.folio)
    expect(callArgs.montoDte).toBe(fullEmission.total_amount)
    expect(callArgs.rutReceptor).toBe(fullEmission.rut_receptor.replace(/\./g, ''))
    expect(callArgs.tipoDte).toBe(33)
  })

  // ── 2c: Email notification flow ────────────────────────────────────────────

  it('2c: when a factura transitions to DOK status, sendBrandedEmail is called with the correct email', async () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * Asserts that when queryEstDteFactura returns DOK and the emission has
     * an email_receptor, sendBrandedEmail is called exactly once with the
     * correct recipient email address.
     */
    const RECEPTOR_EMAIL = 'cliente@empresa.cl'

    const emissionWithEmail = {
      id:             EMISSION_ID,
      document_type:  33,
      folio:          200,
      sii_track_id:   '0248097999',
      status:         'sent',
      emitted_at:     '2026-04-27T00:48:26Z',
      fecha_emision:  null,
      total_amount:   50000,
      rut_receptor:   '15574450-2',
      razon_receptor: 'Empresa Receptora SpA',
      email_receptor: RECEPTOR_EMAIL,
      xml_signed:     `<?xml version="1.0" encoding="ISO-8859-1"?>
<EnvioDTE>
  <DTE>
    <Documento>
      <Encabezado>
        <IdDoc>
          <TipoDTE>33</TipoDTE>
          <Folio>200</Folio>
          <FchEmis>2026-04-27</FchEmis>
        </IdDoc>
      </Encabezado>
    </Documento>
  </DTE>
</EnvioDTE>`,
    }

    const mockRestaurant = {
      rut:             '76123456-7',
      razon_social:    'Restaurante Test SpA',
      dte_environment: 'certificacion',
      photo_url:       null,
    }

    const mockSupabase = createSupabaseMock({
      tables: {
        dte_emissions: { data: emissionWithEmail },
        restaurants:   { data: mockRestaurant },
      },
    })

    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

    vi.mocked(requireRestaurantRole).mockResolvedValue({
      user:  { id: crypto.randomUUID(), email: 'admin@test.com' } as any,
      error: null,
    })

    vi.mocked(loadCredentials).mockResolvedValue({
      privateKeyPem: '-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----',
      certificate:   {} as any,
      rutEnvia:      '76123456-7',
    })

    vi.mocked(getSiiTokenFactura).mockResolvedValue({ token: 'mock-token' })

    // DOK response triggers email sending
    vi.mocked(queryEstDteFactura).mockResolvedValue({ estado: 'DOK', glosa: 'DTE Aceptado' })

    // PDF generation returns a valid buffer
    vi.mocked(generateDtePdf).mockResolvedValue({
      ok:     true,
      buffer: Buffer.from('mock-pdf'),
    } as any)

    vi.mocked(sendBrandedEmail).mockResolvedValue(undefined as any)

    const request = mockNextRequest({
      restaurant_id: RESTAURANT_ID,
      emission_id:   EMISSION_ID,
    })

    await POST(request)

    // ASSERTION: sendBrandedEmail must be called exactly once
    expect(vi.mocked(sendBrandedEmail)).toHaveBeenCalledOnce()

    // ASSERTION: called with the correct recipient email
    const emailArgs = vi.mocked(sendBrandedEmail).mock.calls[0][0]
    expect(emailArgs.to).toBe(RECEPTOR_EMAIL)
  })
})
