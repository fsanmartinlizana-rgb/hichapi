// ══════════════════════════════════════════════════════════════════════════════
//  DTE PDF Generator — lib/dte/pdf.tsx
//
//  Genera un PDF de representación impresa de un DTE (boleta o factura)
//  a partir del XML firmado. Formato POS 80mm (papel térmico).
//
//  Usa @react-pdf/renderer (marcado como serverExternalPackages en next.config.ts
//  para que Node.js use react-pdf.js y no react-pdf.browser.js).
//  Usa bwip-js para generar el código de barras PDF417 del timbre SII.
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import bwipjs from 'bwip-js'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DteItem {
  nombre:   string
  cantidad: number
  precio:   number
  monto:    number
}

interface DteData {
  tipoDte:       number
  folio:         number
  fechaEmision:  string
  rutEmisor:     string
  razonSocial:   string
  giro:          string
  direccion:     string
  comuna:        string
  rutReceptor:   string
  razonReceptor: string
  giroReceptor?: string
  dirReceptor?:  string
  cmnaReceptor?: string
  items:         DteItem[]
  mntNeto?:      number
  mntExe?:       number
  iva?:          number
  mntTotal:      number
  nroResol:      number
  fchResol:      string
  tedText?:      string   // texto plano del TED para el código de barras
}

// ── Nombres de tipos DTE ──────────────────────────────────────────────────────

const TIPO_NOMBRE: Record<number, string> = {
  33: 'FACTURA ELECTRÓNICA',
  34: 'FACTURA NO AFECTA O EXENTA ELECTRÓNICA',
  39: 'BOLETA ELECTRÓNICA',
  41: 'BOLETA NO AFECTA O EXENTA ELECTRÓNICA',
  56: 'NOTA DE DÉBITO ELECTRÓNICA',
  61: 'NOTA DE CRÉDITO ELECTRÓNICA',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clp(n: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)
}

function fmtFecha(iso: string): string {
  try {
    const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return iso }
}

// ── Parser XML robusto ────────────────────────────────────────────────────────

/**
 * Extrae el valor de un tag XML. Usa un parser simple pero correcto:
 * busca el tag dentro de un bloque específico para evitar capturas greedy.
 */
function getTag(xml: string, tag: string): string {
  // Regex no-greedy para evitar capturar múltiples tags
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`)
  const m = re.exec(xml)
  return m ? m[1].trim() : ''
}

/**
 * Extrae el bloque de un tag (incluyendo el tag mismo).
 */
function getBlock(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`)
  const m = re.exec(xml)
  return m ? m[0] : ''
}

/**
 * Extrae todos los bloques de un tag repetido.
 */
function getAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g')
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    results.push(m[0])
  }
  return results
}

function parseXmlDte(signedXml: string): DteData {
  // Extraer bloques principales
  const caratula   = getBlock(signedXml, 'Caratula')
  const documento  = getBlock(signedXml, 'Documento')
  const encabezado = getBlock(documento, 'Encabezado')
  const idDoc      = getBlock(encabezado, 'IdDoc')
  const emisor     = getBlock(encabezado, 'Emisor')
  const receptor   = getBlock(encabezado, 'Receptor')
  const totales    = getBlock(encabezado, 'Totales')
  const ted        = getBlock(documento, 'TED')

  // IdDoc
  const tipoDte   = parseInt(getTag(idDoc, 'TipoDTE') || '39', 10)
  const folio     = parseInt(getTag(idDoc, 'Folio') || '0', 10)
  const fechaEmis = getTag(idDoc, 'FchEmis')

  // Emisor — boletas usan RznSocEmisor, facturas usan RznSoc
  const rutEmisor  = getTag(emisor, 'RUTEmisor')
  const razonSocial = getTag(emisor, 'RznSocEmisor') || getTag(emisor, 'RznSoc')
  const giro        = getTag(emisor, 'GiroEmisor') || getTag(emisor, 'GiroEmis')
  const direccion   = getTag(emisor, 'DirOrigen')
  const comuna      = getTag(emisor, 'CmnaOrigen')

  // Receptor
  const rutReceptor   = getTag(receptor, 'RUTRecep')
  const razonReceptor = getTag(receptor, 'RznSocRecep')
  const giroReceptor  = getTag(receptor, 'GiroRecep') || undefined
  const dirReceptor   = getTag(receptor, 'DirRecep') || undefined
  const cmnaReceptor  = getTag(receptor, 'CmnaRecep') || undefined

  // Totales
  const mntNeto  = parseInt(getTag(totales, 'MntNeto') || '0', 10) || undefined
  const mntExe   = parseInt(getTag(totales, 'MntExe') || '0', 10) || undefined
  const iva      = parseInt(getTag(totales, 'IVA') || '0', 10) || undefined
  const mntTotal = parseInt(getTag(totales, 'MntTotal') || '0', 10)

  // Ítems
  const detalleBlocks = getAllBlocks(documento, 'Detalle')
  const items: DteItem[] = detalleBlocks.map(bloque => ({
    nombre:   getTag(bloque, 'NmbItem'),
    cantidad: parseFloat(getTag(bloque, 'QtyItem') || '1'),
    precio:   parseInt(getTag(bloque, 'PrcItem') || '0', 10),
    monto:    parseInt(getTag(bloque, 'MontoItem') || '0', 10),
  })).filter(i => i.nombre)

  // Resolución SII (desde Caratula)
  const nroResol = parseInt(getTag(caratula, 'NroResol') || '99', 10)
  const fchResol = getTag(caratula, 'FchResol') || '2021-07-09'

  // TED — extraer el texto plano del DD para el código de barras
  // El SII usa el contenido del tag DD como texto del PDF417
  let tedText: string | undefined
  if (ted) {
    const dd = getBlock(ted, 'DD')
    if (dd) {
      // Limpiar el XML del DD para obtener texto compacto para el barcode
      tedText = dd.replace(/\s+/g, ' ').trim()
    }
  }

  return {
    tipoDte, folio, fechaEmision: fechaEmis,
    rutEmisor, razonSocial, giro, direccion, comuna,
    rutReceptor, razonReceptor, giroReceptor, dirReceptor, cmnaReceptor,
    items, mntNeto, mntExe, iva, mntTotal,
    nroResol, fchResol, tedText,
  }
}

