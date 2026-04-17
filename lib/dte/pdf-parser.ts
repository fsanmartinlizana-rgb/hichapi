// ─────────────────────────────────────────────────────────────────────────────
// lib/dte/pdf-parser.ts
//
// Parsea el XML firmado de un DTE (EnvioDTE o DTE directo) y extrae los datos
// necesarios para renderizar la representación impresa en PDF.
// ─────────────────────────────────────────────────────────────────────────────

export interface DteLineItemParsed {
  nro:       number
  nombre:    string
  cantidad:  number
  precio:    number
  monto:     number
  dsc?:      string
  indExe?:   boolean
}

export interface ImptoRetenParsed {
  tipo:  number
  tasa:  number
  monto: number
}

export interface DteParsed {
  // IdDoc
  tipoDte:     number
  folio:       number
  fechaEmis:   string   // YYYY-MM-DD
  fmaPago:     number   // 1=contado, 2=crédito, 3=sin costo

  // Emisor
  rutEmisor:   string
  razonEmisor: string
  giroEmisor:  string
  dirEmisor:   string
  cmnaEmisor:  string

  // Receptor
  rutReceptor:  string
  razonReceptor: string
  giroReceptor:  string
  dirReceptor:   string
  cmnaReceptor:  string

  // Totales
  mntNeto:     number
  mntExe:      number
  tasaIva:     number
  iva:         number
  mntTotal:    number
  imptoReten:  ImptoRetenParsed[]

  // Detalle
  items:       DteLineItemParsed[]

  // TED (timbre electrónico) — XML completo del bloque <TED>
  tedXml:      string

  // Resolución SII (de la Caratula)
  fchResol:    string
  nroResol:    number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tag(xml: string, tagName: string): string {
  // Busca <TagName>valor</TagName> ignorando namespace prefix
  const re = new RegExp(`<(?:[\\w]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[\\w]+:)?${tagName}>`, 'i')
  return re.exec(xml)?.[1]?.trim() ?? ''
}

function tagInt(xml: string, tagName: string): number {
  return parseInt(tag(xml, tagName) || '0', 10) || 0
}

function tagFloat(xml: string, tagName: string): number {
  return parseFloat(tag(xml, tagName) || '0') || 0
}

function allTags(xml: string, tagName: string): string[] {
  const re = new RegExp(`<(?:[\\w]+:)?${tagName}[^>]*>[\\s\\S]*?<\\/(?:[\\w]+:)?${tagName}>`, 'gi')
  return xml.match(re) ?? []
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseDteXml(xmlRaw: string): DteParsed {
  // Normalizar encoding — el XML puede venir en ISO-8859-1 pero JS trabaja en UTF-8
  const xml = xmlRaw
    .replace(/encoding="ISO-8859-1"/i, 'encoding="UTF-8"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

  // ── Caratula (resolución SII) ─────────────────────────────────────────────
  const caratulaBlock = /<Caratula[\s\S]*?<\/Caratula>/.exec(xml)?.[0] ?? ''
  const fchResol = tag(caratulaBlock, 'FchResol') || tag(xml, 'FchResol')
  const nroResol = tagInt(caratulaBlock, 'NroResol') || tagInt(xml, 'NroResol')

  // ── Documento DTE ─────────────────────────────────────────────────────────
  const docBlock = /<Documento[\s\S]*?<\/Documento>/.exec(xml)?.[0] ?? xml

  // IdDoc
  const idDocBlock = /<IdDoc>[\s\S]*?<\/IdDoc>/.exec(docBlock)?.[0] ?? ''
  const tipoDte  = tagInt(idDocBlock, 'TipoDTE')
  const folio    = tagInt(idDocBlock, 'Folio')
  const fechaEmis = tag(idDocBlock, 'FchEmis')
  const fmaPago  = tagInt(idDocBlock, 'FmaPago') || 1

  // Emisor
  const emisorBlock = /<Emisor>[\s\S]*?<\/Emisor>/.exec(docBlock)?.[0] ?? ''
  const rutEmisor   = tag(emisorBlock, 'RUTEmisor')
  const razonEmisor = tag(emisorBlock, 'RznSoc')
  const giroEmisor  = tag(emisorBlock, 'GiroEmis')
  const dirEmisor   = tag(emisorBlock, 'DirOrigen')
  const cmnaEmisor  = tag(emisorBlock, 'CmnaOrigen')

  // Receptor
  const recepBlock   = /<Receptor>[\s\S]*?<\/Receptor>/.exec(docBlock)?.[0] ?? ''
  const rutReceptor  = tag(recepBlock, 'RUTRecep')
  const razonReceptor = tag(recepBlock, 'RznSocRecep')
  const giroReceptor = tag(recepBlock, 'GiroRecep')
  const dirReceptor  = tag(recepBlock, 'DirRecep')
  const cmnaReceptor = tag(recepBlock, 'CmnaRecep')

  // Totales
  const totalesBlock = /<Totales>[\s\S]*?<\/Totales>/.exec(docBlock)?.[0] ?? ''
  const mntNeto  = tagInt(totalesBlock, 'MntNeto')
  const mntExe   = tagInt(totalesBlock, 'MntExe')
  const tasaIva  = tagFloat(totalesBlock, 'TasaIVA') || 19
  const iva      = tagInt(totalesBlock, 'IVA')
  const mntTotal = tagInt(totalesBlock, 'MntTotal')

  const imptoRetenBlocks = allTags(totalesBlock, 'ImptoReten')
  const imptoReten: ImptoRetenParsed[] = imptoRetenBlocks.map(b => ({
    tipo:  tagInt(b, 'TipoImp'),
    tasa:  tagFloat(b, 'TasaImp'),
    monto: tagInt(b, 'MontoImp'),
  }))

  // Detalle
  const detalleBlocks = allTags(docBlock, 'Detalle')
  const items: DteLineItemParsed[] = detalleBlocks.map(b => ({
    nro:      tagInt(b, 'NroLinDet'),
    nombre:   tag(b, 'NmbItem'),
    cantidad: tagFloat(b, 'QtyItem') || 1,
    precio:   tagFloat(b, 'PrcItem'),
    monto:    tagInt(b, 'MontoItem'),
    dsc:      tag(b, 'DscItem') || undefined,
    indExe:   tag(b, 'IndExe') === '1',
  }))

  // TED — extraer el bloque completo para el código de barras
  const tedXml = /<TED[\s\S]*?<\/TED>/.exec(docBlock)?.[0] ?? ''

  return {
    tipoDte, folio, fechaEmis, fmaPago,
    rutEmisor, razonEmisor, giroEmisor, dirEmisor, cmnaEmisor,
    rutReceptor, razonReceptor, giroReceptor, dirReceptor, cmnaReceptor,
    mntNeto, mntExe, tasaIva, iva, mntTotal, imptoReten,
    items,
    tedXml,
    fchResol, nroResol,
  }
}
