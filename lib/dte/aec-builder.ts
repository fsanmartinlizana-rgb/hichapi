// ─────────────────────────────────────────────────────────────────────────────
// lib/dte/aec-builder.ts
//
// Genera los XMLs del proceso de intercambio DTE según LibreDTE / SII Chile.
//
// El proceso tiene 3 etapas cuando recibes una factura de un proveedor:
//
//  Etapa 1 — RecepcionDTE (015)
//    Confirma que recibiste el XML del DTE y que está bien formado.
//    XML: RespuestaEnvioDTE con RecepcionDTE por cada documento.
//    Se envía al emisor por email Y se sube al SII en pfeInternet.
//
//  Etapa 2 — EnvioRecibos (016)
//    Confirma que recibiste físicamente las mercaderías o servicios.
//    XML: EnvioRecibos con Recibo por cada documento.
//    Se envía al emisor por email Y se sube al SII en pfeInternet.
//
//  Etapa 3 — ResultadoDTE (017)
//    El resultado comercial: aceptado, rechazado o reclamado.
//    XML: RespuestaEnvioDTE con ResultadoDTE por cada documento.
//    Se envía al emisor por email Y se sube al SII en pfeInternet.
//
// Referencia: LibreDTE examples 015, 016, 017
// ─────────────────────────────────────────────────────────────────────────────

import * as crypto from 'crypto'
import * as forge  from 'node-forge'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type AecEstado = 'aceptado' | 'rechazado' | 'reclamado'

export interface AecDocumento {
  tipoDte:      number   // 33
  folio:        number
  fechaEmision: string   // YYYY-MM-DD
  rutEmisor:    string
  rutReceptor:  string
  montoTotal:   number
}

export interface AecBaseInput {
  // Datos del receptor (quien firma — el restaurante)
  rutReceptor:   string
  razonReceptor: string
  // Datos del emisor (proveedor)
  rutEmisor:     string
  razonEmisor:   string
  // Documento
  documento:     AecDocumento
  // Credenciales del receptor para firmar
  privateKeyPem: string
  certificate:   forge.pki.Certificate
}

export interface AecResultadoInput extends AecBaseInput {
  estado:  AecEstado
  glosa?:  string
}

// ── Códigos SII ───────────────────────────────────────────────────────────────

// Etapa 1 — estados de recepción del envío
const ESTADO_RECEP_ENV: Record<number, string> = {
  0: 'Envio Recibido OK',
  1: 'Envio Rechazado - Error de Schema',
  2: 'Envio Rechazado - Error de Firma',
  3: 'Envio Rechazado - RUT Receptor No Corresponde',
  90: 'Envio Rechazado - Archivo Repetido',
  91: 'Envio Rechazado - Archivo Ilegible',
  99: 'Envio Rechazado - Otros',
}

// Etapa 1 — estados de recepción por documento
const ESTADO_RECEP_DTE: Record<number, string> = {
  0: 'DTE Recibido OK',
  1: 'DTE No Recibido - Error de Firma',
  2: 'DTE No Recibido - Error en RUT Emisor',
  3: 'DTE No Recibido - Error en RUT Receptor',
  4: 'DTE No Recibido - DTE Repetido',
  99: 'DTE No Recibido - Otros',
}

// Etapa 3 — estados del resultado comercial
const ESTADO_RESULTADO: Record<string, { codigo: string; glosa: string }> = {
  aceptado:  { codigo: 'ACD', glosa: 'Acuse de recibo conforme' },
  rechazado: { codigo: 'RCD', glosa: 'Documento rechazado'      },
  reclamado: { codigo: 'ERM', glosa: 'Reclamo del receptor'     },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function nowTimestamp(): string {
  return new Date().toISOString().replace('Z', '').substring(0, 19)
}

function certToPem(cert: forge.pki.Certificate): string {
  return forge.pki.certificateToPem(cert)
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\r?\n/g, '')
    .trim()
}

function getModulus(privateKeyPem: string): string {
  try {
    const key = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey
    return forge.util.encode64(
      forge.util.hexToBytes(key.n.toString(16))
    ).replace(/(.{64})/g, '$1\n').trim()
  } catch {
    return ''
  }
}

/**
 * Firma un bloque XML con RSA-SHA1 y devuelve el bloque <Signature> completo.
 */
