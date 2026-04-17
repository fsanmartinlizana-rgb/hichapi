// ─────────────────────────────────────────────────────────────────────────────
// lib/dte/aec-parser.ts
//
// Parsea los XMLs de intercambio DTE que llegan al EMISOR desde el receptor.
//
// Cuando tú emites una factura, el receptor te envía de vuelta:
//   015 — RespuestaEnvioDTE con RecepcionDTE  (confirmó que recibió el XML)
//   016 — EnvioRecibos                        (confirmó que recibió las mercaderías)
//   017 — RespuestaEnvioDTE con ResultadoDTE  (resultado comercial: ACD/RCD/ERM)
//
// Este módulo detecta el tipo de XML y extrae los datos relevantes.
// ─────────────────────────────────────────────────────────────────────────────

export type AecXmlTipo = 'RecepcionDTE' | 'EnvioRecibos' | 'ResultadoDTE' | 'Desconocido'

export type AecEstadoNormalizado = 'aceptado' | 'rechazado' | 'reclamado' | null

export interface AecParseResult {
  tipo:         AecXmlTipo
  // Datos del documento referenciado
  tipoDte?:     number
  folio?:       number
  rutEmisor?:   string
  rutReceptor?: string
  montoTotal?:  number
  fechaEmision?: string
  // Estado (solo en 015 y 017)
  estadoCodigo?: string   // '0', 'ACD', 'RCD', 'ERM', etc.
  estadoGlosa?:  string
  // Estado normalizado (solo en 017)
  estadoNormalizado?: AecEstadoNormalizado
  // Fecha de firma/recepción
  tmstFirma?:   string
  // RUT de quien responde
  rutResponde?: string
  // RUT de quien recibe la respuesta (debería ser el emisor original)
  rutRecibe?:   string
  // Recinto (solo en 016)
  recinto?:     string
  // Error de parseo
  error?:       string
}

// ── Mapa de códigos SII → estado normalizado ──────────────────────────────────

const CODIGO_A_ESTADO: Record<string, AecEstadoNormalizado> = {
  ACD: 'aceptado',
  RCD: 'rechazado',
  ERM: 'reclamado',
}

// ── Helper: extrae texto de un tag XML simple (case-insensitive en el nombre) ─

function tag(xml: string, tagName: string): string | undefined {
  const re = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, 'i')
  const m  = xml.match(re)
  return m ? m[1].trim() : undefined
}

// Busca el primer match entre varios nombres de tag alternativos
function tagAny(xml: string, ...tagNames: string[]): string | undefined {
  for (const name of tagNames) {
    const val = tag(xml, name)
    if (val !== undefined) return val
  }
  return undefined
}

// ── Detectar tipo de XML ──────────────────────────────────────────────────────

function detectarTipo(xml: string): AecXmlTipo {
  if (/<EnvioRecibos[\s>]/i.test(xml))       return 'EnvioRecibos'
  if (/<ResultadoDTE[\s>]/i.test(xml))       return 'ResultadoDTE'
  if (/<RecepcionDTE[\s>]/i.test(xml))       return 'RecepcionDTE'
  return 'Desconocido'
}
// ── Parser principal ──────────────────────────────────────────────────────────

/**
 * Parsea un XML de intercambio DTE (015, 016 o 017) y extrae los datos clave.
 *
 * @param xmlRaw  Contenido XML como string (puede ser ISO-8859-1 o UTF-8)
 * @returns       AecParseResult con los datos extraídos
 */