// ── Generar PNG del código de barras PDF417 ───────────────────────────────────

async function generatePdf417(text: string): Promise<string | null> {
  try {
    const png = await bwipjs.toBuffer({
      bcid:        'pdf417',
      text,
      scale:       2,
      height:      8,
      includetext: false,
      eclevel:     5,
    })
    return `data:image/png;base64,${png.toString('base64')}`
  } catch (e) {
    console.warn('[pdf417] Error generating barcode:', e)
    return null
  }
}

// ── Estilos POS 80mm ──────────────────────────────────────────────────────────

// POS 80mm: ancho = 80mm, alto variable (autocálculo)
// En puntos PDF: 80mm ≈ 226.77pt
const POS_WIDTH  = 226.77
const POS_HEIGHT = 841.89  // alto inicial grande, se recorta al contenido

const ORANGE = '#FF6B35'
const DARK   = '#1a1a2e'
const GRAY   = '#888888'
const BLACK  = '#111111'

const s = StyleSheet.create({
  page: {
    fontFamily:        'Helvetica',
    fontSize:          7,
    color:             BLACK,
    paddingTop:        8,
    paddingBottom:     12,
    paddingHorizontal: 6,
    backgroundColor:   '#ffffff',
    width:             POS_WIDTH,
  },

  // Encabezado
  center:    { textAlign: 'center' },
  bold:      { fontFamily: 'Helvetica-Bold' },
  small:     { fontSize: 6, color: GRAY },
  smallBold: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: GRAY },

  emisorNombre: {
    fontSize:   9,
    fontFamily: 'Helvetica-Bold',
    textAlign:  'center',
    color:      DARK,
    marginBottom: 1,
  },
  emisorLinea: {
    fontSize:  6.5,
    textAlign: 'center',
    color:     GRAY,
    marginBottom: 1,
  },

  // Recuadro folio
  folioBox: {
    border:        '1pt solid ' + ORANGE,
    borderRadius:  3,
    padding:       5,
    marginTop:     5,
    marginBottom:  5,
    alignItems:    'center',
  },
  folioTipo: {
    fontSize:   7,
    fontFamily: 'Helvetica-Bold',
    color:      ORANGE,
    textAlign:  'center',
    marginBottom: 2,
  },
  folioNum: {
    fontSize:   14,
    fontFamily: 'Helvetica-Bold',
    color:      DARK,
    textAlign:  'center',
  },
  folioSub: {
    fontSize:  6,
    color:     GRAY,
    textAlign: 'center',
    marginTop: 1,
  },

  divider: {
    borderBottom:  '0.5pt solid #dddddd',
    marginVertical: 4,
  },
  dividerDashed: {
    borderBottom:  '0.5pt dashed #cccccc',
    marginVertical: 3,
  },

  // Receptor
  receptorBox: {
    backgroundColor: '#f5f5f5',
    borderRadius:    2,
    padding:         4,
    marginBottom:    5,
  },
  receptorTitle: {
    fontSize:   6,
    fontFamily: 'Helvetica-Bold',
    color:      GRAY,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  receptorRow: {
    flexDirection: 'row',
    marginBottom:  1,
  },
  receptorLabel: {
    width:    36,
    fontSize: 6,
    color:    GRAY,
  },
  receptorValue: {
    flex:       1,
    fontSize:   6.5,
    fontFamily: 'Helvetica-Bold',
    color:      BLACK,
  },

  // Tabla ítems
  tableHeader: {
    flexDirection:   'row',
    backgroundColor: DARK,
    paddingVertical: 2,
    paddingHorizontal: 3,
    marginBottom:    1,
  },
  thText: {
    fontSize:   6,
    fontFamily: 'Helvetica-Bold',
    color:      '#ffffff',
  },
  tableRow: {
    flexDirection:   'row',
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderBottom:    '0.3pt solid #eeeeee',
  },
  tableRowAlt: { backgroundColor: '#fafafa' },

  colNombre:   { flex: 1 },
  colCant:     { width: 22, textAlign: 'right' },
  colPrecio:   { width: 38, textAlign: 'right' },
  colMonto:    { width: 40, textAlign: 'right' },

  tdText:      { fontSize: 6.5, color: BLACK },
  tdTextRight: { fontSize: 6.5, color: BLACK, textAlign: 'right' },

  // Totales
  totalesRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    paddingVertical: 1.5,
    paddingHorizontal: 3,
  },
  totalesLabel: { fontSize: 6.5, color: GRAY },
  totalesValue: { fontSize: 6.5, color: BLACK },
  totalFinal: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    backgroundColor: ORANGE,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius:    2,
    marginTop:       2,
    marginBottom:    6,
  },
  totalFinalText: {
    fontSize:   9,
    fontFamily: 'Helvetica-Bold',
    color:      '#ffffff',
  },

  // Timbre
  timbreSection: {
    marginTop:    4,
    alignItems:   'center',
  },
  timbreTitle: {
    fontSize:  6,
    color:     GRAY,
    textAlign: 'center',
    marginBottom: 3,
  },
  timbreBarcode: {
    width:  '100%',
    height: 30,
    objectFit: 'contain',
  },
  timbreLeyenda: {
    fontSize:  5.5,
    color:     GRAY,
    textAlign: 'center',
    marginTop: 3,
  },
  resolucion: {
    fontSize:  5.5,
    color:     GRAY,
    textAlign: 'center',
    marginTop: 2,
  },
})