function firmarBloque(
  contenidoXml: string,
  elementId:    string,
  privateKeyPem: string,
  certificate:   forge.pki.Certificate,
): string {
  const digestBytes = crypto.createHash('sha1')
    .update(Buffer.from(contenidoXml, 'utf8'))
    .digest()
  const digestValue = digestBytes.toString('base64')

  const signedInfoForSigning =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${elementId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`

  const signedInfoXml =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${elementId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`

  const signer = crypto.createSign('RSA-SHA1')
  signer.update(signedInfoForSigning, 'utf8')
  const signatureValue = signer
    .sign({ key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING })
    .toString('base64')
    .replace(/(.{64})/g, '$1\n')
    .trim()

  const certPem      = certToPem(certificate)
  const certFormatted = certPem.replace(/(.{64})/g, '$1\n').trim()

  return (
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">\n` +
    `  ${signedInfoXml}\n` +
    `  <SignatureValue>${signatureValue}</SignatureValue>\n` +
    `  <KeyInfo>\n` +
    `    <KeyValue>\n` +
    `      <RSAKeyValue>\n` +
    `        <Modulus>${getModulus(privateKeyPem)}</Modulus>\n` +
    `        <Exponent>AQAB</Exponent>\n` +
    `      </RSAKeyValue>\n` +
    `    </KeyValue>\n` +
    `    <X509Data>\n` +
    `      <X509Certificate>${certFormatted}</X509Certificate>\n` +
    `    </X509Data>\n` +
    `  </KeyInfo>\n` +
    `</Signature>`
  )
}

// ── ETAPA 1: RecepcionDTE ─────────────────────────────────────────────────────

/**
 * Genera el XML RespuestaEnvioDTE de la Etapa 1 (RecepcionDTE).
 *
 * Confirma que el XML del DTE fue recibido y está bien formado.
 * Equivale al ejemplo 015-etapa_intercambio_RecepcionDTE.php de LibreDTE.
 *
 * @param input  Datos base del intercambio
 * @returns      XML firmado listo para enviar al emisor y subir al SII
 */
export function buildRecepcionDteXml(input: AecBaseInput): string {
  const { rutReceptor, rutEmisor, documento, privateKeyPem, certificate } = input
  const tmst    = nowTimestamp()
  const resultId = `RespDTE_Recep_${documento.folio}_${Date.now()}`

  // Estado 0 = recibido OK
  const estadoEnv = 0
  const estadoDte = 0

  const contenido =
    `<RespuestaEnvioDTE ID="${resultId}">\n` +
    `  <Caratula version="1.0">\n` +
    `    <RutResponde>${escapeXml(rutReceptor)}</RutResponde>\n` +
    `    <RutRecibe>${escapeXml(rutEmisor)}</RutRecibe>\n` +
    `    <IdRespuesta>1</IdRespuesta>\n` +
    `    <NmbContacto></NmbContacto>\n` +
    `    <MailContacto></MailContacto>\n` +
    `    <TmstFirmaResp>${tmst}</TmstFirmaResp>\n` +
    `  </Caratula>\n` +
    `  <RecepcionEnvio>\n` +
    `    <NmbEnvio>EnvioDTE_${documento.folio}.xml</NmbEnvio>\n` +
    `    <FchRecep>${tmst}</FchRecep>\n` +
    `    <CodEnvio>1</CodEnvio>\n` +
    `    <EnvioDTEID>1</EnvioDTEID>\n` +
    `    <Digest>0</Digest>\n` +
    `    <RutEmisor>${escapeXml(rutEmisor)}</RutEmisor>\n` +
    `    <RutReceptor>${escapeXml(rutReceptor)}</RutReceptor>\n` +
    `    <EstadoRecepEnv>${estadoEnv}</EstadoRecepEnv>\n` +
    `    <RecepEnvGlosa>${escapeXml(ESTADO_RECEP_ENV[estadoEnv])}</RecepEnvGlosa>\n` +
    `    <NroDTE>1</NroDTE>\n` +
    `    <RecepcionDTE>\n` +
    `      <TipoDTE>${documento.tipoDte}</TipoDTE>\n` +
    `      <Folio>${documento.folio}</Folio>\n` +
    `      <FchEmis>${documento.fechaEmision}</FchEmis>\n` +
    `      <RUTEmisor>${escapeXml(documento.rutEmisor)}</RUTEmisor>\n` +
    `      <RUTRecep>${escapeXml(documento.rutReceptor)}</RUTRecep>\n` +
    `      <MntTotal>${documento.montoTotal}</MntTotal>\n` +
    `      <EstadoRecepDTE>${estadoDte}</EstadoRecepDTE>\n` +
    `      <RecepDTEGlosa>${escapeXml(ESTADO_RECEP_DTE[estadoDte])}</RecepDTEGlosa>\n` +
    `    </RecepcionDTE>\n` +
    `  </RecepcionEnvio>\n` +
    `</RespuestaEnvioDTE>`

  const signature = firmarBloque(contenido, resultId, privateKeyPem, certificate)

  return (
    `<?xml version="1.0" encoding="ISO-8859-1"?>\n` +
    `<RespuestaEnvioDTE xmlns="http://www.sii.cl/SiiDte" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.sii.cl/SiiDte RespuestaEnvioDTE_v10.xsd" ` +
    `version="1.0">\n` +
    contenido + '\n' +
    signature + '\n' +
    `</RespuestaEnvioDTE>`
  )
}

// ── ETAPA 2: EnvioRecibos ─────────────────────────────────────────────────────

/**
 * Genera el XML EnvioRecibos de la Etapa 2.
 *
 * Confirma que se recibieron físicamente las mercaderías o servicios.
 * Equivale al ejemplo 016-etapa_intercambio_EnvioRecibos.php de LibreDTE.
 *
 * @param input   Datos base del intercambio
 * @param recinto Lugar donde se recibieron las mercaderías (ej: "Bodega central")
 * @returns       XML firmado listo para enviar al emisor y subir al SII
 */
export function buildEnvioRecibosXml(input: AecBaseInput, recinto = 'Oficina central'): string {
  const { rutReceptor, rutEmisor, documento, privateKeyPem, certificate } = input
  const tmst    = nowTimestamp()
  const setId   = `EnvioRecibos_${documento.folio}_${Date.now()}`

  const contenido =
    `<EnvioRecibos ID="${setId}">\n` +
    `  <SetRecibos ID="SetRecibos">\n` +
    `    <Caratula version="1.0">\n` +
    `      <RutResponde>${escapeXml(rutReceptor)}</RutResponde>\n` +
    `      <RutRecibe>${escapeXml(rutEmisor)}</RutRecibe>\n` +
    `      <NmbContacto></NmbContacto>\n` +
    `      <MailContacto></MailContacto>\n` +
    `      <TmstFirmaEnv>${tmst}</TmstFirmaEnv>\n` +
    `    </Caratula>\n` +
    `    <Recibo version="1.0">\n` +
    `      <DocumentoRecibo ID="Recibo_${documento.folio}">\n` +
    `        <TipoDoc>${documento.tipoDte}</TipoDoc>\n` +
    `        <Folio>${documento.folio}</Folio>\n` +
    `        <FchEmis>${documento.fechaEmision}</FchEmis>\n` +
    `        <RUTEmisor>${escapeXml(documento.rutEmisor)}</RUTEmisor>\n` +
    `        <RUTRecep>${escapeXml(documento.rutReceptor)}</RUTRecep>\n` +
    `        <MntTotal>${documento.montoTotal}</MntTotal>\n` +
    `        <Recinto>${escapeXml(recinto)}</Recinto>\n` +
    `        <RutFirma>${escapeXml(rutReceptor)}</RutFirma>\n` +
    `        <FchRecibo>${tmst}</FchRecibo>\n` +
    `      </DocumentoRecibo>\n` +
    `    </Recibo>\n` +
    `  </SetRecibos>\n` +
    `</EnvioRecibos>`

  const signature = firmarBloque(contenido, setId, privateKeyPem, certificate)

  return (
    `<?xml version="1.0" encoding="ISO-8859-1"?>\n` +
    `<EnvioRecibos xmlns="http://www.sii.cl/SiiDte" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.sii.cl/SiiDte EnvioRecibos_v10.xsd" ` +
    `version="1.0">\n` +
    contenido + '\n' +
    signature + '\n' +
    `</EnvioRecibos>`
  )
}

// ── ETAPA 3: ResultadoDTE ─────────────────────────────────────────────────────

/**
 * Genera el XML RespuestaEnvioDTE de la Etapa 3 (ResultadoDTE).
 *
 * El resultado comercial: aceptado (ACD), rechazado (RCD) o reclamado (ERM).
 * Equivale al ejemplo 017-etapa_intercambio_ResultadoDTE.php de LibreDTE.
 *
 * @param input  Datos del resultado con estado y glosa opcional
 * @returns      XML firmado listo para enviar al emisor y subir al SII
 */
export function buildResultadoDteXml(input: AecResultadoInput): string {
  const { rutReceptor, rutEmisor, documento, estado, glosa, privateKeyPem, certificate } = input
  const tmst    = nowTimestamp()
  const resultId = `RespDTE_Resultado_${documento.folio}_${Date.now()}`

  const estadoInfo = ESTADO_RESULTADO[estado]
  const glosaFinal = glosa ?? estadoInfo.glosa

  const contenido =
    `<RespuestaEnvioDTE ID="${resultId}">\n` +
    `  <Caratula version="1.0">\n` +
    `    <RutResponde>${escapeXml(rutReceptor)}</RutResponde>\n` +
    `    <RutRecibe>${escapeXml(rutEmisor)}</RutRecibe>\n` +
    `    <IdRespuesta>1</IdRespuesta>\n` +
    `    <NmbContacto></NmbContacto>\n` +
    `    <MailContacto></MailContacto>\n` +
    `    <TmstFirmaResp>${tmst}</TmstFirmaResp>\n` +
    `  </Caratula>\n` +
    `  <ResultadoDTE>\n` +
    `    <TipoDTE>${documento.tipoDte}</TipoDTE>\n` +
    `    <Folio>${documento.folio}</Folio>\n` +
    `    <FchEmis>${documento.fechaEmision}</FchEmis>\n` +
    `    <RUTEmisor>${escapeXml(documento.rutEmisor)}</RUTEmisor>\n` +
    `    <RUTRecep>${escapeXml(documento.rutReceptor)}</RUTRecep>\n` +
    `    <MntTotal>${documento.montoTotal}</MntTotal>\n` +
    `    <CodEnvio>1</CodEnvio>\n` +
    `    <EstadoDTE>${estadoInfo.codigo}</EstadoDTE>\n` +
    `    <EstadoDTEGlosa>${escapeXml(glosaFinal)}</EstadoDTEGlosa>\n` +
    `  </ResultadoDTE>\n` +
    `</RespuestaEnvioDTE>`

  const signature = firmarBloque(contenido, resultId, privateKeyPem, certificate)

  return (
    `<?xml version="1.0" encoding="ISO-8859-1"?>\n` +
    `<RespuestaEnvioDTE xmlns="http://www.sii.cl/SiiDte" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.sii.cl/SiiDte RespuestaEnvioDTE_v10.xsd" ` +
    `version="1.0">\n` +
    contenido + '\n' +
    signature + '\n' +
    `</RespuestaEnvioDTE>`
  )
}

// ── Función legacy (mantiene compatibilidad con código existente) ─────────────

/** @deprecated Usar buildResultadoDteXml directamente */
export function buildAecXml(input: {
  rutReceptor:   string
  razonReceptor: string
  rutEmisor:     string
  razonEmisor:   string
  tipoDte:       number
  folio:         number
  fechaEmision:  string
  montoTotal:    number
  estado:        AecEstado
  glosa?:        string
  privateKeyPem: string
  certificate:   forge.pki.Certificate
}): string {
  return buildResultadoDteXml({
    rutReceptor:   input.rutReceptor,
    razonReceptor: input.razonReceptor,
    rutEmisor:     input.rutEmisor,
    razonEmisor:   input.razonEmisor,
    documento: {
      tipoDte:      input.tipoDte,
      folio:        input.folio,
      fechaEmision: input.fechaEmision,
      rutEmisor:    input.rutEmisor,
      rutReceptor:  input.rutReceptor,
      montoTotal:   input.montoTotal,
    },
    estado:        input.estado,
    glosa:         input.glosa,
    privateKeyPem: input.privateKeyPem,
    certificate:   input.certificate,
  })
}