export function parseAecXml(xmlRaw: string): AecParseResult {
  // Normalizar encoding: si viene como Buffer ISO-8859-1 ya fue convertido,
  // pero limpiamos la declaración para no confundir al regex.
  const xml = xmlRaw.replace(/encoding="ISO-8859-1"/i, 'encoding="UTF-8"')

  const tipo = detectarTipo(xml)

  if (tipo === 'Desconocido') {
    return { tipo, error: 'XML no reconocido: no es RespuestaEnvioDTE ni EnvioRecibos' }
  }

  // Datos comunes de caratula — variantes: RutResponde / RUTResponde, etc.
  const rutResponde = tagAny(xml, 'RutResponde', 'RUTResponde')
  const rutRecibe   = tagAny(xml, 'RutRecibe',   'RUTRecibe')
  const tmstFirma   = tag(xml, 'TmstFirmaResp') ?? tag(xml, 'TmstFirmaEnv')

  if (tipo === 'EnvioRecibos') {
    // ── 016 ──────────────────────────────────────────────────────────────────
    const tipoDteStr  = tag(xml, 'TipoDoc')
    const folioStr    = tag(xml, 'Folio')
    const rutEmisor   = tag(xml, 'RUTEmisor')
    const rutReceptor = tag(xml, 'RUTRecep')
    const montoStr    = tag(xml, 'MntTotal')
    const fechaEmision = tag(xml, 'FchEmis')
    const recinto     = tag(xml, 'Recinto')

    return {
      tipo,
      tipoDte:      tipoDteStr  ? parseInt(tipoDteStr,  10) : undefined,
      folio:        folioStr    ? parseInt(folioStr,    10) : undefined,
      rutEmisor,
      rutReceptor,
      montoTotal:   montoStr    ? parseInt(montoStr,    10) : undefined,
      fechaEmision,
      recinto,
      rutResponde,
      rutRecibe,
      tmstFirma,
    }
  }

  if (tipo === 'RecepcionDTE') {
    // ── 015 ──────────────────────────────────────────────────────────────────
    const tipoDteStr   = tag(xml, 'TipoDTE')
    const folioStr     = tag(xml, 'Folio')
    const rutEmisor    = tag(xml, 'RUTEmisor')
    const rutReceptor  = tag(xml, 'RUTRecep')
    const montoStr     = tag(xml, 'MntTotal')
    const fechaEmision = tag(xml, 'FchEmis')
    const estadoCodigo = tag(xml, 'EstadoRecepDTE')
    const estadoGlosa  = tag(xml, 'RecepDTEGlosa')

    return {
      tipo,
      tipoDte:      tipoDteStr  ? parseInt(tipoDteStr,  10) : undefined,
      folio:        folioStr    ? parseInt(folioStr,    10) : undefined,
      rutEmisor,
      rutReceptor,
      montoTotal:   montoStr    ? parseInt(montoStr,    10) : undefined,
      fechaEmision,
      estadoCodigo,
      estadoGlosa,
      rutResponde,
      rutRecibe,
      tmstFirma,
    }
  }

  // ── 017 ResultadoDTE ───────────────────────────────────────────────────────
  // Soporta tanto <RespuestaEnvioDTE> como <RespuestaDTE> (variante real del SII)
  // RUTEmisor en ResultadoDTE = quien emitió la factura original (nosotros)
  // RUTRecep  en ResultadoDTE = el receptor que nos responde
  // En RecepcionEnvio: RutEmisor / RutReceptor (minúscula)
  const tipoDteStr   = tag(xml, 'TipoDTE')
  const folioStr     = tag(xml, 'Folio')
  // Nuestro RUT puede estar en RUTEmisor (dentro de ResultadoDTE) o RutEmisor (RecepcionEnvio)
  const rutEmisor    = tagAny(xml, 'RUTEmisor',   'RutEmisor')
  // RUT del receptor puede estar en RUTRecep o RutReceptor
  const rutReceptor  = tagAny(xml, 'RUTRecep',    'RutReceptor')
  const montoStr     = tagAny(xml, 'MntTotal',    'MontoTotal')
  const fechaEmision = tag(xml, 'FchEmis')
  const estadoCodigo = tag(xml, 'EstadoDTE')
  const estadoGlosa  = tag(xml, 'EstadoDTEGlosa')

  const estadoNormalizado = estadoCodigo
    ? (CODIGO_A_ESTADO[estadoCodigo.toUpperCase()] ?? null)
    : null

  return {
    tipo,
    tipoDte:      tipoDteStr  ? parseInt(tipoDteStr,  10) : undefined,
    folio:        folioStr    ? parseInt(folioStr,    10) : undefined,
    rutEmisor,    // nuestro RUT — con el que buscamos en dte_credentials
    rutReceptor,
    montoTotal:   montoStr    ? parseInt(montoStr,    10) : undefined,
    fechaEmision,
    estadoCodigo,
    estadoGlosa,
    estadoNormalizado,
    rutResponde,
    rutRecibe,
    tmstFirma,
  }
}
