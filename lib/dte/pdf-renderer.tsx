// ─────────────────────────────────────────────────────────────────────────────
// lib/dte/pdf-renderer.tsx
//
// Representación impresa del DTE tipo 33 (Factura Electrónica).
// Layout basado en DtePdf.php (LibreDTE/TCPDF) de la referencia PHP:
//
//  ┌──────────────────────────────┬──────────────────────┐
//  │ LOGO  Razón social           │  ┌──────────────────┐ │
//  │       Giro                   │  │ FACTURA          │ │
//  │       Dirección, Comuna      │  │ ELECTRÓNICA      │ │
//  │                              │  │ RUT: XX.XXX.XXX-X│ │
//  │                              │  │ N° FOLIO         │ │
//  │                              │  └──────────────────┘ │
//  │                              │  SII - Dirección Reg. │
//  ├──────────────────────────────┴──────────────────────┤
//  │ SEÑOR(ES): ...  RUT: ...                            │
//  │ Giro: ...                                           │
//  │ Dirección: ...  Comuna: ...  Ciudad: ...            │
//  ├─────┬──────────────────────┬──────┬────────┬────────┤
//  │ N°  │ Item                 │ Cant │ P.Unit │ Total  │
//  ├─────┼──────────────────────┼──────┼────────┼────────┤
//  │  1  │ Producto A           │  2   │ $1.000 │ $2.000 │
//  ├─────────────────────────────────────────────────────┤
//  │ [PDF417 TED]  │  Neto: $X  IVA: $X  TOTAL: $X      │
//  └─────────────────────────────────────────────────────┘
//  │ Acuse de recibo (solo crédito)                      │
//  └─────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Image,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { DteParsed } from './pdf-parser'

// ── Colores y constantes ──────────────────────────────────────────────────────

