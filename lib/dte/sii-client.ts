// ══════════════════════════════════════════════════════════════════════════════
//  SII_Client — lib/dte/sii-client.ts
//
//  Native Node.js Client for authentication and sending DTEs to SII.
// ══════════════════════════════════════════════════════════════════════════════

import { signSeed } from './signer'
import * as forge from 'node-forge'

export type SiiEnvironment = 'certificacion' | 'produccion'

interface SendDteResponse {
  success: boolean
  track_id?: string
  status?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sii_response?: any
  error?: string
  message?: string
}

interface CheckStatusResponse {
  success: boolean
  status?: string
  accepted?: boolean
  error_detail?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sii_response?: any
  error?: string
  message?: string
}

/**
 * URLs del SII
 */
const SII_ENDPOINTS = {
  certificacion: {
    semilla: 'https://apicert.sii.cl/recursos/v1/boleta.electronica.semilla',
    token:   'https://apicert.sii.cl/recursos/v1/boleta.electronica.token',
    envio:   'https://pangal.sii.cl/recursos/v1/boleta.electronica.envio',
    estado:  'https://apicert.sii.cl/recursos/v1/boleta.electronica.envio',
  },
  produccion: {
    semilla: 'https://api.sii.cl/recursos/v1/boleta.electronica.semilla',
    token:   'https://api.sii.cl/recursos/v1/boleta.electronica.token',
    envio:   'https://rahue.sii.cl/recursos/v1/boleta.electronica.envio', // TBD verificar si rahue o pinga
    estado:  'https://api.sii.cl/recursos/v1/boleta.electronica.envio',
  }
}

/**
 * URLs del SII para Factura Electrónica (tipo 33, 56, 61) — endpoints SOAP
 */
const SII_ENDPOINTS_FACTURA = {
  certificacion: {
    semilla:     'https://maullin.sii.cl/DTEWS/CrSeed.jws',
    token:       'https://maullin.sii.cl/DTEWS/GetTokenFromSeed.jws',
    envio:       'https://maullin.sii.cl/cgi_dte/UPL/DTEUpload',
    queryEstDte: 'https://maullin.sii.cl/DTEWS/QueryEstDte.jws',
  },
  produccion: {
    semilla:     'https://palena.sii.cl/DTEWS/CrSeed.jws',
    token:       'https://palena.sii.cl/DTEWS/GetTokenFromSeed.jws',
    envio:       'https://palena.sii.cl/cgi_dte/UPL/DTEUpload',
    queryEstDte: 'https://palena.sii.cl/DTEWS/QueryEstDte.jws',
  }
}

// ── Authentication ────────────────────────────────────────────────────────────

/**
 * Obtiene el token del SII solicitando la semilla, firmándola y emitiéndola
 */
export async function getSiiToken(
  privateKeyPem: string,
  certificate: forge.pki.Certificate,
  environment: SiiEnvironment = 'certificacion'
): Promise<{ token?: string; error?: string; message?: string }> {
  try {
    const urls = SII_ENDPOINTS[environment]

    // 1. Obtener Semilla
    const seedRes = await fetch(urls.semilla, {
      method: 'GET',
      headers: { 'Accept': 'application/xml' }
    })
    
    if (!seedRes.ok) {
      return { error: 'AUTH_ERROR_SEMILLA', message: `HTTP ${seedRes.status}` }
    }
    
    const seedXml = await seedRes.text()
    
    // Parsear el XML simple (usamos regex para evitar dependencias pesadas de DOM en esta parte simple)
    const seedMatch = /<SEMILLA>([^<]+)<\/SEMILLA>/.exec(seedXml)
    const estadoMatch = /<ESTADO>([^<]+)<\/ESTADO>/.exec(seedXml)

    if (!seedMatch || estadoMatch?.[1] !== '00') {
      return { error: 'AUTH_ERROR_SEMILLA', message: 'Semilla inválida o estado distinto a 00' }
    }
    const seed = seedMatch[1]

    // 2. Firmar Semilla
    let signedSeedReq = ''
    try {
      signedSeedReq = signSeed(seed, privateKeyPem, certificate)
    } catch (e) {
      console.error('getSiiToken: error signing seed:', e)
      return { error: 'AUTH_ERROR_FIRMA_SOLICITUD_TOKEN', message: String(e) }
    }

    // 3. Obtener Token
    const tokenRes = await fetch(urls.token, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; LibreDTE)',
        'Referer': 'https://sii.cl',
        'Content-Type': 'application/xml'
      },
      body: signedSeedReq
    })

    if (!tokenRes.ok) {
      return { error: 'AUTH_ERROR_TOKEN', message: `HTTP ${tokenRes.status}` }
    }

    const tokenXml = await tokenRes.text()
    const tokenValMatch = /<TOKEN>([^<]+)<\/TOKEN>/.exec(tokenXml)
    const tokenEstadoMatch = /<ESTADO>([^<]+)<\/ESTADO>/.exec(tokenXml)

    if (!tokenValMatch || tokenEstadoMatch?.[1] !== '00') {
      return { error: 'AUTH_ERROR_TOKEN', message: 'Token inválido o estado distinto a 00' }
    }

    return { token: tokenValMatch[1] }

  } catch (err) {
    console.error('getSiiToken network error:', err)
    return { error: 'NETWORK_ERROR', message: String(err) }
  }
}

