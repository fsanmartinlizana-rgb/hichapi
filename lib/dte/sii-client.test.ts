// ══════════════════════════════════════════════════════════════════════════════
//  Unit tests for lib/dte/sii-client.ts
//
//  Tests cover:
//    - getSiiTokenFactura: SOAP seed/token flow, error handling
//    - sendFacturaToSII: multipart upload, XML response parsing
//    - queryEstDteFactura: SOAP QueryEstDte, estado/glosa extraction
//    - sendDteToSII: boleta multipart upload, JSON response parsing
//
//  All tests mock global fetch to avoid real network calls.
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getSiiTokenFactura,
  sendFacturaToSII,
  queryEstDteFactura,
  sendDteToSII,
  type SiiEnvironment,
} from './sii-client'
import * as forge from 'node-forge'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates a mock fetch that returns the given response text. */
function mockFetch(responseText: string, status = 200) {
  return vi.fn().mockResolvedValue({
    ok:   status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(responseText),
    json: () => Promise.resolve(JSON.parse(responseText)),
  })
}

/** Builds a SOAP seed response (getSeedReturn with HTML-encoded XML). */
function buildSeedSoapResponse(semilla: string, estado = '00'): string {
  const innerXml = `&lt;?xml version=&quot;1.0&quot;?&gt;&lt;RESP_BODY&gt;&lt;SEMILLA&gt;${semilla}&lt;/SEMILLA&gt;&lt;ESTADO&gt;${estado}&lt;/ESTADO&gt;&lt;/RESP_BODY&gt;`
  return `<soapenv:Envelope><soapenv:Body><getSeedResponse><getSeedReturn>${innerXml}</getSeedReturn></getSeedResponse></soapenv:Body></soapenv:Envelope>`
}

/** Builds a SOAP token response (getTokenReturn with HTML-encoded XML). */
function buildTokenSoapResponse(token: string, estado = '00'): string {
  const innerXml = `&lt;?xml version=&quot;1.0&quot;?&gt;&lt;SII:RESP_BODY&gt;&lt;SII:TOKEN&gt;${token}&lt;/SII:TOKEN&gt;&lt;SII:ESTADO&gt;${estado}&lt;/SII:ESTADO&gt;&lt;/SII:RESP_BODY&gt;`
  return `<soapenv:Envelope><soapenv:Body><getTokenResponse><getTokenReturn>${innerXml}</getTokenReturn></getTokenResponse></soapenv:Body></soapenv:Envelope>`
}

/** Builds a DTEUpload XML response. */
function buildDteUploadResponse(estado: string, trackId?: string, glosa?: string): string {
  const trackPart = trackId ? `<TRACKID>${trackId}</TRACKID>` : ''
  const glosaPart = glosa  ? `<GLOSA>${glosa}</GLOSA>`        : ''
  return `<?xml version="1.0"?><RECEPCIONDTE><ESTADO>${estado}</ESTADO>${trackPart}${glosaPart}</RECEPCIONDTE>`
}

/** Builds a QueryEstDte SOAP response. */
function buildQueryEstDteResponse(estado: string, glosa?: string): string {
  const glosaPart = glosa ? `<SII:GLOSA_ESTADO>${glosa}</SII:GLOSA_ESTADO>` : ''
  return `<soapenv:Envelope><soapenv:Body><getEstDteResponse><SII:RESPUESTA><SII:RESP_HDR><SII:ESTADO>${estado}</SII:ESTADO>${glosaPart}</SII:RESP_HDR></SII:RESPUESTA></getEstDteResponse></soapenv:Body></soapenv:Envelope>`
}

/** Builds a minimal test certificate for signing. */
async function buildTestCert(): Promise<{ privateKeyPem: string; certificate: forge.pki.Certificate }> {
  const keys = forge.pki.rsa.generateKeyPair(512) // small key for test speed
  const cert  = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date(Date.now() - 1000 * 60)
  cert.validity.notAfter  = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
  const attrs = [{ name: 'commonName', value: 'Test DTE' }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha1.create())
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    certificate: cert,
  }
}

const SAMPLE_SIGNED_XML = `<?xml version="1.0" encoding="ISO-8859-1"?><EnvioDTE version="1.0"><SetDTE ID="LibreDTE_SetDoc"></SetDTE></EnvioDTE>`
const SAMPLE_RUT_EMISOR = '76543210-K'
const SAMPLE_RUT_ENVIA  = '12345678-9'

// ── getSiiTokenFactura ────────────────────────────────────────────────────────

