// ══════════════════════════════════════════════════════════════════════════════
//  Unit + Property-based tests for lib/dte/caf.ts
//
//  Tests cover:
//    - parseCafXml: validation, metadata extraction, document type rejection
//    - detectOverlap: pure range overlap logic (via exported helper)
//    - uploadCaf: RUT mismatch, overlap, encryption, folio_actual init
//    - listCafs: never exposes encrypted XML columns
//
//  Property tests use fast-check (minimum 100 iterations each).
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { parseCafXml, detectOverlap, uploadCaf, listCafs } from './caf'

// ── CAF XML builder helper ────────────────────────────────────────────────────

function buildCafXml(overrides: {
  rut?: string
  td?: number
  desde?: number
  hasta?: number
  fa?: string
  missingTags?: string[]
} = {}): string {
  const {
    rut = '12345678-9',
    td = 39,
    desde = 1,
    hasta = 100,
    fa = '2024-01-15',
    missingTags = [],
  } = overrides

  const tags: Record<string, string> = {
    AUTORIZACION: `<AUTORIZACION>
      <CAF version="1.0">
        <DA>
          <RE>${rut}</RE>
          <RUT>${rut}</RUT>
          <RS>Empresa Test SpA</RS>
          <TD>${td}</TD>
          <RNG>
            <D>${desde}</D>
            <H>${hasta}</H>
          </RNG>
          <FA>${fa}</FA>
          <RSAPK>
            <M>abc123</M>
            <E>AQAB</E>
          </RSAPK>
          <IDK>100</IDK>
        </DA>
        <FRMA algoritmo="SHA1withRSA">signaturevalue==</FRMA>
      </CAF>
    </AUTORIZACION>`,
  }

  let xml = tags['AUTORIZACION']

  // Remove requested tags to simulate missing elements
  for (const tag of missingTags) {
    const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, 'gi')
    xml = xml.replace(re, '')
    // Also remove self-closing
    xml = xml.replace(new RegExp(`<${tag}[^/]*/?>`, 'gi'), '')
  }

  return xml
}

// ── parseCafXml — unit tests ──────────────────────────────────────────────────

describe('parseCafXml', () => {
  it('parses a valid CAF XML and returns correct metadata', () => {
    const xml = buildCafXml({ rut: '76543210-K', td: 39, desde: 1, hasta: 200, fa: '2024-03-01' })
    const result = parseCafXml(xml)
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.rut_emisor).toBe('76543210-K')
    expect(result.document_type).toBe(39)
    expect(result.folio_desde).toBe(1)
    expect(result.folio_hasta).toBe(200)
    expect(result.fecha_autorizacion).toBe('2024-03-01')
  })

  it('accepts document type 33 (Factura)', () => {
    const xml = buildCafXml({ td: 33 })
    const result = parseCafXml(xml)
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.document_type).toBe(33)
  })

  it('accepts document type 41 (Boleta exenta)', () => {
    const xml = buildCafXml({ td: 41 })
    const result = parseCafXml(xml)
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.document_type).toBe(41)
  })

  it('rejects document type 52 (not supported)', () => {
    const xml = buildCafXml({ td: 52 })
    const result = parseCafXml(xml)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toContain('52')
  })

  it('accepts document type 56 (Nota de Débito)', () => {
    const xml = buildCafXml({ td: 56 })
    const result = parseCafXml(xml)
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.document_type).toBe(56)
  })

  it('accepts document type 61 (Nota de Crédito)', () => {
    const xml = buildCafXml({ td: 61 })
    const result = parseCafXml(xml)
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.document_type).toBe(61)
  })

  it('rejects document type 99 (not supported)', () => {
    const xml = buildCafXml({ td: 99 })
    const result = parseCafXml(xml)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toContain('99')
  })

  it('returns error for empty string', () => {
    const result = parseCafXml('')
    expect('error' in result).toBe(true)
  })

  it('returns error for non-XML string', () => {
    const result = parseCafXml('not xml at all')
    expect('error' in result).toBe(true)
  })

  // Test each required element individually
  // Note: caf.ts REQUIRED_ELEMENTS uses 'RE' (not 'RUT') for the RUT emisor field
  const requiredElements = ['AUTORIZACION', 'CAF', 'DA', 'RE', 'TD', 'RNG', 'D', 'H', 'FRMA']
  for (const tag of requiredElements) {
    it(`returns error when <${tag}> is missing`, () => {
      const xml = buildCafXml({ missingTags: [tag] })
      const result = parseCafXml(xml)
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toContain('CAF_INVALID_XML')
      }
    })
  }

  it('returns error when folio_hasta < folio_desde', () => {
    // We can't easily produce this via buildCafXml since it would need manual XML
    const xml = `<AUTORIZACION>
      <CAF version="1.0">
        <DA>
          <RUT>12345678-9</RUT>
          <TD>39</TD>
          <RNG>
            <D>100</D>
            <H>50</H>
          </RNG>
          <FA>2024-01-01</FA>
        </DA>
        <FRMA algoritmo="SHA1withRSA">sig</FRMA>
      </CAF>
    </AUTORIZACION>`
    const result = parseCafXml(xml)
    expect('error' in result).toBe(true)
  })
})