// ── Emission ──────────────────────────────────────────────────────────────────

/**
 * Envia el DTE firmado al SII medianto FormData multipart.
 */
export async function sendDteToSII(
  signedXml: string,
  rutEmisor: string,
  rutEnvia: string,
  token: string,
  environment: SiiEnvironment = 'certificacion'
): Promise<SendDteResponse> {
  try {
    const urls = SII_ENDPOINTS[environment]
    
    const cleanRutEmisor = rutEmisor.replace(/\./g, '')
    const cleanRutEnvia = rutEnvia.replace(/\./g, '')

    const [rutCompany, dvCompany] = cleanRutEmisor.split('-')
    const [rutSender, dvSender] = cleanRutEnvia.split('-')

    const boundary = '----WebKitFormBoundarySII' + Math.random().toString(16).slice(2)
    const CRLF = '\r\n'

    const xmlPartFilename = `dte_${Date.now()}.xml`
    
    // Conviértelo explícitamente a latin1 ya que la cabecera indica ISO-8859-1
    const xmlBuffer = Buffer.from(signedXml, 'latin1')
    
    // Construct payload buffers manually to guarantee exact Content-Length
    const payloadChunks: Buffer[] = []

    const textParts = [
      { name: 'rutSender', value: rutSender },
      { name: 'dvSender', value: dvSender },
      { name: 'rutCompany', value: rutCompany },
      { name: 'dvCompany', value: dvCompany },
    ]

    for (const part of textParts) {
      payloadChunks.push(Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="${part.name}"${CRLF}${CRLF}` +
        `${part.value}${CRLF}`, 'latin1'
      ))
    }

    payloadChunks.push(Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="archivo"; filename="${xmlPartFilename}"${CRLF}` +
      `Content-Type: application/xml${CRLF}${CRLF}`, 'latin1'
    ))
    
    payloadChunks.push(xmlBuffer)
    payloadChunks.push(Buffer.from(CRLF, 'latin1'))
    payloadChunks.push(Buffer.from(`--${boundary}--${CRLF}`, 'latin1'))

    const bodyBuffer = Buffer.concat(payloadChunks)

    const response = await fetch(urls.envio, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; LibreDTE)',
        'Referer': 'https://sii.cl',
        'Cookie': `TOKEN=${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(bodyBuffer.length),
        'Connection': 'keep-alive'
      },
      body: bodyBuffer
    })

    if (!response.ok) {
      let errText = ''
      try { errText = await response.text() } catch (_) {}
      return {
        success: false,
        error: 'SII_UPLOAD_ERROR',
        message: `HTTP ${response.status} - ${errText}`
      }
    }

    const json = await response.json()

    if (!json || !json.trackid) {
      return {
        success: false,
        error: 'SII_INVALID_RESPONSE',
        message: 'No trackid supplied by SII',
        sii_response: json
      }
    }

    return {
      success: true,
      track_id: String(json.trackid),
      status: json.estado,
      sii_response: json
    }

  } catch (error) {
    console.error('sendDteToSII error:', error)
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Consulta el estado del DTE en el SII
 */
export async function checkDteStatus(
  trackId: string,
  rutEmisor: string,
  token: string,
  environment: SiiEnvironment = 'certificacion'
): Promise<CheckStatusResponse> {
  try {
    const urls = SII_ENDPOINTS[environment]
    
    // TBD (not fully spec'd in current PHP, kept here for structural integrity)
    const [rutSender, dvSender] = rutEmisor.replace(/\./g, '').split('-')
    const url = `${urls.estado}/${rutSender}-${dvSender}-${trackId}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; Windows NT)',
        'Referer': 'https://your-domain.cl',
        'Cookie': `TOKEN=${token}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      return {
        success: false,
        error: 'HTTP_ERROR',
        message: `HTTP ${response.status}`
      }
    }

    const data = await response.json()
    return {
      success: true,
      status: data.estado,
      sii_response: data
    }

  } catch (error) {
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Network error',
    }
  }
}

// ── Factura SOAP Authentication ───────────────────────────────────────────────

/**
 * Decodifica HTML entities básicas en una cadena.
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Obtiene el token del SII para factura electrónica (tipo 33/56/61) usando
 * los endpoints SOAP de maullin (certificación) o palena (producción).
 */
export async function getSiiTokenFactura(
  privateKeyPem: string,
  certificate: forge.pki.Certificate,
  environment: SiiEnvironment = 'certificacion'
): Promise<{ token?: string; error?: string; message?: string }> {
  try {
    const urls = SII_ENDPOINTS_FACTURA[environment]

    // ── Paso 1: Obtener semilla vía SOAP ──────────────────────────────────────
    const seedEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Body><getSeed/></soapenv:Body>
</soapenv:Envelope>`

    const seedRes = await fetch(urls.semilla, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': '',
        'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; LibreDTE)',
      },
      body: seedEnvelope,
    })

    if (!seedRes.ok) {
      return { error: 'AUTH_ERROR_SEMILLA', message: `HTTP ${seedRes.status}` }
    }

    const seedSoapXml = await seedRes.text()

    // El SII devuelve <getSeedReturn xsi:type="xsd:string">...HTML-encoded XML...</getSeedReturn>
    // El tag de apertura puede tener atributos, por eso usamos [^>]* para ignorarlos.
    const seedReturnMatch = /<(?:\w+:)?getSeedReturn[^>]*>([\s\S]*?)<\/(?:\w+:)?getSeedReturn>/.exec(seedSoapXml)
    if (!seedReturnMatch) {
      return { error: 'AUTH_ERROR_SEMILLA', message: `No se encontró getSeedReturn. Respuesta: ${seedSoapXml.slice(0, 300)}` }
    }

    // Decodificar HTML entities y extraer <SEMILLA>
    const seedInnerXml = decodeHtmlEntities(seedReturnMatch[1])
    const semillaMatch = /<SEMILLA>([^<]+)<\/SEMILLA>/.exec(seedInnerXml)
    const estadoSemillaMatch = /<ESTADO>([^<]+)<\/ESTADO>/.exec(seedInnerXml)

    if (!semillaMatch || estadoSemillaMatch?.[1] !== '00') {
      return {
        error: 'AUTH_ERROR_SEMILLA',
        message: `Semilla inválida o estado distinto a 00. Estado: ${estadoSemillaMatch?.[1] ?? 'desconocido'}`,
      }
    }

    const seed = semillaMatch[1]

    // ── Paso 2: Firmar semilla ────────────────────────────────────────────────
    let signedSeedXml = ''
    try {
      signedSeedXml = signSeed(seed, privateKeyPem, certificate)
    } catch (e) {
      console.error('getSiiTokenFactura: error signing seed:', e)
      return { error: 'AUTH_ERROR_FIRMA_SOLICITUD_TOKEN', message: String(e) }
    }

    // ── Paso 3: Obtener token vía SOAP ────────────────────────────────────────
    const tokenEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Body><getToken><pszXml><![CDATA[${signedSeedXml}]]></pszXml></getToken></soapenv:Body>