const RED    = '#CC0000'
const BLACK  = '#111111'
const GRAY   = '#555555'
const LGRAY  = '#888888'
const BGROW  = '#F7F7F7'
const BGHDR  = '#EEEEEE'

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily:       'Helvetica',
    fontSize:         8,
    color:            BLACK,
    paddingTop:       14,
    paddingBottom:    68,   // espacio para el pie fijo
    paddingHorizontal: 12,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'flex-start',
    marginBottom:     6,
  },
  emisorBlock: {
    flex:             1,
    paddingRight:     8,
  },
  logo: {
    width:            60,
    height:           30,
    marginBottom:     4,
    objectFit:        'contain',
  },
  emisorName: {
    fontSize:         11,
    fontFamily:       'Helvetica-Bold',
    marginBottom:     2,
    color:            BLACK,
  },
  emisorLine: {
    fontSize:         8,
    color:            GRAY,
    marginBottom:     1,
  },

  // Caja roja tipo documento (esquina superior derecha)
  docBox: {
    width:            130,
    borderWidth:      1.5,
    borderColor:      RED,
    borderRadius:     3,
    padding:          6,
    alignItems:       'center',
  },
  docBoxLabel: {
    fontSize:         9,
    fontFamily:       'Helvetica-Bold',
    color:            RED,
    textAlign:        'center',
    marginBottom:     3,
    textTransform:    'uppercase',
  },
  docBoxRut: {
    fontSize:         8,
    fontFamily:       'Helvetica-Bold',
    color:            BLACK,
    textAlign:        'center',
    marginBottom:     3,
  },
  docBoxFolio: {
    fontSize:         16,
    fontFamily:       'Helvetica-Bold',
    color:            RED,
    textAlign:        'center',
  },
  docBoxSii: {
    fontSize:         7,
    color:            GRAY,
    textAlign:        'center',
    marginTop:        4,
  },

  // Fecha emisión (alineada a la derecha, bajo el header)
  fechaRow: {
    flexDirection:    'row',
    justifyContent:   'flex-end',
    marginBottom:     4,
  },
  fechaText: {
    fontSize:         8,
    fontFamily:       'Helvetica-Bold',
    color:            BLACK,
  },

  // ── Tabla receptor ──────────────────────────────────────────────────────────
  receptorBox: {
    borderWidth:      0.5,
    borderColor:      BLACK,
    marginBottom:     6,
  },
  receptorRow: {
    flexDirection:    'row',
    borderBottomWidth: 0.3,
    borderBottomColor: '#CCCCCC',
    minHeight:        14,
    alignItems:       'center',
  },
  receptorRowLast: {
    flexDirection:    'row',
    minHeight:        14,
    alignItems:       'center',
  },
  receptorLabel: {
    width:            60,
    paddingHorizontal: 4,
    paddingVertical:  2,
    fontSize:         7.5,
    fontFamily:       'Helvetica-Bold',
    color:            BLACK,
    borderRightWidth: 0.3,
    borderRightColor: '#CCCCCC',
  },
  receptorValue: {
    flex:             1,
    paddingHorizontal: 4,
    paddingVertical:  2,
    fontSize:         7.5,
    color:            BLACK,
  },
  receptorHalf: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
    borderRightWidth: 0.3,
    borderRightColor: '#CCCCCC',
  },
  receptorHalfLast: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
  },

  // ── Tabla detalle ────────────────────────────────────────────────────────────
  tableHeaderRow: {
    flexDirection:    'row',
    backgroundColor:  BGHDR,
    borderTopWidth:   0.5,
    borderTopColor:   '#AAAAAA',
    borderBottomWidth: 0.5,
    borderBottomColor: '#AAAAAA',
    paddingVertical:  3,
  },
  tableRow: {
    flexDirection:    'row',
    borderBottomWidth: 0.3,
    borderBottomColor: '#DDDDDD',
    paddingVertical:  2,
  },
  tableRowAlt: {
    backgroundColor:  BGROW,
  },
  // columnas
  cNro:    { width: 18,  paddingHorizontal: 2, fontSize: 7.5, textAlign: 'center' },
  cNombre: { flex: 1,    paddingHorizontal: 3, fontSize: 7.5 },
  cQty:    { width: 28,  paddingHorizontal: 2, fontSize: 7.5, textAlign: 'right' },
  cPrecio: { width: 48,  paddingHorizontal: 2, fontSize: 7.5, textAlign: 'right' },
  cMonto:  { width: 52,  paddingHorizontal: 2, fontSize: 7.5, textAlign: 'right' },
  cBold:   { fontFamily: 'Helvetica-Bold' },
  cDsc:    { fontSize: 6.5, color: LGRAY, marginTop: 1 },

  // ── Pie fijo ─────────────────────────────────────────────────────────────────
  footer: {
    position:         'absolute',
    bottom:           10,
    left:             12,
    right:            12,
  },
  footerBox: {
    flexDirection:    'row',
    borderWidth:      0.5,
    borderColor:      '#AAAAAA',
    minHeight:        60,
  },
  // Columna izquierda: timbre
  footerLeft: {
    width:            '48%',
    borderRightWidth: 0.5,
    borderRightColor: '#AAAAAA',
    padding:          6,
    justifyContent:   'center',
    alignItems:       'center',
  },
  tedImage: {
    width:            '100%',
    height:           38,
    objectFit:        'contain',
  },
  tedLegend: {
    fontSize:         6,
    color:            LGRAY,
    textAlign:        'center',
    marginTop:        2,
  },
  // Columna derecha: forma de pago + totales
  footerRight: {
    flex:             1,
    paddingHorizontal: 8,
    paddingVertical:  5,
    justifyContent:   'flex-start',
  },
  fpRow: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    marginBottom:     4,
  },
  fpLabel: {
    fontSize:         7.5,
    color:            GRAY,
  },
  fpValue: {
    fontSize:         7.5,
    fontFamily:       'Helvetica-Bold',
  },
  totalRow: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    paddingVertical:  1.5,
  },
  totalLabel: {
    fontSize:         7.5,
    color:            GRAY,
    flex:             1,
    paddingRight:     6,
  },
  totalValue: {
    fontSize:         7.5,
    fontFamily:       'Helvetica-Bold',
    textAlign:        'right',
    minWidth:         55,
  },
  totalRowFinal: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    borderTopWidth:   0.5,
    borderTopColor:   '#AAAAAA',
    paddingTop:       3,
    marginTop:        2,
  },
  totalLabelFinal: {
    fontSize:         9,
    fontFamily:       'Helvetica-Bold',
    color:            RED,
    flex:             1,
    paddingRight:     6,
  },
  totalValueFinal: {
    fontSize:         9,
    fontFamily:       'Helvetica-Bold',
    color:            RED,
    textAlign:        'right',
    minWidth:         55,
  },

  // ── Acuse de recibo (solo crédito) ───────────────────────────────────────────
  acuseBox: {
    borderWidth:      0.5,
    borderColor:      BLACK,
    marginTop:        4,
    padding:          4,
  },
  acuseTitle: {
    fontSize:         8,
    fontFamily:       'Helvetica-Bold',
    textAlign:        'center',
    marginBottom:     4,
  },
  acuseCols: {
    flexDirection:    'row',
    marginBottom:     6,
  },
  acuseCol: {
    flex:             1,
    borderBottomWidth: 0.5,
    borderBottomColor: BLACK,
    paddingBottom:    2,
    marginHorizontal: 2,
  },
  acuseColLabel: {
    fontSize:         7,
    color:            GRAY,
  },
  acuseLegal: {
    fontSize:         6,
    color:            GRAY,
    textAlign:        'justify',
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOC_TYPE_LABEL: Record<number, string> = {
  33: 'FACTURA ELECTRÓNICA',
  56: 'NOTA DE DÉBITO ELECTRÓNICA',
  61: 'NOTA DE CRÉDITO ELECTRÓNICA',
  39: 'BOLETA ELECTRÓNICA',
  41: 'BOLETA NO AFECTA O EXENTA ELECTRÓNICA',
}

const FMA_PAGO_LABEL: Record<number, string> = {
  1: 'Contado',
  2: 'Crédito',
  3: 'Sin costo',
}

function clp(n: number): string {
  return `$${new Intl.NumberFormat('es-CL').format(n)}`
}

function fmtDate(iso: string): string {
  // YYYY-MM-DD → DD/MM/YYYY
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Componente PDF ────────────────────────────────────────────────────────────

interface DtePdfProps {
  dte:        DteParsed
  tedPngB64:  string
  logoUrl?:   string   // URL pública del logo del restaurante (opcional)
}

function DtePdfDocument({ dte, tedPngB64, logoUrl }: DtePdfProps) {
  const docLabel  = DOC_TYPE_LABEL[dte.tipoDte] ?? `DOCUMENTO TIPO ${dte.tipoDte}`
  const esCredito = dte.fmaPago === 2

  return (
    <Document
      title={`${docLabel} N° ${dte.folio}`}
      author={dte.razonEmisor}
      subject="Documento Tributario Electrónico"
    >
      <Page size="A4" style={S.page}>

        {/* ── Header: Emisor + Caja tipo documento ── */}
        <View style={S.headerRow}>

          {/* Emisor */}
          <View style={S.emisorBlock}>
            {logoUrl && (
              <Image style={S.logo} src={logoUrl} />
            )}
            <Text style={S.emisorName}>{dte.razonEmisor}</Text>
            <Text style={S.emisorLine}>{dte.giroEmisor}</Text>
            <Text style={S.emisorLine}>{dte.dirEmisor}, {dte.cmnaEmisor}</Text>
            <Text style={S.emisorLine}>RUT: {dte.rutEmisor}</Text>
          </View>

          {/* Caja roja */}
          <View>
            <View style={S.docBox}>
              <Text style={S.docBoxLabel}>{docLabel}</Text>
              <Text style={S.docBoxRut}>R.U.T.: {dte.rutEmisor}</Text>
              <Text style={S.docBoxFolio}>N° {dte.folio}</Text>
            </View>
            <Text style={S.docBoxSii}>
              {dte.nroResol === 0
                ? `S.I.I. — Ambiente Certificación`
                : `S.I.I. — Res. N° ${dte.nroResol} del ${fmtDate(dte.fchResol)}`}
            </Text>
          </View>
        </View>

        {/* Fecha emisión alineada a la derecha */}
        <View style={S.fechaRow}>
          <Text style={S.fechaText}>{fmtDate(dte.fechaEmis)}</Text>
        </View>

        {/* ── Tabla receptor ── */}
        <View style={S.receptorBox}>
          {/* Fila 1: Señor(es) */}
          <View style={S.receptorRow}>
            <Text style={S.receptorLabel}>SEÑOR(ES):</Text>
            <Text style={S.receptorValue}>{dte.razonReceptor}</Text>
          </View>
          {/* Fila 2: RUT */}
          <View style={S.receptorRow}>
            <Text style={S.receptorLabel}>R.U.T.:</Text>
            <Text style={S.receptorValue}>{dte.rutReceptor}</Text>
          </View>
          {/* Fila 3: Giro */}
          <View style={S.receptorRow}>
            <Text style={S.receptorLabel}>Giro:</Text>
            <Text style={S.receptorValue}>{dte.giroReceptor}</Text>
          </View>
          {/* Fila 4: Dirección */}
          <View style={S.receptorRow}>
            <Text style={S.receptorLabel}>Dirección:</Text>
            <Text style={S.receptorValue}>{dte.dirReceptor}</Text>
          </View>
          {/* Fila 5: Comuna / Ciudad */}
          <View style={S.receptorRowLast}>
            <View style={S.receptorHalf}>
              <Text style={S.receptorLabel}>Comuna:</Text>
              <Text style={[S.receptorValue, { flex: 1 }]}>{dte.cmnaReceptor}</Text>
            </View>
            <View style={S.receptorHalfLast}>
              <Text style={[S.receptorLabel, { borderRightWidth: 0 }]}>Ciudad:</Text>
              <Text style={[S.receptorValue, { flex: 1 }]}>{dte.cmnaReceptor}</Text>
            </View>
          </View>
        </View>

        {/* ── Tabla de detalle ── */}
        {/* Header */}
        <View style={S.tableHeaderRow}>
          <Text style={[S.cNro,    S.cBold]}>N°</Text>
          <Text style={[S.cNombre, S.cBold]}>Descripción</Text>
          <Text style={[S.cQty,    S.cBold]}>Cant.</Text>
          <Text style={[S.cPrecio, S.cBold]}>P. Unitario</Text>
          <Text style={[S.cMonto,  S.cBold]}>Total Item</Text>
        </View>

        {/* Filas */}
        {dte.items.map((item, i) => (
          <View key={item.nro} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
            <Text style={S.cNro}>{item.nro}</Text>
            <View style={S.cNombre}>
              <Text>{item.nombre}{item.indExe ? ' (EX)' : ''}</Text>
              {item.dsc ? <Text style={S.cDsc}>{item.dsc}</Text> : null}
            </View>
            <Text style={S.cQty}>{item.cantidad}</Text>
            <Text style={S.cPrecio}>{clp(item.precio)}</Text>
            <Text style={S.cMonto}>{clp(item.monto)}</Text>
          </View>
        ))}

        {/* ── Pie fijo: Timbre + Totales ── */}
        <View style={S.footer} fixed>
          <View style={S.footerBox}>

            {/* Columna izquierda: PDF417 */}
            <View style={S.footerLeft}>
              {tedPngB64 ? (
                <Image
                  style={S.tedImage}
                  src={`data:image/png;base64,${tedPngB64}`}
                />
              ) : (
                <Text style={{ fontSize: 7, color: LGRAY }}>Timbre no disponible</Text>
              )}
              <Text style={S.tedLegend}>
                Timbre Electrónico SII — Verifique en www.sii.cl
              </Text>
              <Text style={[S.tedLegend, { marginTop: 1 }]}>
                {dte.nroResol === 0
                  ? `Res. Exenta N° 0 del ${fmtDate(dte.fchResol)} — Certificación`
                  : `Res. N° ${dte.nroResol} del ${fmtDate(dte.fchResol)}`}
              </Text>
            </View>

            {/* Columna derecha: Forma de pago + Totales */}
            <View style={S.footerRight}>
              <View style={S.fpRow}>
                <Text style={S.fpLabel}>Forma de pago:</Text>
                <Text style={S.fpValue}>{FMA_PAGO_LABEL[dte.fmaPago] ?? 'Contado'}</Text>
              </View>

              {dte.mntNeto > 0 && (
                <View style={S.totalRow}>
                  <Text style={S.totalLabel}>Neto $</Text>
                  <Text style={S.totalValue}>{clp(dte.mntNeto)}</Text>
                </View>
              )}
              {dte.mntExe > 0 && (
                <View style={S.totalRow}>
                  <Text style={S.totalLabel}>Exento $</Text>
                  <Text style={S.totalValue}>{clp(dte.mntExe)}</Text>
                </View>
              )}
              {dte.iva > 0 && (
                <View style={S.totalRow}>
                  <Text style={S.totalLabel}>IVA ({dte.tasaIva}%) $</Text>
                  <Text style={S.totalValue}>{clp(dte.iva)}</Text>
                </View>
              )}
              {dte.imptoReten.map(imp => (
                <View key={imp.tipo} style={S.totalRow}>
                  <Text style={S.totalLabel}>Imp. Adic. ({imp.tasa}%) $</Text>
                  <Text style={S.totalValue}>{clp(imp.monto)}</Text>
                </View>
              ))}

              <View style={S.totalRowFinal}>
                <Text style={S.totalLabelFinal}>TOTAL $</Text>
                <Text style={S.totalValueFinal}>{clp(dte.mntTotal)}</Text>
              </View>
            </View>
          </View>

          {/* ── Acuse de recibo (solo facturas a crédito) ── */}
          {esCredito && (
            <View style={S.acuseBox}>
              <Text style={S.acuseTitle}>Acuse de recibo</Text>
              <View style={S.acuseCols}>
                {['Nombre', 'RUN', 'Fecha', 'Recinto', 'Firma'].map(col => (
                  <View key={col} style={S.acuseCol}>
                    <Text style={S.acuseColLabel}>{col}</Text>
                  </View>
                ))}
              </View>
              <Text style={S.acuseLegal}>
                El acuse de recibo que se declara en este acto, de acuerdo a lo dispuesto en la letra b) del Art. 4°, y la letra c) del Art. 5° de la Ley 19.983, acredita que la entrega de mercaderías o servicio(s) prestado(s) ha(n) sido recibido(s).
              </Text>
            </View>
          )}
        </View>

      </Page>
    </Document>
  )
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Genera el PDF de un DTE y lo devuelve como Buffer.
 *
 * @param dte       Datos parseados del DTE (de parseDteXml)
 * @param tedPngB64 PNG base64 del código PDF417 del TED (de generateTedBarcode)
 * @param logoUrl   URL pública del logo del restaurante (opcional)
 * @returns         Buffer con el PDF generado
 */
export async function renderDtePdf(
  dte:        DteParsed,
  tedPngB64:  string,
  logoUrl?:   string,
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <DtePdfDocument dte={dte} tedPngB64={tedPngB64} logoUrl={logoUrl} />
  )
  return Buffer.from(buffer)
}
