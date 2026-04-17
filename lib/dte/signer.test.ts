// ══════════════════════════════════════════════════════════════════════════════
//  Unit + Property-based tests for lib/dte/signer.ts
//
//  Tests cover:
//    - buildDteXml: field presence, IVA calculation, type-41 exemption,
//                   type-33 receptor fields
//    - signDte: CERT_NOT_FOUND, CERT_EXPIRED, successful signing
//
//  Property tests use fast-check (minimum 100 iterations each).
//
//  Properties:
//    10 — IVA calculation identity: neto + iva == total
//    11 — DTE XML contains all required fields
//    12 — Boleta exenta (type 41) omits IVA fields
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { buildDteXml, signDte, type DteInput, type DteLineItem } from './signer'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<DteInput> = {}): DteInput {
  return {
    document_type:   39,
    folio:           1,
    fecha_emision:   '2024-06-15',
    rut_emisor:      '76543210-K',
    razon_social:    'Restaurante Test SpA',
    giro:            'Restaurante',
    direccion:       'Av. Providencia 123',
    comuna:          'Providencia',
    total_amount:    11900,
    items:           [{ name: 'Café', quantity: 1, unit_price: 11900 }],
    ...overrides,
  }
}

// ── buildDteXml — unit tests ──────────────────────────────────────────────────

describe('buildDteXml', () => {
  it('returns a string', () => {
    const xml = buildDteXml(makeInput())
    expect(typeof xml).toBe('string')
    expect(xml.length).toBeGreaterThan(0)
  })

  it('includes TipoDTE with the correct document type', () => {
    const xml = buildDteXml(makeInput({ document_type: 39 }))
    expect(xml).toContain('<TipoDTE>39</TipoDTE>')
  })

  it('includes Folio', () => {
    const xml = buildDteXml(makeInput({ folio: 42 }))
    expect(xml).toContain('<Folio>42</Folio>')
  })

  it('includes FchEmis', () => {
    const xml = buildDteXml(makeInput({ fecha_emision: '2024-12-31' }))
    expect(xml).toContain('<FchEmis>2024-12-31</FchEmis>')
  })

  it('includes RUTEmisor', () => {
    const xml = buildDteXml(makeInput({ rut_emisor: '12345678-9' }))
    expect(xml).toContain('<RUTEmisor>12345678-9</RUTEmisor>')
  })

  it('includes RznSocEmisor', () => {
    const xml = buildDteXml(makeInput({ razon_social: 'Mi Empresa SpA' }))
    expect(xml).toContain('<RznSocEmisor>Mi Empresa SpA</RznSocEmisor>')
  })

  it('includes GiroEmisor', () => {
    const xml = buildDteXml(makeInput({ giro: 'Comercio al por menor' }))
    expect(xml).toContain('<GiroEmisor>Comercio al por menor</GiroEmisor>')
  })

  it('includes DirOrigen', () => {
    const xml = buildDteXml(makeInput({ direccion: 'Calle Falsa 123' }))
    expect(xml).toContain('<DirOrigen>Calle Falsa 123</DirOrigen>')
  })

  it('includes CmnaOrigen', () => {
    const xml = buildDteXml(makeInput({ comuna: 'Santiago' }))
    expect(xml).toContain('<CmnaOrigen>Santiago</CmnaOrigen>')
  })

  it('includes Totales element', () => {
    const xml = buildDteXml(makeInput())
    expect(xml).toContain('<Totales>')
    expect(xml).toContain('</Totales>')
  })

  // ── IVA calculation for types 33 and 39 ──────────────────────────────────

  it('computes correct neto and IVA for type 39 (total=11900)', () => {
    // neto = round(11900 / 1.19) = round(10000) = 10000
    // iva  = 11900 - 10000 = 1900
    const xml = buildDteXml(makeInput({ document_type: 39, total_amount: 11900 }))
    expect(xml).toContain('<MntNeto>10000</MntNeto>')
    expect(xml).toContain('<IVA>1900</IVA>')
    expect(xml).toContain('<MntTotal>11900</MntTotal>')
  })

  it('computes correct neto and IVA for type 33 (total=23800)', () => {
    // neto = round(23800 / 1.19) = round(20000) = 20000
    // iva  = 23800 - 20000 = 3800
    const xml = buildDteXml(
      makeInput({
        document_type:   33,
        total_amount:    23800,
        rut_receptor:    '11111111-1',
        razon_receptor:  'Cliente Test',
      })
    )
    expect(xml).toContain('<MntNeto>20000</MntNeto>')
    expect(xml).toContain('<IVA>3800</IVA>')
    expect(xml).toContain('<MntTotal>23800</MntTotal>')
  })

  // ── Type 41 — Boleta exenta ───────────────────────────────────────────────

  it('uses MntExe instead of MntNeto for type 41', () => {
    const xml = buildDteXml(makeInput({ document_type: 41, total_amount: 5000 }))
    expect(xml).toContain('<MntExe>5000</MntExe>')
    expect(xml).toContain('<MntTotal>5000</MntTotal>')
  })

  it('omits TasaIVA for type 41', () => {
    const xml = buildDteXml(makeInput({ document_type: 41 }))
    expect(xml).not.toContain('<TasaIVA>')
  })

  it('omits IVA element for type 41', () => {
    const xml = buildDteXml(makeInput({ document_type: 41 }))
    expect(xml).not.toContain('<IVA>')
  })

  it('omits MntNeto for type 41', () => {
    const xml = buildDteXml(makeInput({ document_type: 41 }))
    expect(xml).not.toContain('<MntNeto>')
  })

  // ── Type 33 — Factura receptor fields ────────────────────────────────────

  it('includes RUTRecep and RznSocRecep for type 33', () => {
    const xml = buildDteXml(
      makeInput({
        document_type:   33,
        rut_receptor:    '22222222-2',
        razon_receptor:  'Empresa Receptora Ltda',
      })
    )
    expect(xml).toContain('<RUTRecep>22222222-2</RUTRecep>')
    expect(xml).toContain('<RznSocRecep>Empresa Receptora Ltda</RznSocRecep>')
  })

  it('uses generic RUTRecep 66666666-6 for type 39 (boleta)', () => {
    const xml = buildDteXml(makeInput({ document_type: 39 }))
    expect(xml).toContain('<RUTRecep>66666666-6</RUTRecep>')
    expect(xml).toContain('<RznSocRecep>Sin RUT</RznSocRecep>')
  })

  it('uses generic RUTRecep 66666666-6 for type 41 (boleta exenta)', () => {
    const xml = buildDteXml(makeInput({ document_type: 41 }))
    expect(xml).toContain('<RUTRecep>66666666-6</RUTRecep>')
    expect(xml).toContain('<RznSocRecep>Sin RUT</RznSocRecep>')
  })

  // ── Line items ────────────────────────────────────────────────────────────

  it('includes Detalle elements for each line item', () => {
    const items: DteLineItem[] = [
      { name: 'Cafe', quantity: 2, unit_price: 1500 },
      { name: 'Agua', quantity: 1, unit_price: 800 },
    ]
    const xml = buildDteXml(makeInput({ items }))
    expect(xml).toContain('<NmbItem>Cafe</NmbItem>')
    expect(xml).toContain('<NmbItem>Agua</NmbItem>')
    expect(xml).toContain('<NroLinDet>1</NroLinDet>')
    expect(xml).toContain('<NroLinDet>2</NroLinDet>')
  })

  it('escapes XML special characters in text fields', () => {
    const xml = buildDteXml(
      makeInput({ razon_social: 'Empresa & Hijos <SpA>' })
    )
    expect(xml).toContain('Empresa &amp; Hijos &lt;SpA&gt;')
    expect(xml).not.toContain('Empresa & Hijos <SpA>')
  })
})