describe('getSiiTokenFactura', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns token on successful SOAP flow', async () => {
    const { privateKeyPem, certificate } = await buildTestCert()

    // First call: seed, second call: token
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(buildSeedSoapResponse('123456789')),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(buildTokenSoapResponse('MY-TOKEN-ABC')),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getSiiTokenFactura(privateKeyPem, certificate, 'certificacion')

    expect('token' in result).toBe(true)
    if ('token' in result) {
      expect(result.token).toBe('MY-TOKEN-ABC')
    }
  })

  it('returns AUTH_ERROR_SEMILLA when seed response has no getSeedReturn', async () => {
    const { privateKeyPem, certificate } = await buildTestCert()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<soapenv:Envelope><soapenv:Body><empty/></soapenv:Body></soapenv:Envelope>'),
    }))

    const result = await getSiiTokenFactura(privateKeyPem, certificate, 'certificacion')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('AUTH_ERROR_SEMILLA')
    }
  })

  it('returns AUTH_ERROR_SEMILLA when seed estado is not 00', async () => {
    const { privateKeyPem, certificate } = await buildTestCert()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildSeedSoapResponse('123', '99')),
    }))

    const result = await getSiiTokenFactura(privateKeyPem, certificate, 'certificacion')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('AUTH_ERROR_SEMILLA')
    }
  })

  it('returns AUTH_ERROR_SEMILLA when seed HTTP request fails', async () => {
    const { privateKeyPem, certificate } = await buildTestCert()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    }))

    const result = await getSiiTokenFactura(privateKeyPem, certificate, 'certificacion')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('AUTH_ERROR_SEMILLA')
    }
  })

  it('returns AUTH_ERROR_TOKEN when token response has no getTokenReturn', async () => {
    const { privateKeyPem, certificate } = await buildTestCert()

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(buildSeedSoapResponse('123456789')),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<soapenv:Envelope><soapenv:Body><empty/></soapenv:Body></soapenv:Envelope>'),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getSiiTokenFactura(privateKeyPem, certificate, 'certificacion')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('AUTH_ERROR_TOKEN')
    }
  })

  it('uses maullin.sii.cl for certificacion environment', async () => {
    const { privateKeyPem, certificate } = await buildTestCert()

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(buildSeedSoapResponse('123456789')),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(buildTokenSoapResponse('TOKEN')),
      })
    vi.stubGlobal('fetch', fetchMock)

    await getSiiTokenFactura(privateKeyPem, certificate, 'certificacion')

    const firstCallUrl = fetchMock.mock.calls[0][0] as string
    expect(firstCallUrl).toContain('maullin.sii.cl')
  })

  it('uses palena.sii.cl for produccion environment', async () => {
    const { privateKeyPem, certificate } = await buildTestCert()

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(buildSeedSoapResponse('123456789')),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(buildTokenSoapResponse('TOKEN')),
      })
    vi.stubGlobal('fetch', fetchMock)

    await getSiiTokenFactura(privateKeyPem, certificate, 'produccion')

    const firstCallUrl = fetchMock.mock.calls[0][0] as string
    expect(firstCallUrl).toContain('palena.sii.cl')
  })

  it('returns NETWORK_ERROR when fetch throws', async () => {
    const { privateKeyPem, certificate } = await buildTestCert()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    const result = await getSiiTokenFactura(privateKeyPem, certificate, 'certificacion')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('NETWORK_ERROR')
    }
  })
})

// ── sendFacturaToSII ──────────────────────────────────────────────────────────

describe('sendFacturaToSII', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns success with track_id when SII responds with ESTADO=OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildDteUploadResponse('OK', '12345')),
    }))

    const result = await sendFacturaToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN-ABC', 'certificacion'
    )

    expect(result.success).toBe(true)
    expect(result.track_id).toBe('12345')
  })

  it('returns success with track_id when SII responds with ESTADO=EPR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildDteUploadResponse('EPR', '67890')),
    }))

    const result = await sendFacturaToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN-ABC', 'certificacion'
    )

    expect(result.success).toBe(true)
    expect(result.track_id).toBe('67890')
  })

  it('returns failure when SII responds with error ESTADO', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildDteUploadResponse('ERR', undefined, 'RUT inválido')),
    }))

    const result = await sendFacturaToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN-ABC', 'certificacion'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('SII_UPLOAD_ERROR')
    expect(result.message).toContain('RUT inválido')
  })

  it('returns failure when HTTP request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    }))

    const result = await sendFacturaToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN-ABC', 'certificacion'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('SII_UPLOAD_ERROR')
  })

  it('uses maullin.sii.cl for certificacion environment', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildDteUploadResponse('OK', '111')),
    })
    vi.stubGlobal('fetch', fetchMock)

    await sendFacturaToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN', 'certificacion'
    )

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('maullin.sii.cl')
  })

  it('uses palena.sii.cl for produccion environment', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildDteUploadResponse('OK', '222')),
    })
    vi.stubGlobal('fetch', fetchMock)

    await sendFacturaToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN', 'produccion'
    )

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('palena.sii.cl')
  })

  it('sends TOKEN cookie in headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildDteUploadResponse('OK', '333')),
    })
    vi.stubGlobal('fetch', fetchMock)

    await sendFacturaToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'MY-TOKEN', 'certificacion'
    )

    const callOptions = fetchMock.mock.calls[0][1] as RequestInit
    const headers = callOptions.headers as Record<string, string>
    expect(headers['Cookie']).toContain('MY-TOKEN')
  })

  it('returns NETWORK_ERROR when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    const result = await sendFacturaToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN', 'certificacion'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('NETWORK_ERROR')
  })
})