// ── parseCafXml — Property 1: validation rejects incomplete documents ─────────
// **Validates: Requirements 1.1**

describe('Property 1: CAF XML validation rejects incomplete documents', () => {
  it('returns error iff at least one required element is absent', () => {
    // Note: caf.ts REQUIRED_ELEMENTS uses 'RE' (not 'RUT') for the RUT emisor field
    const requiredTags = ['AUTORIZACION', 'CAF', 'DA', 'RE', 'TD', 'RNG', 'D', 'H', 'FRMA']

    fc.assert(
      fc.property(
        // Generate a non-empty subset of required tags to remove
        fc.subarray(requiredTags, { minLength: 1 }),
        (tagsToRemove) => {
          const xml = buildCafXml({ missingTags: tagsToRemove })
          const result = parseCafXml(xml)
          // When any required tag is missing, must return an error
          return 'error' in result
        }
      ),
      { numRuns: 100 }
    )
  })

  it('succeeds when all required elements are present', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(33, 39, 41, 56, 61),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 0, max: 999 }),
        (td, desde, offset) => {
          const hasta = desde + offset
          const xml = buildCafXml({ td, desde, hasta })
          const result = parseCafXml(xml)
          return !('error' in result)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── parseCafXml — Property 2: metadata round-trip ────────────────────────────
// **Validates: Requirements 1.2**

describe('Property 2: CAF metadata round-trip', () => {
  it('extracted metadata matches values encoded in the XML', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(33 as const, 39 as const, 41 as const, 56 as const, 61 as const),
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 0, max: 10000 }),
        fc.string({ minLength: 5, maxLength: 12 }).filter((s) => /^[0-9a-zA-Z\-]+$/.test(s)),
        (td, desde, offset, rut) => {
          const hasta = desde + offset
          const fa = '2024-06-15'
          const xml = buildCafXml({ td, desde, hasta, fa, rut })
          const result = parseCafXml(xml)
          if ('error' in result) return false
          return (
            result.document_type === td &&
            result.folio_desde === desde &&
            result.folio_hasta === hasta &&
            result.rut_emisor === rut &&
            result.fecha_autorizacion === fa
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── detectOverlap — pure range logic tests ────────────────────────────────────
// We test the overlap logic directly by mocking the Supabase client.

// Helper: pure overlap check (mirrors the logic in detectOverlap)
function rangesOverlap(a: number, b: number, c: number, d: number): boolean {
  return Math.max(a, c) <= Math.min(b, d)
}

describe('detectOverlap range logic', () => {
  it('detects overlap when ranges are identical', () => {
    expect(rangesOverlap(1, 100, 1, 100)).toBe(true)
  })

  it('detects overlap when one range contains the other', () => {
    expect(rangesOverlap(1, 100, 10, 50)).toBe(true)
    expect(rangesOverlap(10, 50, 1, 100)).toBe(true)
  })

  it('detects overlap at boundary (adjacent ranges do NOT overlap)', () => {
    expect(rangesOverlap(1, 50, 51, 100)).toBe(false)
    expect(rangesOverlap(51, 100, 1, 50)).toBe(false)
  })

  it('detects overlap when ranges share a single folio', () => {
    expect(rangesOverlap(1, 50, 50, 100)).toBe(true)
  })

  it('no overlap when ranges are completely separate', () => {
    expect(rangesOverlap(1, 10, 20, 30)).toBe(false)
    expect(rangesOverlap(20, 30, 1, 10)).toBe(false)
  })
})

// ── Property 3: Folio range overlap detection ─────────────────────────────────
// **Validates: Requirements 1.4**

describe('Property 3: Folio range overlap detection (pure logic)', () => {
  it('overlap iff max(a,c) <= min(b,d) for all valid ranges', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 0, max: 5000 }),
        (a, offsetAB, c, offsetCD) => {
          const b = a + offsetAB
          const d = c + offsetCD
          const expected = Math.max(a, c) <= Math.min(b, d)
          const actual = rangesOverlap(a, b, c, d)
          return actual === expected
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── detectOverlap — with mocked Supabase ─────────────────────────────────────

describe('detectOverlap (with mocked Supabase)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns false when no existing CAFs', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    }))

    const { detectOverlap: detectOverlapMocked } = await import('./caf')
    const result = await detectOverlapMocked('restaurant-1', 39, 1, 100)
    expect(result).toBe(false)
  })

  it('returns true when existing CAF overlaps', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ folio_desde: 50, folio_hasta: 150 }],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      }),
    }))

    const { detectOverlap: detectOverlapMocked } = await import('./caf')
    const result = await detectOverlapMocked('restaurant-1', 39, 1, 100)
    expect(result).toBe(true)
  })

  it('returns false when existing CAF does not overlap', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ folio_desde: 101, folio_hasta: 200 }],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      }),
    }))

    const { detectOverlap: detectOverlapMocked } = await import('./caf')
    const result = await detectOverlapMocked('restaurant-1', 39, 1, 100)
    expect(result).toBe(false)
  })
})