// ── Property 10: IVA calculation identity ────────────────────────────────────
// **Validates: Requirements 3.7**

describe('Property 10: IVA calculation identity', () => {
  it('neto + iva == total for any positive integer total (type 39)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        (total) => {
          const xml = buildDteXml(makeInput({ document_type: 39, total_amount: total }))

          // Extract MntNeto and IVA from the XML
          const netoMatch = /<MntNeto>(\d+)<\/MntNeto>/.exec(xml)
          const ivaMatch  = /<IVA>(\d+)<\/IVA>/.exec(xml)
          const totalMatch = /<MntTotal>(\d+)<\/MntTotal>/.exec(xml)

          if (!netoMatch || !ivaMatch || !totalMatch) return false

          const neto  = parseInt(netoMatch[1], 10)
          const iva   = parseInt(ivaMatch[1], 10)
          const mntTotal = parseInt(totalMatch[1], 10)

          return neto + iva === total && mntTotal === total
        }
      ),
      { numRuns: 200 }
    )
  })

  it('neto + iva == total for any positive integer total (type 33)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        (total) => {
          const xml = buildDteXml(
            makeInput({
              document_type:   33,
              total_amount:    total,
              rut_receptor:    '11111111-1',
              razon_receptor:  'Test',
            })
          )

          const netoMatch  = /<MntNeto>(\d+)<\/MntNeto>/.exec(xml)
          const ivaMatch   = /<IVA>(\d+)<\/IVA>/.exec(xml)
          const totalMatch = /<MntTotal>(\d+)<\/MntTotal>/.exec(xml)

          if (!netoMatch || !ivaMatch || !totalMatch) return false

          const neto     = parseInt(netoMatch[1], 10)
          const iva      = parseInt(ivaMatch[1], 10)
          const mntTotal = parseInt(totalMatch[1], 10)

          return neto + iva === total && mntTotal === total
        }
      ),
      { numRuns: 200 }
    )
  })

  it('neto equals Math.round(total / 1.19) for any positive integer total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        (total) => {
          const xml = buildDteXml(makeInput({ document_type: 39, total_amount: total }))
          const netoMatch = /<MntNeto>(\d+)<\/MntNeto>/.exec(xml)
          if (!netoMatch) return false
          const neto = parseInt(netoMatch[1], 10)
          return neto === Math.round(total / 1.19)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 11: DTE XML contains all required fields ────────────────────────
// **Validates: Requirements 3.1, 3.2**

describe('Property 11: DTE XML contains all required fields', () => {
  const requiredFields = [
    'TipoDTE',
    'Folio',
    'FchEmis',
    'RUTEmisor',
    'RznSocEmisor',
    'GiroEmisor',
    'DirOrigen',
    'CmnaOrigen',
    'Totales',
  ]

  it('all required fields are present for type 39', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (folio, total) => {
          const xml = buildDteXml(makeInput({ document_type: 39, folio, total_amount: total }))
          return requiredFields.every((field) => xml.includes(`<${field}`) || xml.includes(`<${field}>`))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('all required fields are present for type 33', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (folio, total) => {
          const xml = buildDteXml(
            makeInput({
              document_type:   33,
              folio,
              total_amount:    total,
              rut_receptor:    '11111111-1',
              razon_receptor:  'Test',
            })
          )
          return requiredFields.every((field) => xml.includes(`<${field}`) || xml.includes(`<${field}>`))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('all required fields are present for type 41', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (folio, total) => {
          const xml = buildDteXml(makeInput({ document_type: 41, folio, total_amount: total }))
          return requiredFields.every((field) => xml.includes(`<${field}`) || xml.includes(`<${field}>`))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('type 33 includes RUTRecep and RznSocRecep for any input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        fc.string({ minLength: 5, maxLength: 15 }).filter((s) => /^[0-9a-zA-Z\-]+$/.test(s)),
        fc.string({ minLength: 3, maxLength: 50 }).filter((s) => !/[<>&"']/.test(s)),
        (folio, rut, razon) => {
          const xml = buildDteXml(
            makeInput({
              document_type:   33,
              folio,
              rut_receptor:    rut,
              razon_receptor:  razon,
            })
          )
          return xml.includes('<RUTRecep>') && xml.includes('<RznSocRecep>')
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 12: Boleta exenta (type 41) omits IVA fields ────────────────────
// **Validates: Requirements 3.8**

describe('Property 12: Boleta exenta (type 41) omits IVA fields', () => {
  it('type 41 never contains TasaIVA or IVA elements', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (folio, total) => {
          const xml = buildDteXml(makeInput({ document_type: 41, folio, total_amount: total }))
          return !xml.includes('<TasaIVA>') && !xml.includes('<IVA>')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('type 41 always contains MntExe', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (folio, total) => {
          const xml = buildDteXml(makeInput({ document_type: 41, folio, total_amount: total }))
          return xml.includes('<MntExe>')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('type 41 never contains MntNeto', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (folio, total) => {
          const xml = buildDteXml(makeInput({ document_type: 41, folio, total_amount: total }))
          return !xml.includes('<MntNeto>')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('MntExe equals total_amount for type 41', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        (total) => {
          const xml = buildDteXml(makeInput({ document_type: 41, total_amount: total }))
          const mntExeMatch   = new RegExp(`<MntExe>${total}</MntExe>`).test(xml)
          const mntTotalMatch = new RegExp(`<MntTotal>${total}</MntTotal>`).test(xml)
          return mntExeMatch && mntTotalMatch
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── signDte — unit tests with mocked Supabase ─────────────────────────────────

describe('signDte', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.DTE_MASTER_KEY = 'test-master-key-for-unit-tests'
  })

  it('returns CERT_NOT_FOUND when no credential row exists', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }))

    const { signDte: signDteMocked } = await import('./signer')
    const xml = buildDteXml(makeInput())
    const result = await signDteMocked('restaurant-1', xml)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('CERT_NOT_FOUND')
    }
  })

  it('returns CERT_NOT_FOUND when Supabase query errors', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      }),
    }))

    const { signDte: signDteMocked } = await import('./signer')
    const xml = buildDteXml(makeInput())
    const result = await signDteMocked('restaurant-1', xml)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('CERT_NOT_FOUND')
    }
  })

  it('returns CERT_EXPIRED when cert_valid_to is in the past', async () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // yesterday

    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    cert_ciphertext: 'fake',
                    cert_iv:         'fake',
                    cert_auth_tag:   'fake',
                    pass_ciphertext: 'fake',
                    pass_iv:         'fake',
                    pass_auth_tag:   'fake',
                    cert_valid_to:   pastDate,
                  },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    }))

    const { signDte: signDteMocked } = await import('./signer')
    const xml = buildDteXml(makeInput())
    const result = await signDteMocked('restaurant-1', xml)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('CERT_EXPIRED')
    }
  })

  it('returns CERT_EXPIRED when cert_valid_to is exactly now (boundary)', async () => {
    // A cert that expired 1 second ago
    const justExpired = new Date(Date.now() - 1000).toISOString()

    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    cert_ciphertext: 'fake',
                    cert_iv:         'fake',
                    cert_auth_tag:   'fake',
                    pass_ciphertext: 'fake',
                    pass_iv:         'fake',
                    pass_auth_tag:   'fake',
                    cert_valid_to:   justExpired,
                  },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    }))

    const { signDte: signDteMocked } = await import('./signer')
    const xml = buildDteXml(makeInput())
    const result = await signDteMocked('restaurant-1', xml)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('CERT_EXPIRED')
    }
  })

  it('returns signed_xml with Signature element when given a valid PFX', async () => {
    // Generate a self-signed test certificate with node-forge
    const forge = await import('node-forge')

    const keys = forge.pki.rsa.generateKeyPair(1024) // small key for test speed
    const cert  = forge.pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = '01'
    cert.validity.notBefore = new Date(Date.now() - 1000 * 60)
    cert.validity.notAfter  = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
    const attrs = [{ name: 'commonName', value: 'Test DTE' }]
    cert.setSubject(attrs)
    cert.setIssuer(attrs)
    cert.sign(keys.privateKey, forge.md.sha1.create())

    // Build PFX
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'test-password')
    const p12Der  = forge.asn1.toDer(p12Asn1).bytes()
    const pfxBuf  = Buffer.from(p12Der, 'binary')

    // Encrypt PFX and password using the real encrypt function
    const { encrypt } = await import('@/lib/crypto/aes')
    const certBlob = encrypt(pfxBuf)
    const passBlob = encrypt('test-password')

    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()

    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    cert_ciphertext: certBlob.ciphertext,
                    cert_iv:         certBlob.iv,
                    cert_auth_tag:   certBlob.authTag,
                    pass_ciphertext: passBlob.ciphertext,
                    pass_iv:         passBlob.iv,
                    pass_auth_tag:   passBlob.authTag,
                    cert_valid_to:   futureDate,
                  },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    }))

    const { signDte: signDteMocked } = await import('./signer')
    const xml = buildDteXml(makeInput())
    const result = await signDteMocked('restaurant-1', xml)

    expect('signed_xml' in result).toBe(true)
    if ('signed_xml' in result) {
      expect(result.signed_xml).toContain('<Signature')
      expect(result.signed_xml).toContain('<SignedInfo')
      expect(result.signed_xml).toContain('<SignatureValue>')
      expect(result.signed_xml).toContain('<KeyInfo>')
    }
  })

  it('signed XML still contains the original DTE content', async () => {
    const forge = await import('node-forge')

    const keys = forge.pki.rsa.generateKeyPair(1024)
    const cert  = forge.pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = '02'
    cert.validity.notBefore = new Date(Date.now() - 1000 * 60)
    cert.validity.notAfter  = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
    const attrs = [{ name: 'commonName', value: 'Test DTE 2' }]
    cert.setSubject(attrs)
    cert.setIssuer(attrs)
    cert.sign(keys.privateKey, forge.md.sha1.create())

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'pw2')
    const p12Der  = forge.asn1.toDer(p12Asn1).bytes()
    const pfxBuf  = Buffer.from(p12Der, 'binary')

    const { encrypt } = await import('@/lib/crypto/aes')
    const certBlob = encrypt(pfxBuf)
    const passBlob = encrypt('pw2')

    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()

    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    cert_ciphertext: certBlob.ciphertext,
                    cert_iv:         certBlob.iv,
                    cert_auth_tag:   certBlob.authTag,
                    pass_ciphertext: passBlob.ciphertext,
                    pass_iv:         passBlob.iv,
                    pass_auth_tag:   passBlob.authTag,
                    cert_valid_to:   futureDate,
                  },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    }))

    const { signDte: signDteMocked } = await import('./signer')
    const input = makeInput({ folio: 99, total_amount: 11900 })
    const xml   = buildDteXml(input)
    const result = await signDteMocked('restaurant-1', xml)

    expect('signed_xml' in result).toBe(true)
    if ('signed_xml' in result) {
      // Original content preserved
      expect(result.signed_xml).toContain('<TipoDTE>39</TipoDTE>')
      expect(result.signed_xml).toContain('<Folio>99</Folio>')
      expect(result.signed_xml).toContain('<MntTotal>11900</MntTotal>')
    }
  })
})