// ── queryEstDteFactura ────────────────────────────────────────────────────────

describe('queryEstDteFactura', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const baseParams = {
    rutConsultante: '12345678-9',
    rutCompania:    '76543210-K',
    rutReceptor:    '11111111-1',
    tipoDte:        33,
    folioDte:       42,
    fechaEmisionDte: '2024-06-15',
    montoDte:       11900,
    token:          'TOKEN-ABC',
  }

  it('returns estado and glosa on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildQueryEstDteResponse('DOK', 'Documento aceptado')),
    }))

    const result = await queryEstDteFactura(baseParams, 'certificacion')

    expect('estado' in result).toBe(true)
    if ('estado' in result) {
      expect(result.estado).toBe('DOK')
      expect(result.glosa).toBe('Documento aceptado')
    }
  })

  it('returns estado without glosa when GLOSA_ESTADO is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildQueryEstDteResponse('RCH')),
    }))

    const result = await queryEstDteFactura(baseParams, 'certificacion')

    expect('estado' in result).toBe(true)
    if ('estado' in result) {
      expect(result.estado).toBe('RCH')
      expect(result.glosa).toBeUndefined()
    }
  })

  it('returns PARSE_ERROR_ESTADO when response has no ESTADO', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<soapenv:Envelope><soapenv:Body><empty/></soapenv:Body></soapenv:Envelope>'),
    }))

    const result = await queryEstDteFactura(baseParams, 'certificacion')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('PARSE_ERROR_ESTADO')
    }
  })

  it('returns HTTP_ERROR when request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    }))

    const result = await queryEstDteFactura(baseParams, 'certificacion')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('HTTP_ERROR')
    }
  })

  it('uses maullin.sii.cl for certificacion environment', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildQueryEstDteResponse('DOK')),
    })
    vi.stubGlobal('fetch', fetchMock)

    await queryEstDteFactura(baseParams, 'certificacion')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('maullin.sii.cl')
  })

  it('uses palena.sii.cl for produccion environment', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildQueryEstDteResponse('DOK')),
    })
    vi.stubGlobal('fetch', fetchMock)

    await queryEstDteFactura(baseParams, 'produccion')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('palena.sii.cl')
  })

  it('converts fecha from YYYY-MM-DD to ddMMyyyy in SOAP body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(buildQueryEstDteResponse('DOK')),
    })
    vi.stubGlobal('fetch', fetchMock)

    await queryEstDteFactura({ ...baseParams, fechaEmisionDte: '2024-06-15' }, 'certificacion')

    const callOptions = fetchMock.mock.calls[0][1] as RequestInit
    const body = callOptions.body as string
    // YYYY-MM-DD → ddMMyyyy: 2024-06-15 → 15062024
    expect(body).toContain('15062024')
  })

  it('returns error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    const result = await queryEstDteFactura(baseParams, 'certificacion')

    expect('error' in result).toBe(true)
  })
})

// ── sendDteToSII (boleta) ─────────────────────────────────────────────────────

describe('sendDteToSII', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns success with track_id when SII responds with trackid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({ trackid: '99999', estado: 'EPR' }),
    }))

    const result = await sendDteToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN-ABC', 'certificacion'
    )

    expect(result.success).toBe(true)
    expect(result.track_id).toBe('99999')
  })

  it('returns failure when SII response has no trackid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({ estado: 'ERR' }),
    }))

    const result = await sendDteToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN-ABC', 'certificacion'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('SII_INVALID_RESPONSE')
  })

  it('returns failure when HTTP request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    }))

    const result = await sendDteToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN-ABC', 'certificacion'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('SII_UPLOAD_ERROR')
  })

  it('sends TOKEN cookie in headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({ trackid: '111' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await sendDteToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'MY-TOKEN', 'certificacion'
    )

    const callOptions = fetchMock.mock.calls[0][1] as RequestInit
    const headers = callOptions.headers as Record<string, string>
    expect(headers['Cookie']).toContain('MY-TOKEN')
  })

  it('returns NETWORK_ERROR when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    const result = await sendDteToSII(
      SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN', 'certificacion'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('NETWORK_ERROR')
  })
})

// ── Environment type coverage ─────────────────────────────────────────────────

describe('environment type coverage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const environments: SiiEnvironment[] = ['certificacion', 'produccion']

  for (const env of environments) {
    it(`sendFacturaToSII works for environment: ${env}`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(buildDteUploadResponse('OK', '55555')),
      }))
      const result = await sendFacturaToSII(
        SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN', env
      )
      expect('success' in result).toBe(true)
    })

    it(`sendDteToSII works for environment: ${env}`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({ trackid: '55555' }),
      }))
      const result = await sendDteToSII(
        SAMPLE_SIGNED_XML, SAMPLE_RUT_EMISOR, SAMPLE_RUT_ENVIA, 'TOKEN', env
      )
      expect('success' in result).toBe(true)
    })
  }
})