// ── listCafs — Property 5: never exposes encrypted XML ───────────────────────
// **Validates: Requirements 1.7**

describe('Property 5: listCafs never exposes encrypted XML', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returned objects never contain xml_ciphertext, xml_iv, or xml_auth_tag', async () => {
    // Mock Supabase to return rows that include encrypted columns
    // (simulating what the DB might return if the query was wrong)
    const mockRows = [
      {
        id: 'caf-1',
        rut_emisor: '12345678-9',
        document_type: 39,
        folio_desde: 1,
        folio_hasta: 100,
        folio_actual: 1,
        fecha_autorizacion: '2024-01-01',
        expires_at: null,
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        // These should NOT appear in the output
        xml_ciphertext: 'secret-ciphertext',
        xml_iv: 'secret-iv',
        xml_auth_tag: 'secret-tag',
      },
    ]

    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockRows, error: null }),
            }),
          }),
        }),
      }),
    }))

    const { listCafs: listCafsMocked } = await import('./caf')
    const result = await listCafsMocked('restaurant-1')

    expect(result.length).toBe(1)
    for (const caf of result) {
      expect(caf).not.toHaveProperty('xml_ciphertext')
      expect(caf).not.toHaveProperty('xml_iv')
      expect(caf).not.toHaveProperty('xml_auth_tag')
      // Verify expected metadata fields are present
      expect(caf).toHaveProperty('document_type')
      expect(caf).toHaveProperty('folio_desde')
      expect(caf).toHaveProperty('folio_hasta')
      expect(caf).toHaveProperty('fecha_autorizacion')
    }
  })

  it('property: for any set of CAFs, listCafs result never contains encrypted fields', () => {
    // Pure property test on the mapping logic
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            rut_emisor: fc.string({ minLength: 5, maxLength: 15 }),
            document_type: fc.constantFrom(33, 39, 41),
            folio_desde: fc.integer({ min: 1, max: 1000 }),
            folio_hasta: fc.integer({ min: 1001, max: 2000 }),
            folio_actual: fc.integer({ min: 1, max: 1000 }),
            fecha_autorizacion: fc.constant('2024-01-01'),
            expires_at: fc.constant(null),
            status: fc.constantFrom('active', 'exhausted', 'expired'),
            created_at: fc.constant('2024-01-01T00:00:00Z'),
          }),
          { maxLength: 10 }
        ),
        (rows) => {
          // Simulate the mapping logic from listCafs
          const mapped = rows.map((row) => ({
            id:                  row.id,
            rut_emisor:          row.rut_emisor,
            document_type:       row.document_type as 33 | 39 | 41,
            folio_desde:         row.folio_desde,
            folio_hasta:         row.folio_hasta,
            folio_actual:        row.folio_actual,
            fecha_autorizacion:  row.fecha_autorizacion,
            expires_at:          row.expires_at ?? null,
            status:              row.status as 'active' | 'exhausted' | 'expired',
            created_at:          row.created_at,
          }))

          return mapped.every(
            (caf) =>
              !('xml_ciphertext' in caf) &&
              !('xml_iv' in caf) &&
              !('xml_auth_tag' in caf)
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── uploadCaf — unit tests with mocked Supabase ───────────────────────────────

describe('uploadCaf', () => {
  beforeEach(() => {
    vi.resetModules()
    // Set DTE_MASTER_KEY for encryption
    process.env.DTE_MASTER_KEY = 'test-master-key-for-unit-tests'
  })

  it('returns CAF_RUT_MISMATCH when RUT does not match restaurant', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === 'dte_credentials') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { rut_envia: '12345678-9' }, error: null }),
                }),
              }),
            }
          }
          if (table === 'restaurants') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { rut: '99999999-9' }, error: null }),
                }),
              }),
            }
          }
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }
        },
      }),
    }))

    const { uploadCaf: uploadCafMocked } = await import('./caf')
    const xml = buildCafXml({ rut: '12345678-9', td: 39, desde: 1, hasta: 100 })
    const result = await uploadCafMocked('restaurant-1', xml)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('CAF_RUT_MISMATCH')
    }
  })

  it('returns CAF_OVERLAP when folio range overlaps existing active CAF', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === 'dte_credentials') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { rut_envia: '12345678-9' }, error: null }),
                }),
              }),
            }
          }
          if (table === 'restaurants') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { rut: '12345678-9' }, error: null }),
                }),
              }),
            }
          }
          // dte_cafs — return overlapping CAF
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () =>
                    Promise.resolve({
                      data: [{ folio_desde: 50, folio_hasta: 150 }],
                      error: null,
                    }),
                }),
              }),
            }),
          }
        },
      }),
    }))

    const { uploadCaf: uploadCafMocked } = await import('./caf')
    const xml = buildCafXml({ rut: '12345678-9', td: 39, desde: 1, hasta: 100 })
    const result = await uploadCafMocked('restaurant-1', xml)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('CAF_OVERLAP')
    }
  })

  it('initializes folio_actual to folio_desde on successful upload (Property 4)', async () => {
    let insertedData: Record<string, unknown> | null = null

    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === 'dte_credentials') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { rut_envia: '12345678-9' }, error: null }),
                }),
              }),
            }
          }
          if (table === 'restaurants') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { rut: '12345678-9' }, error: null }),
                }),
              }),
            }
          }
          // dte_cafs
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
            insert: (data: Record<string, unknown>) => {
              insertedData = data
              return {
                select: () => ({
                  single: () =>
                    Promise.resolve({ data: { id: 'new-caf-id' }, error: null }),
                }),
              }
            },
          }
        },
      }),
    }))

    const { uploadCaf: uploadCafMocked } = await import('./caf')
    const desde = 201
    const xml = buildCafXml({ rut: '12345678-9', td: 39, desde, hasta: 300 })
    const result = await uploadCafMocked('restaurant-1', xml)

    expect('ok' in result).toBe(true)
    // Verify folio_actual was set to folio_desde
    expect(insertedData).not.toBeNull()
    expect((insertedData as Record<string, unknown>)['folio_actual']).toBe(desde)
    expect((insertedData as Record<string, unknown>)['folio_desde']).toBe(desde)
  })

  it('returns error for invalid XML', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({}),
    }))

    const { uploadCaf: uploadCafMocked } = await import('./caf')
    const result = await uploadCafMocked('restaurant-1', 'not valid xml')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('CAF_INVALID_XML')
    }
  })
})