// ── Componente PDF ────────────────────────────────────────────────────────────

function DtePdfDoc({ data, barcodeDataUri }: { data: DteData; barcodeDataUri: string | null }) {
  const isFactura = [33, 34, 56, 61].includes(data.tipoDte)
  const tipNombre = TIPO_NOMBRE[data.tipoDte] ?? `DOCUMENTO TIPO ${data.tipoDte}`
  const showReceptor = isFactura || (data.rutReceptor && data.rutReceptor !== '66666666-6')

  return (
    <Document title={`${tipNombre} N° ${data.folio}`} author="HiChapi">
      <Page size={[POS_WIDTH, POS_HEIGHT]} style={s.page}>

        {/* Emisor */}
        <Text style={s.emisorNombre}>{data.razonSocial}</Text>
        <Text style={s.emisorLinea}>RUT: {data.rutEmisor}</Text>
        {data.giro ? <Text style={s.emisorLinea}>{data.giro}</Text> : null}
        {data.direccion ? (
          <Text style={s.emisorLinea}>{data.direccion}{data.comuna ? `, ${data.comuna}` : ''}</Text>
        ) : null}

        {/* Recuadro folio */}
        <View style={s.folioBox}>
          <Text style={s.folioTipo}>{tipNombre}</Text>
          <Text style={s.folioNum}>N° {data.folio}</Text>
          <Text style={s.folioSub}>RUT: {data.rutEmisor}</Text>
          <Text style={s.folioSub}>{fmtFecha(data.fechaEmision)}</Text>
        </View>

        {/* Receptor */}
        {showReceptor && (
          <View style={s.receptorBox}>
            <Text style={s.receptorTitle}>Receptor</Text>
            <View style={s.receptorRow}>
              <Text style={s.receptorLabel}>RUT:</Text>
              <Text style={s.receptorValue}>{data.rutReceptor}</Text>
            </View>
            <View style={s.receptorRow}>
              <Text style={s.receptorLabel}>Razón social:</Text>
              <Text style={s.receptorValue}>{data.razonReceptor}</Text>
            </View>
            {data.giroReceptor ? (
              <View style={s.receptorRow}>
                <Text style={s.receptorLabel}>Giro:</Text>
                <Text style={s.receptorValue}>{data.giroReceptor}</Text>
              </View>
            ) : null}
            {data.dirReceptor ? (
              <View style={s.receptorRow}>
                <Text style={s.receptorLabel}>Dirección:</Text>
                <Text style={s.receptorValue}>{data.dirReceptor}{data.cmnaReceptor ? `, ${data.cmnaReceptor}` : ''}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={s.divider} />

        {/* Tabla ítems */}
        <View style={s.tableHeader}>
          <Text style={[s.thText, s.colNombre]}>Descripción</Text>
          <Text style={[s.thText, s.colCant]}>Cant</Text>
          <Text style={[s.thText, s.colPrecio]}>P.Unit</Text>
          <Text style={[s.thText, s.colMonto]}>Total</Text>
        </View>

        {data.items.map((item, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tdText, s.colNombre]}>{item.nombre}</Text>
            <Text style={[s.tdTextRight, s.colCant]}>{item.cantidad}</Text>
            <Text style={[s.tdTextRight, s.colPrecio]}>{clp(item.precio)}</Text>
            <Text style={[s.tdTextRight, s.colMonto]}>{clp(item.monto)}</Text>
          </View>
        ))}

        <View style={s.dividerDashed} />

        {/* Totales */}
        {data.mntNeto !== undefined && data.mntNeto > 0 && (
          <View style={s.totalesRow}>
            <Text style={s.totalesLabel}>Neto:</Text>
            <Text style={s.totalesValue}>{clp(data.mntNeto)}</Text>
          </View>
        )}
        {data.mntExe !== undefined && data.mntExe > 0 && (
          <View style={s.totalesRow}>
            <Text style={s.totalesLabel}>Exento:</Text>
            <Text style={s.totalesValue}>{clp(data.mntExe)}</Text>
          </View>
        )}
        {data.iva !== undefined && data.iva > 0 && (
          <View style={s.totalesRow}>
            <Text style={s.totalesLabel}>IVA (19%):</Text>
            <Text style={s.totalesValue}>{clp(data.iva)}</Text>
          </View>
        )}
        <View style={s.totalFinal}>
          <Text style={s.totalFinalText}>TOTAL</Text>
          <Text style={s.totalFinalText}>{clp(data.mntTotal)}</Text>
        </View>

        {/* Timbre electrónico SII */}
        <View style={s.timbreSection}>
          <Text style={s.timbreTitle}>— TIMBRE ELECTRÓNICO SII —</Text>
          {barcodeDataUri ? (
            <Image src={barcodeDataUri} style={s.timbreBarcode} />
          ) : (
            <Text style={s.timbreLeyenda}>[Código de barras no disponible]</Text>
          )}
          <Text style={s.timbreLeyenda}>
            Verifique este documento en www.sii.cl
          </Text>
          <Text style={s.resolucion}>
            Res. SII N° {data.nroResol} del {fmtFecha(data.fchResol)}
          </Text>
          <Text style={[s.resolucion, { marginTop: 4 }]}>
            Este documento es una representación impresa de un DTE
          </Text>
        </View>

      </Page>
    </Document>
  )
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Genera el PDF de representación impresa de un DTE a partir del XML firmado.
 * Formato POS 80mm con código de barras PDF417 del timbre SII.
 */
export async function generateDtePdf(signedXml: string): Promise<Buffer> {
  const data = parseXmlDte(signedXml)

  // Generar código de barras PDF417 del TED
  let barcodeDataUri: string | null = null
  if (data.tedText) {
    barcodeDataUri = await generatePdf417(data.tedText)
  }

  // renderToBuffer requiere el elemento Document directamente
  const element = React.createElement(DtePdfDoc, { data, barcodeDataUri }) as unknown as React.ReactElement
  const buffer  = await (renderToBuffer as unknown as (el: React.ReactElement) => Promise<Buffer>)(element)
  return Buffer.from(buffer)
}

/**
 * Genera el PDF y lo retorna como string base64.
 */
export async function generateDtePdfBase64(signedXml: string): Promise<string> {
  const buffer = await generateDtePdf(signedXml)
  return buffer.toString('base64')
}