</soapenv:Envelope>`

    const tokenRes = await fetch(urls.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': '',
        'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; LibreDTE)',
      },
      body: tokenEnvelope,
    })

    if (!tokenRes.ok) {
      return { error: 'AUTH_ERROR_TOKEN', message: `HTTP ${tokenRes.status}` }
    }

    const tokenSoapXml = await tokenRes.text()

    // Mismo patrón: tag con atributos opcionales, contenido HTML-encoded
    const tokenReturnMatch = /<(?:\w+:)?getTokenReturn[^>]*>([\s\S]*?)<\/(?:\w+:)?getTokenReturn>/.exec(tokenSoapXml)
    if (!tokenReturnMatch) {
      return { error: 'AUTH_ERROR_TOKEN', message: `No se encontró getTokenReturn. Respuesta: ${tokenSoapXml.slice(0, 300)}` }
    }

    // Decodificar HTML entities y extraer <TOKEN> (puede tener namespace SII:)
    const tokenInnerXml = decodeHtmlEntities(tokenReturnMatch[1])
    const tokenValMatch = /<(?:SII:)?TOKEN>([^<]+)<\/(?:SII:)?TOKEN>/.exec(tokenInnerXml)
    const tokenEstadoMatch = /<(?:SII:)?ESTADO>([^<]+)<\/(?:SII:)?ESTADO>/.exec(tokenInnerXml)

    if (!tokenValMatch || tokenEstadoMatch?.[1] !== '00') {
      return {
        error: 'AUTH_ERROR_TOKEN',
        message: `Token inválido o estado distinto a 00. Estado: ${tokenEstadoMatch?.[1] ?? 'desconocido'}`,
      }
    }

    return { token: tokenValMatch[1] }

  } catch (err) {
    console.error('getSiiTokenFactura network error:', err)
    return { error: 'NETWORK_ERROR', message: String(err) }
  }
}

// ── Factura Emission ──────────────────────────────────────────────────────────

/**
 * Envía la factura electrónica firmada al SII mediante DTEUpload (multipart/form-data).
 *
 * maullin.sii.cl cierra el socket TLS abruptamente (ECONNRESET) después de enviar
 * la respuesta. Usamos https.request con un flag `gotResponse` para ignorar el
 * ECONNRESET cuando ya recibimos el HTTP response.
 */
export async function sendFacturaToSII(
  signedXml: string,
  rutEmisor: string,
  rutEnvia: string,
  token: string,
  environment: SiiEnvironment = 'certificacion'
): Promise<SendDteResponse> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const https = require('https') as typeof import('https')

  try {
    const urls = SII_ENDPOINTS_FACTURA[environment]

    const cleanRutEmisor = rutEmisor.replace(/\./g, '')
    const cleanRutEnvia  = rutEnvia.replace(/\./g, '')

    const [rutCompany, dvCompany] = cleanRutEmisor.split('-')
    const [rutSender,  dvSender]  = cleanRutEnvia.split('-')

    const boundary        = '----WebKitFormBoundarySII' + Math.random().toString(16).slice(2)
    const CRLF            = '\r\n'
    const xmlPartFilename = `dte_${Date.now()}.xml`
    const xmlBuffer       = Buffer.from(signedXml, 'latin1')

    // ── Build multipart body ────────────────────────────────────────────────
    const payloadChunks: Buffer[] = []
    for (const part of [
      { name: 'rutSender',  value: rutSender },
      { name: 'dvSender',   value: dvSender },
      { name: 'rutCompany', value: rutCompany },
      { name: 'dvCompany',  value: dvCompany },
    ]) {
      payloadChunks.push(Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="${part.name}"${CRLF}${CRLF}` +
        `${part.value}${CRLF}`, 'latin1'
      ))
    }
    payloadChunks.push(Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="archivo"; filename="${xmlPartFilename}"${CRLF}` +
      `Content-Type: application/xml${CRLF}${CRLF}`, 'latin1'
    ))
    payloadChunks.push(xmlBuffer)
    payloadChunks.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'latin1'))
    const bodyBuffer = Buffer.concat(payloadChunks)

    // ── Send via https.request (with retry on ECONNRESET) ──────────────────
    const parsedUrl = new URL(urls.envio)

    const doRequest = (): Promise<string> => new Promise<string>((resolve, reject) => {
      let settled     = false
      let gotResponse = false

      const done = (val: string) => { if (!settled) { settled = true; resolve(val) } }
      const fail = (err: Error)  => { if (!settled) { settled = true; reject(err) } }

      const req = https.request({
        hostname: parsedUrl.hostname,
        port:     443,
        path:     parsedUrl.pathname,
        method:   'POST',
        headers: {
          'User-Agent':     'Mozilla/4.0 (compatible; PROG 1.0; LibreDTE)',
          'Referer':        'https://sii.cl',
          'Cookie':         `TOKEN=${token}`,
          'Content-Type':   `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(bodyBuffer.length),
          'Connection':     'close',
        },
      }, (res) => {
        gotResponse = true
        const chunks: Buffer[] = []
        res.on('data',  (c: Buffer) => chunks.push(c))
        res.on('end',   () => done(Buffer.concat(chunks).toString('latin1')))
        res.on('close', () => { if (chunks.length > 0) done(Buffer.concat(chunks).toString('latin1')) })
        res.on('error', (e: Error) => {
          if (chunks.length > 0) done(Buffer.concat(chunks).toString('latin1'))
          else fail(e)
        })
      })

      req.on('error', (err: NodeJS.ErrnoException) => {
        // Si ya recibimos respuesta, ignorar errores de conexión posteriores
        if (gotResponse && (err.code === 'ECONNRESET' || err.message === 'socket hang up')) {
          // El SII cierra la conexión abruptamente después de enviar la respuesta
          // Esto es normal, no es un error
          return
        }
        fail(err)
      })

      req.write(bodyBuffer)
      req.end()
    })

    // Reintentar hasta 3 veces en caso de errores de conexión
    let responseXml = ''
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        responseXml = await doRequest()
        if (responseXml) break // Si tenemos respuesta, salir del loop
      } catch (err) {
        lastError = err as Error
        const errCode = (err as NodeJS.ErrnoException).code
        const isNetworkError = errCode === 'ECONNRESET' || 
                              errCode === 'ETIMEDOUT' ||
                              errCode === 'ENOTFOUND' ||
                              (err as Error).message === 'socket hang up' ||
                              (err as Error).message.includes('fetch failed')
        
        if (isNetworkError && attempt < 3) {
          console.warn(`sendFacturaToSII: Error de red en intento ${attempt} (${errCode || (err as Error).message}), reintentando...`)
          await new Promise(r => setTimeout(r, 1000 * attempt))
          continue
        }
        throw err
      }
    }
    if (!responseXml && lastError) throw lastError

    const estadoMatch  = /<ESTADO>([^<]+)<\/ESTADO>/.exec(responseXml)
    const trackIdMatch = /<TRACKID>([^<]+)<\/TRACKID>/.exec(responseXml)
    const statusMatch  = /<STATUS>([^<]+)<\/STATUS>/.exec(responseXml)

    const estado     = estadoMatch?.[1]?.trim()
    const trackId    = trackIdMatch?.[1]?.trim()
    const statusCode = statusMatch?.[1]?.trim()

    if (estado === 'OK' || estado === 'EPR' || statusCode === '0') {
      return { success: true, track_id: trackId, status: estado ?? statusCode, sii_response: responseXml }
    }

    const glosaMatch = /<(?:ERROR|GLOSA)>([^<]+)<\/(?:ERROR|GLOSA)>/.exec(responseXml)
    return {
      success:      false,
      error:        'SII_UPLOAD_ERROR',
      message:      glosaMatch?.[1] ?? `Estado SII: ${estado ?? statusCode ?? 'desconocido'}`,
      sii_response: responseXml,
    }

  } catch (error) {
    console.error('sendFacturaToSII error:', error)
    return { success: false, error: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Network error' }
  }
}

// ── Factura Status Query ──────────────────────────────────────────────────────

/**
 * Consulta el estado individual de una factura en el SII usando el servicio
 * SOAP QueryEstDte (getEstDte).
 */
export async function queryEstDteFactura(
  params: {
    rutConsultante: string
    rutCompania: string
    rutReceptor: string
    tipoDte: number
    folioDte: number
    fechaEmisionDte: string  // YYYY-MM-DD, se convierte a ddMMyyyy
    montoDte: number
    token: string
  },
  environment: SiiEnvironment = 'certificacion'
): Promise<{ estado?: string; glosa?: string; error?: string }> {
  try {
    const urls = SII_ENDPOINTS_FACTURA[environment]

    // Convertir fecha de YYYY-MM-DD a ddMMyyyy
    const fechaParts = params.fechaEmisionDte.split('-')
    const fechaDdMmYyyy = fechaParts.length === 3
      ? `${fechaParts[2]}${fechaParts[1]}${fechaParts[0]}`
      : params.fechaEmisionDte

    // Separar RUTs en rut/dv (quitar puntos, dividir en -)
    const [rutConsultante, dvConsultante] = params.rutConsultante.replace(/\./g, '').split('-')
    const [rutCompania, dvCompania] = params.rutCompania.replace(/\./g, '').split('-')
    const [rutReceptor, dvReceptor] = params.rutReceptor.replace(/\./g, '').split('-')

    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Body>
    <getEstDte xmlns="http://DefaultNamespace">
      <RutConsultante>${rutConsultante}</RutConsultante>
      <DvConsultante>${dvConsultante}</DvConsultante>
      <RutCompania>${rutCompania}</RutCompania>
      <DvCompania>${dvCompania}</DvCompania>
      <RutReceptor>${rutReceptor}</RutReceptor>
      <DvReceptor>${dvReceptor}</DvReceptor>
      <TipoDte>${params.tipoDte}</TipoDte>
      <FolioDte>${params.folioDte}</FolioDte>
      <FechaEmisionDte>${fechaDdMmYyyy}</FechaEmisionDte>
      <MontoDte>${params.montoDte}</MontoDte>
      <token>${params.token}</token>
    </getEstDte>
  </soapenv:Body>
</soapenv:Envelope>`

    const response = await fetch(urls.queryEstDte, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': '""',  // Empty string in quotes as required by SII SOAP server
        'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; LibreDTE)',
      },
      body: soapEnvelope,
    })

    if (!response.ok) {
      return { error: `HTTP_ERROR_${response.status}` }
    }

    const responseXml = await response.text()

    // La respuesta tiene el mismo patrón que getSeedReturn:
    // <ns1:getEstDteReturn xsi:type="xsd:string">...HTML-encoded XML...</ns1:getEstDteReturn>
    const returnMatch = /<(?:\w+:)?getEstDteReturn[^>]*>([\s\S]*?)<\/(?:\w+:)?getEstDteReturn>/.exec(responseXml)
    if (!returnMatch) {
      // Fallback: intentar parsear directamente si no hay wrapper
      const estadoDirecto = /<(?:SII:)?ESTADO>([^<]+)<\/(?:SII:)?ESTADO>/.exec(responseXml)
      if (estadoDirecto) {
        const glosaDirecta = /<(?:SII:)?GLOSA_ESTADO>([^<]+)<\/(?:SII:)?GLOSA_ESTADO>/.exec(responseXml)
        return { estado: estadoDirecto[1].trim(), glosa: glosaDirecta?.[1]?.trim() }
      }
      return { error: 'PARSE_ERROR_ESTADO' }
    }

    // Decodificar HTML entities (&#xd; = \r, &lt; = <, etc.)
    const innerXml = decodeHtmlEntities(returnMatch[1])
      .replace(/&#xd;/gi, '')   // carriage returns
      .replace(/&#xa;/gi, '\n') // line feeds

    // Extraer ESTADO y GLOSA_ESTADO del XML decodificado
    // Los elementos pueden tener o no el prefijo SII:
    const estadoMatch = /<(?:SII:)?ESTADO>([^<]+)<\/(?:SII:)?ESTADO>/.exec(innerXml)
    const glosaMatch  = /<(?:SII:)?GLOSA_ESTADO>([^<]+)<\/(?:SII:)?GLOSA_ESTADO>/.exec(innerXml)

    if (!estadoMatch) {
      return { error: 'PARSE_ERROR_ESTADO' }
    }

    return {
      estado: estadoMatch[1].trim(),
      glosa:  glosaMatch?.[1]?.trim(),
    }

  } catch (err) {
    console.error('queryEstDteFactura error:', err)
    // Categorize network errors properly
    if (err instanceof Error) {
      const errCode = (err as NodeJS.ErrnoException).code
      if (errCode === 'ECONNRESET' || errCode === 'ETIMEDOUT' || errCode === 'ENOTFOUND' || err.message.includes('fetch failed')) {
        return { error: 'NETWORK_ERROR' }
      }
    }
    return { error: String(err) }
  }
}
