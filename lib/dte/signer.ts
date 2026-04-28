// ══════════════════════════════════════════════════════════════════════════════
//  XML_Signer — lib/dte/signer.ts
//
//  Builds a complete SII-compliant EnvioBOLETA/EnvioDTE XML and signs it.
//
//  Structure produced:
//    <EnvioBOLETA> (or <EnvioDTE> for facturas)
//      <SetDTE>
//        <Caratula>  ← RutEmisor, RutEnvia, RutReceptor SII, FchResol, NroResol
//        <DTE>
//          <Documento>
//            <Encabezado> / <Detalle> / <Totales>
//            <TED>  ← timbre electrónico del CAF (FRMT firmado con clave CAF)
//          </Documento>
//          <Signature>  ← firma del DTE
//        </DTE>
//      </SetDTE>
//      <Signature>  ← firma del sobre
//    </EnvioBOLETA>
//
//  Supported document types:
//    33 — Factura electrónica (with IVA + receptor fields)
//    34 — Factura exenta (no IVA, uses MntExe + receptor fields)
//    39 — Boleta electrónica (with IVA)
//    41 — Boleta exenta (no IVA, uses MntExe)
//    43 — Liquidación factura (with IVA + receptor fields + comisiones)
//    46 — Factura de compra (with IVA + receptor fields)
//    52 — Guía de despacho (no IVA, uses MntExe + receptor fields)
//    56 — Nota de débito (references original factura)
//    61 — Nota de crédito (references original factura)
//    110 — Factura de exportación (with export data + receptor fields)
//    111 — Nota de débito exportación (with export data + receptor fields)
//    112 — Nota de crédito exportación (with export data + receptor fields)
//
//  Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
// ══════════════════════════════════════════════════════════════════════════════

import * as forge from 'node-forge'
import * as crypto from 'crypto'
import { C14nCanonicalization } from 'xml-crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto/aes'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DteLineItem {
  name:           string
  quantity:       number
  unit_price:     number
  cod_imp_adic?:  number   // código de impuesto adicional (ej. 26 = cerveza, 24 = licores)
  ind_exe?:       1        // indicador de ítem exento de IVA
}

export interface ExportData {
  moneda:             string           // código de moneda (USD, EUR, etc.)
  forma_pago:         string           // forma de pago exportación
  modalidad_venta?:   string           // modalidad de venta
  clausula_venta:     string           // cláusula de venta (FOB, CIF, etc.)
  total_clausula?:    number           // total cláusula venta
  via_transporte:     string           // vía de transporte
  puerto_embarque:    string           // puerto de embarque
  puerto_desembarque: string           // puerto de desembarque
  pais_receptor:      string           // país del receptor
  pais_destino:       string           // país de destino
  tipo_bulto?:        string           // tipo de bulto
  total_bultos?:      number           // total de bultos
  peso_bruto?:        number           // peso bruto
  peso_neto?:         number           // peso neto
  flete?:             number           // flete
  seguro?:            number           // seguro
  comisiones_pct?:    number           // porcentaje de comisiones
  nacionalidad?:      string           // nacionalidad del transporte
}

export interface LiquidacionData {
  comisiones:         Array<{ descripcion: string; monto: number }>  // comisiones y otros cargos
}

export interface DteInput {
  document_type:        33 | 34 | 39 | 41 | 43 | 46 | 52 | 56 | 61 | 110 | 111 | 112
  folio:                number
  fecha_emision:        string          // YYYY-MM-DD
  rut_emisor:           string
  razon_social:         string
  giro:                 string
  direccion:            string
  comuna:               string
  total_amount:         number          // gross CLP integer
  rut_receptor?:        string          // required for types 33, 34, 43, 46, 52, 56, 61, 110, 111, 112
  razon_receptor?:      string          // required for types 33, 34, 43, 46, 52, 56, 61, 110, 111, 112
  giro_receptor?:       string          // required for types 33, 34, 43, 46, 52, 56, 61, 110, 111, 112
  direccion_receptor?:  string          // required for types 33, 34, 43, 46, 52, 56, 61, 110, 111, 112
  comuna_receptor?:     string          // required for types 33, 34, 43, 46, 52, 56, 61, 110, 111, 112
  fma_pago?:            1 | 2 | 3       // forma de pago: 1=contado, 2=crédito, 3=sin costo
  tpo_tran_venta?:      number          // tipo de transacción de venta (default 1)
  acteco?:              string          // código de actividad económica del emisor
  descuento_global?:    number          // descuento global en monto bruto CLP
  // campos para notas de crédito/débito (tipos 56 y 61)
  tipo_doc_ref?:        number          // tipo de documento referenciado
  folio_ref?:           number          // folio del documento referenciado
  fch_ref?:             string          // fecha del documento referenciado (YYYY-MM-DD)
  cod_ref?:             1 | 2 | 3       // código de referencia
  razon_ref?:           string          // razón de la referencia
  // campos adicionales para certificación
  export_data?:         ExportData      // datos específicos para documentos de exportación (110, 111, 112)
  liquidacion_data?:    LiquidacionData // datos específicos para liquidaciones (43)
  items:                DteLineItem[]
}

// ── Mapa de tasas de impuestos adicionales ────────────────────────────────────

const TASAS_IMP_ADIC: Record<number, number> = {
  26:  20.5,   // Cervezas y otras bebidas alcohólicas
  24:  31.5,   // Licores, Pisco y Destilados
  25:  20.5,   // Vinos, Chichas, Sidras
  27:  13,     // Aguas minerales y bebidas analcohólicas
  271: 18,     // Bebidas analcohólicas con elevado contenido de azúcar
  15:  10,     // IVA retenido total bebidas
  14:  12.5,   // IVA de margen de comercialización
  104: 5,      // Otros
}

// ── calcularImpuestosAdicionales ──────────────────────────────────────────────

/**
 * Calcula los totales de una factura con impuestos adicionales ad valorem.
 *
 * Para ítems con cod_imp_adic:
 *   neto = round(bruto / ((1 + tasa/100) * 1.19))
 *   MontoImp = round(neto * tasa / 100)
 *
 * Para ítems con ind_exe = 1: van a MntExe, excluidos de IVA e impuestos adicionales.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7
 */
export function calcularImpuestosAdicionales(items: DteLineItem[]): {
  mntNeto:    number
  mntExe:     number
  iva:        number
  imptoReten: Array<{ tipo: number; tasa: number; monto: number }>
  mntTotal:   number
} {
  let mntNeto      = 0
  let mntExe       = 0
  let brutoAfecto  = 0  // suma de brutos afectos a IVA (sin impuestos adicionales)
  // Accumulate additional tax amounts by code
  const impMap: Record<number, { tasa: number; monto: number }> = {}

  for (const item of items) {
    const bruto = Math.round(item.quantity * item.unit_price)

    if (item.ind_exe === 1) {
      // Exento: va a MntExe, no genera IVA ni impuestos adicionales
      mntExe += bruto
      continue
    }

    if (item.cod_imp_adic !== undefined) {
      const tasa = TASAS_IMP_ADIC[item.cod_imp_adic]
      if (tasa !== undefined) {
        const neto     = Math.round(bruto / ((1 + tasa / 100) * 1.19))
        const montoImp = Math.round(neto * tasa / 100)
        mntNeto += neto
        if (!impMap[item.cod_imp_adic]) {
          impMap[item.cod_imp_adic] = { tasa, monto: 0 }
        }
        impMap[item.cod_imp_adic].monto += montoImp
      } else {
        // Código desconocido: tratar como ítem normal afecto a IVA
        const neto = Math.round(bruto / 1.19)
        mntNeto     += neto
        brutoAfecto += bruto
      }
    } else {
      // Ítem normal afecto a IVA
      const neto = Math.round(bruto / 1.19)
      mntNeto     += neto
      brutoAfecto += bruto
    }
  }

  // IVA = bruto afecto - neto afecto (evita error de redondeo de mntNeto * 0.19)
  const iva = brutoAfecto - mntNeto
  const imptoReten = Object.entries(impMap).map(([tipo, { tasa, monto }]) => ({
    tipo:  parseInt(tipo),
    tasa,
    monto,
  }))
  const sumImptoReten = imptoReten.reduce((acc, r) => acc + r.monto, 0)
  const mntTotal = mntNeto + mntExe + iva + sumImptoReten

  return { mntNeto, mntExe, iva, imptoReten, mntTotal }
}

// ── aplicarDescuentoGlobal ────────────────────────────────────────────────────

/**
 * Proratea un descuento bruto entre los ítems afectos (no exentos) proporcionalmente
 * a su monto bruto, ajustando el unit_price de cada ítem.
 *
 * Retorna error DESCUENTO_EXCEDE_TOTAL si el descuento supera el total afecto.
 *
 * Requirements: 4.2, 4.3, 4.4
 */
export function aplicarDescuentoGlobal(
  items: DteLineItem[],
  descuentoBruto: number
): { items: DteLineItem[]; error?: string } {
  // Calcular total bruto afecto (excluir exentos)
  const totalAfecto = items
    .filter(i => i.ind_exe !== 1)
    .reduce((acc, i) => acc + Math.round(i.quantity * i.unit_price), 0)

  if (descuentoBruto > totalAfecto) {
    return { items, error: 'DESCUENTO_EXCEDE_TOTAL' }
  }

  if (totalAfecto === 0 || descuentoBruto === 0) {
    return { items }
  }

  // Prorratear el descuento entre ítems afectos proporcionalmente a su monto bruto
  const adjustedItems: DteLineItem[] = items.map(item => {
    if (item.ind_exe === 1) return { ...item }

    const bruto = Math.round(item.quantity * item.unit_price)
    const proporcion = bruto / totalAfecto
    const descuentoItem = Math.round(descuentoBruto * proporcion)
    const nuevoBruto = bruto - descuentoItem

    // Ajustar unit_price para reflejar el descuento (mantener quantity)
    const nuevoUnitPrice = item.quantity > 0
      ? Math.round(nuevoBruto / item.quantity)
      : item.unit_price

    return { ...item, unit_price: nuevoUnitPrice }
  })

  return { items: adjustedItems }
}

// SII resolution data — use the company's actual SII resolution for both environments
// For certification environment, use numero: 0, fecha: 2026-04-23
const RESOLUCION: Record<number, { fecha: string; numero: number }> = {
  39: { fecha: '2026-04-23', numero: 0 },  // Boleta electrónica - certificación
  41: { fecha: '2026-04-23', numero: 0 },  // Boleta exenta - certificación
  33: { fecha: '2026-04-23', numero: 0 },  // Factura electrónica - certificación
  34: { fecha: '2026-04-23', numero: 0 },  // Factura exenta - certificación
  43: { fecha: '2026-04-23', numero: 0 },  // Liquidación factura - certificación
  46: { fecha: '2026-04-23', numero: 0 },  // Factura de compra - certificación
  52: { fecha: '2026-04-23', numero: 0 },  // Guía de despacho - certificación
  56: { fecha: '2026-04-23', numero: 0 },  // Nota de débito - certificación
  61: { fecha: '2026-04-23', numero: 0 },  // Nota de crédito - certificación
  110: { fecha: '2026-04-23', numero: 0 },  // Factura de exportación - certificación
  111: { fecha: '2026-04-23', numero: 0 },  // Nota de débito exportación - certificación
  112: { fecha: '2026-04-23', numero: 0 },  // Nota de crédito exportación - certificación
}

// RUT receptor SII (always 60803000-K for boletas)
const RUT_SII = '60803000-K'

// ── buildDteXml ───────────────────────────────────────────────────────────────

/**
 * Constructs an unsigned SII-compliant DTE XML string (inner <Documento> only,
 * without TED — TED is added during signing when we have the CAF key).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.7, 3.8, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5, 4.1, 7.2, 7.3
 */
export function buildDteXml(input: DteInput): string {
  const {
    document_type,
    folio,
    fecha_emision,
    rut_emisor,
    razon_social,
    giro,
    direccion,
    comuna,
    total_amount,
    rut_receptor,
    razon_receptor,
    giro_receptor,
    direccion_receptor,
    comuna_receptor,
    fma_pago,
    tpo_tran_venta,
    acteco,
    descuento_global,
    tipo_doc_ref,
    folio_ref,
    fch_ref,
    cod_ref,
    razon_ref,
    export_data,
    liquidacion_data,
  } = input

  const isFactura = document_type === 33 || document_type === 34 || document_type === 43 || document_type === 46 || document_type === 52 || document_type === 56 || document_type === 61 || document_type === 110 || document_type === 111 || document_type === 112

  // ── Apply global discount if present ────────────────────────────────────────
  let workingItems = input.items
  let dscRcgGlobalXml = ''

  if (descuento_global && descuento_global > 0) {
    const result = aplicarDescuentoGlobal(input.items, descuento_global)
    if (result.error) {
      throw new Error(result.error)
    }
    workingItems = result.items
    dscRcgGlobalXml =
      `\n      <DscRcgGlobal>\n` +
      `        <NroLinDR>1</NroLinDR>\n` +
      `        <TpoMov>D</TpoMov>\n` +
      `        <TpoValor>$</TpoValor>\n` +
      `        <ValorDR>${descuento_global}</ValorDR>\n` +
      `      </DscRcgGlobal>`
  }

  // ── Line items ──────────────────────────────────────────────────────────────
  // Para facturas (33, 34, 43, 46, 52, 56, 61, 110, 111, 112): PrcItem y MontoItem deben ser NETO (sin IVA).
  // Para boletas (39, 41): PrcItem es BRUTO (incluye IVA).
  const detailLines = workingItems
    .map(
      (item, idx) => {
        const codImpAdicXml = item.cod_imp_adic !== undefined
          ? `      <CodImpAdic>${item.cod_imp_adic}</CodImpAdic>\n`
          : ''
        const indExeXml = item.ind_exe === 1
          ? `      <IndExe>1</IndExe>\n`
          : ''

        // Para facturas sin impuesto adicional: convertir precio bruto → neto
        // Para ítems exentos o con cod_imp_adic: calcularImpuestosAdicionales ya maneja la conversión
        let prcItem = item.unit_price
        let montoItem = Math.round(item.quantity * item.unit_price)
        if (isFactura && item.ind_exe !== 1 && item.cod_imp_adic === undefined) {
          // Para documentos exentos (34, 52) no convertir a neto
          if (document_type !== 34 && document_type !== 52) {
            prcItem  = Math.round(item.unit_price / 1.19)
            montoItem = Math.round(item.quantity * prcItem)
          }
        }

        return (
          `\n    <Detalle>\n` +
          `      <NroLinDet>${idx + 1}</NroLinDet>\n` +
          indExeXml +
          `      <NmbItem>${escapeXml(toIso88591Safe(item.name))}</NmbItem>\n` +
          `      <QtyItem>${item.quantity}</QtyItem>\n` +
          `      <PrcItem>${prcItem}</PrcItem>\n` +
          codImpAdicXml +
          `      <MontoItem>${montoItem}</MontoItem>\n` +
          `    </Detalle>`
        )
      }
    )
    .join('')

  // ── Totales ─────────────────────────────────────────────────────────────────
  let totalesXml: string

  if (document_type === 41 || document_type === 34 || document_type === 52) {
    // Documentos exentos: boleta exenta (41), factura exenta (34), guía de despacho (52)
    totalesXml =
      `\n      <Totales>\n` +
      `        <MntExe>${total_amount}</MntExe>\n` +
      `        <MntTotal>${total_amount}</MntTotal>\n` +
      `      </Totales>`
  } else {
    const hasImpAdic = workingItems.some(i => i.cod_imp_adic !== undefined)
    const hasExe     = workingItems.some(i => i.ind_exe === 1)

    if (hasImpAdic || hasExe) {
      // Use calcularImpuestosAdicionales for detailed breakdown
      const totales = calcularImpuestosAdicionales(workingItems)
      const mntExeXml = totales.mntExe > 0
        ? `        <MntExe>${totales.mntExe}</MntExe>\n`
        : ''
      const imptoRetenXml = totales.imptoReten
        .map(r =>
          `        <ImptoReten>\n` +
          `          <TipoImp>${r.tipo}</TipoImp>\n` +
          `          <TasaImp>${r.tasa}</TasaImp>\n` +
          `          <MontoImp>${r.monto}</MontoImp>\n` +
          `        </ImptoReten>\n`
        )
        .join('')
      totalesXml =
        `\n      <Totales>\n` +
        `        <MntNeto>${totales.mntNeto}</MntNeto>\n` +
        mntExeXml +
        (isFactura ? `        <TasaIVA>19</TasaIVA>\n` : '') +
        `        <IVA>${totales.iva}</IVA>\n` +
        imptoRetenXml +
        `        <MntTotal>${totales.mntTotal}</MntTotal>\n` +
        `      </Totales>`
    } else {
      const neto = Math.round(total_amount / 1.19)
      const iva  = total_amount - neto
      // Para facturas (33, 56, 61) el esquema DTE_v10.xsd requiere <TasaIVA> y <MntExe>
      const tasaIvaXml = isFactura ? `        <TasaIVA>19</TasaIVA>\n` : ''
      const mntExeXml  = isFactura ? `        <MntExe>0</MntExe>\n` : ''
      totalesXml =
        `\n      <Totales>\n` +
        `        <MntNeto>${neto}</MntNeto>\n` +
        mntExeXml +
        tasaIvaXml +
        `        <IVA>${iva}</IVA>\n` +
        `        <MntTotal>${total_amount}</MntTotal>\n` +
        `      </Totales>`
    }
  }

  // ── Receptor ────────────────────────────────────────────────────────────────
  let receptorXml: string
  if (isFactura) {
    // Tipos 33, 34, 43, 46, 52, 56, 61, 110, 111, 112: receptor completo con todos los campos obligatorios
    // Truncar automáticamente según límites del esquema SII (req 1.5)
    const rznRecep  = (razon_receptor ?? '').substring(0, 100)
    const giroRecep = (giro_receptor  ?? '').substring(0, 40)
    const dirRecep  = (direccion_receptor ?? '').substring(0, 70)
    const cmnaRecep = (comuna_receptor ?? '').substring(0, 20)

    // Para notas (56, 61): incluir giro/dir/comuna solo si tienen valor
    // Para facturas (33): son obligatorios según esquema SII
    const giroRecepXml = giroRecep ? `        <GiroRecep>${escapeXml(toIso88591Safe(giroRecep))}</GiroRecep>\n` : (document_type === 33 ? `        <GiroRecep></GiroRecep>\n` : '')
    const dirRecepXml  = dirRecep  ? `        <DirRecep>${escapeXml(toIso88591Safe(dirRecep))}</DirRecep>\n`   : (document_type === 33 ? `        <DirRecep></DirRecep>\n`   : '')
    const cmnaRecepXml = cmnaRecep ? `        <CmnaRecep>${escapeXml(toIso88591Safe(cmnaRecep))}</CmnaRecep>\n` : (document_type === 33 ? `        <CmnaRecep></CmnaRecep>\n` : '')

    receptorXml =
      `\n      <Receptor>\n` +
      `        <RUTRecep>${escapeXml(rut_receptor ?? '')}</RUTRecep>\n` +
      `        <RznSocRecep>${escapeXml(toIso88591Safe(rznRecep))}</RznSocRecep>\n` +
      giroRecepXml +
      dirRecepXml +
      cmnaRecepXml +
      `      </Receptor>`
  } else {
    receptorXml =
      `\n      <Receptor>\n` +
      `        <RUTRecep>66666666-6</RUTRecep>\n` +
      `        <RznSocRecep>Sin RUT</RznSocRecep>\n` +
      `      </Receptor>`
  }

  // ── IndServicio for boletas (types 39 and 41 only) ──────────────────────────
  // Task 4.4: omit IndServicio for types 33, 56, 61
  const indServicio = (document_type === 39 || document_type === 41)
    ? `\n        <IndServicio>3</IndServicio>`
    : ''

  // ── IdDoc extras for facturas (types 33, 34, 43, 46, 52, 56, 61, 110, 111, 112) ────────────────────────────────────
  // Task 4.4: TpoTranVenta and FmaPago for facturas
  const tpoTranVentaXml = isFactura
    ? `\n        <TpoTranVenta>${tpo_tran_venta ?? 1}</TpoTranVenta>`
    : ''
  const fmaPagoXml = isFactura
    ? `\n        <FmaPago>${fma_pago ?? 1}</FmaPago>`
    : ''

  const docId = `LibreDTE_T${document_type}F${folio}`

  // ── Emisor ──────────────────────────────────────────────────────────────────
  // El orden de elementos en <Emisor> es estricto y difiere entre esquemas:
  //   EnvioBOLETA: RUTEmisor, RznSocEmisor, GiroEmisor, DirOrigen, CmnaOrigen
  //   DTE_v10.xsd: RUTEmisor, RznSoc, GiroEmis, [Telefono], [CorreoEmisor], [Acteco], DirOrigen, CmnaOrigen
  const rznSocTag  = isFactura ? 'RznSoc'   : 'RznSocEmisor'
  const giroTag    = isFactura ? 'GiroEmis' : 'GiroEmisor'
  const giroXml    = giro      ? `\n        <${giroTag}>${escapeXml(toIso88591Safe(giro))}</${giroTag}>` : ''
  // Para facturas: orden es Telefono, CorreoEmisor, Acteco, DirOrigen, CmnaOrigen
  // Para boletas: orden es DirOrigen, CmnaOrigen (sin Acteco)
  const actecoXml  = (isFactura && acteco) ? `\n        <Acteco>${escapeXml(acteco)}</Acteco>` : ''
  const dirXml     = direccion ? `\n        <DirOrigen>${escapeXml(toIso88591Safe(direccion))}</DirOrigen>` : ''
  const cmnaXml    = comuna    ? `\n        <CmnaOrigen>${escapeXml(toIso88591Safe(comuna))}</CmnaOrigen>` : ''
  
  // Construir el bloque del emisor respetando el orden del esquema
  const emisorFieldsXml = isFactura
    ? `${giroXml}${actecoXml}${dirXml}${cmnaXml}` // Facturas: GiroEmis, Acteco, DirOrigen, CmnaOrigen
    : `${giroXml}${dirXml}${cmnaXml}`              // Boletas: GiroEmisor, DirOrigen, CmnaOrigen

  // ── Referencia block for notas de crédito/débito (types 56, 61, 111, 112) ──────────
  // Task 4.8: only include when tipo_doc_ref and folio_ref are present
  let referenciaXml = ''
  if ((document_type === 56 || document_type === 61 || document_type === 111 || document_type === 112) && tipo_doc_ref !== undefined && folio_ref !== undefined) {
    const fchRefXml    = fch_ref   ? `\n        <FchRef>${fch_ref}</FchRef>`         : ''
    const codRefXml    = cod_ref   ? `\n        <CodRef>${cod_ref}</CodRef>`          : ''
    const razonRefXml  = razon_ref ? `\n        <RazonRef>${escapeXml(toIso88591Safe(razon_ref))}</RazonRef>` : ''
    referenciaXml =
      `\n    <Referencia>\n` +
      `      <NroLinRef>1</NroLinRef>\n` +
      `      <TpoDocRef>${tipo_doc_ref}</TpoDocRef>\n` +
      `      <FolioRef>${folio_ref}</FolioRef>` +
      fchRefXml +
      codRefXml +
      razonRefXml +
      `\n    </Referencia>`
  }

  // ── Export data for export documents (types 110, 111, 112) ─────────────────
  let exportXml = ''
  if ((document_type === 110 || document_type === 111 || document_type === 112) && export_data) {
    const {
      moneda,
      forma_pago,
      modalidad_venta,
      clausula_venta,
      total_clausula,
      via_transporte,
      puerto_embarque,
      puerto_desembarque,
      pais_receptor,
      pais_destino,
      tipo_bulto,
      total_bultos,
      peso_bruto,
      peso_neto,
      flete,
      seguro,
      comisiones_pct,
      nacionalidad,
    } = export_data

    const modalidadVentaXml = modalidad_venta ? `\n        <ModalidadVenta>${escapeXml(modalidad_venta)}</ModalidadVenta>` : ''
    const totalClausulaXml = total_clausula ? `\n        <TotClausula>${total_clausula}</TotClausula>` : ''
    const tipoBultoXml = tipo_bulto ? `\n        <TipoBultos>${escapeXml(tipo_bulto)}</TipoBultos>` : ''
    const totalBultosXml = total_bultos ? `\n        <CantBultos>${total_bultos}</CantBultos>` : ''
    const pesoBrutoXml = peso_bruto ? `\n        <PesoBruto>${peso_bruto}</PesoBruto>` : ''
    const pesoNetoXml = peso_neto ? `\n        <PesoNeto>${peso_neto}</PesoNeto>` : ''
    const fleteXml = flete ? `\n        <MntFlete>${flete}</MntFlete>` : ''
    const seguroXml = seguro ? `\n        <MntSeguro>${seguro}</MntSeguro>` : ''
    const comisionesPctXml = comisiones_pct ? `\n        <PctComision>${comisiones_pct}</PctComision>` : ''
    const nacionalidadXml = nacionalidad ? `\n        <NacionalidadTransp>${escapeXml(nacionalidad)}</NacionalidadTransp>` : ''

    exportXml =
      `\n      <Transporte>\n` +
      `        <Aduana>\n` +
      `          <CodModVenta>${escapeXml(forma_pago)}</CodModVenta>${modalidadVentaXml}\n` +
      `          <CodClauVenta>${escapeXml(clausula_venta)}</CodClauVenta>${totalClausulaXml}\n` +
      `          <CodViaTransp>${escapeXml(via_transporte)}</CodViaTransp>\n` +
      `          <NombreTransp>${escapeXml(puerto_embarque)}</NombreTransp>${nacionalidadXml}\n` +
      `          <RUTCiaTransp>96790240-3</RUTCiaTransp>\n` +
      `          <NomCiaTransp>COMPAÑIA DE TRANSPORTE</NomCiaTransp>\n` +
      `          <IdAdicTransp>ADICIONAL</IdAdicTransp>\n` +
      `          <Booking>BOOKING123</Booking>\n` +
      `          <Operador>OPERADOR</Operador>\n` +
      `          <CodPtoEmbarque>${escapeXml(puerto_embarque)}</CodPtoEmbarque>\n` +
      `          <IdAdicPtoEmb>ADICIONAL</IdAdicPtoEmb>\n` +
      `          <CodPtoDesemb>${escapeXml(puerto_desembarque)}</CodPtoDesemb>\n` +
      `          <IdAdicPtoDesemb>ADICIONAL</IdAdicPtoDesemb>\n` +
      `          <Tara>1</Tara>${tipoBultoXml}${totalBultosXml}${pesoBrutoXml}${pesoNetoXml}${fleteXml}${seguroXml}${comisionesPctXml}\n` +
      `          <CodPaisRecep>${escapeXml(pais_receptor)}</CodPaisRecep>\n` +
      `          <CodPaisDestin>${escapeXml(pais_destino)}</CodPaisDestin>\n` +
      `        </Aduana>\n` +
      `      </Transporte>`
  }

  // ── Liquidacion data for liquidacion documents (type 43) ────────────────────
  let liquidacionXml = ''
  if (document_type === 43 && liquidacion_data && liquidacion_data.comisiones.length > 0) {
    const comisionesXml = liquidacion_data.comisiones
      .map((comision, idx) =>
        `\n    <Detalle>\n` +
        `      <NroLinDet>${workingItems.length + idx + 1}</NroLinDet>\n` +
        `      <NmbItem>${escapeXml(toIso88591Safe(comision.descripcion))}</NmbItem>\n` +
        `      <QtyItem>1</QtyItem>\n` +
        `      <PrcItem>${comision.monto}</PrcItem>\n` +
        `      <MontoItem>${comision.monto}</MontoItem>\n` +
        `    </Detalle>`
      )
      .join('')
    liquidacionXml = comisionesXml
  }

  return (
    `<DTE version="1.0">\n` +
    `  <Documento ID="${docId}">\n` +
    `    <Encabezado>\n` +
    `      <IdDoc>\n` +
    `        <TipoDTE>${document_type}</TipoDTE>\n` +
    `        <Folio>${folio}</Folio>\n` +
    `        <FchEmis>${fecha_emision}</FchEmis>${tpoTranVentaXml}${fmaPagoXml}${indServicio}\n` +
    `      </IdDoc>\n` +
    `      <Emisor>\n` +
    `        <RUTEmisor>${escapeXml(rut_emisor)}</RUTEmisor>\n` +
    `        <${rznSocTag}>${escapeXml(toIso88591Safe(razon_social))}</${rznSocTag}>${emisorFieldsXml}\n` +
    `      </Emisor>${receptorXml}${exportXml}${totalesXml}${dscRcgGlobalXml}\n` +
    `    </Encabezado>${detailLines}${liquidacionXml}${referenciaXml}\n` +
    `  </Documento>\n` +
    `</DTE>`
  )
}

// ── loadCredentials ────────────────────────────────────────────────────────────

/**
 * Loads and decrypts the PFX credentials for a restaurant.
 */
export async function loadCredentials(restaurantId: string): Promise<{
  privateKeyPem: string
  certificate: forge.pki.Certificate
  rutEnvia: string
  resolucion?: { fecha: string; numero: number }
} | { error: string }> {
  const supabase = createAdminClient()

  // 1. Load credential row
  const { data: cred, error: credErr } = await supabase
    .from('dte_credentials')
    .select(
      'cert_ciphertext, cert_iv, cert_auth_tag, pass_ciphertext, pass_iv, pass_auth_tag, cert_valid_to, rut_envia, fecha_resolucion, numero_resolucion'
    )
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (credErr || !cred) return { error: 'CERT_NOT_FOUND' }

  if (cred.cert_valid_to) {
    const validTo = new Date(cred.cert_valid_to)
    if (validTo <= new Date()) return { error: 'CERT_EXPIRED' }
  }

  // 2. Decrypt PFX
  let pfxBuffer: Buffer
  let pfxPassword: string
  try {
    pfxBuffer   = decrypt({ ciphertext: cred.cert_ciphertext, iv: cred.cert_iv, authTag: cred.cert_auth_tag })
    pfxPassword = decrypt({ ciphertext: cred.pass_ciphertext, iv: cred.pass_iv, authTag: cred.pass_auth_tag }).toString('utf8')
  } catch (e) {
    console.error('loadCredentials: decryption failed:', e)
    return { error: 'CERT_NOT_FOUND' }
  }

  // 3. Parse PFX
  let privateKeyPem: string
  let certificate: forge.pki.Certificate
  try {
    const p12Der  = forge.util.createBuffer(pfxBuffer.toString('binary'))
    const p12Asn1 = forge.asn1.fromDer(p12Der)
    const p12     = forge.pkcs12.pkcs12FromAsn1(p12Asn1, pfxPassword)

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const keyBag  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    if (!keyBag?.key) return { error: 'CERT_NOT_FOUND' }
    privateKeyPem = forge.pki.privateKeyToPem(keyBag.key as forge.pki.rsa.PrivateKey)

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBag  = certBags[forge.pki.oids.certBag]?.[0]
    if (!certBag?.cert) return { error: 'CERT_NOT_FOUND' }
    certificate = certBag.cert
  } catch (e) {
    console.error('loadCredentials: PFX parsing failed:', e)
    return { error: 'CERT_NOT_FOUND' }
  }

  let rutEnvia = cred.rut_envia
  if (!rutEnvia) {
    rutEnvia = extractRutFromCert(certificate)
  }

  return { 
    privateKeyPem, 
    certificate, 
    rutEnvia,
    resolucion: cred.fecha_resolucion ? { fecha: cred.fecha_resolucion, numero: cred.numero_resolucion } : undefined
  }
}

// ── signDte ───────────────────────────────────────────────────────────────────

/**
 * Builds the complete EnvioBOLETA/EnvioDTE XML:
 *   1. Loads PFX from dte_credentials
 *   2. Loads CAF XML from dte_caf_files (for TED timbre)
 *   3. Builds TED and signs it with the CAF private key
 *   4. Signs the <DTE> document with the restaurant cert
 *   5. Wraps in <EnvioBOLETA> with <Caratula> and signs the envelope
 *
 * Requirements: 3.4, 3.5, 3.6
 */
export async function signDte(
  restaurantId: string,
  xml: string,
  cafId?: string
): Promise<{ signed_xml: string } | { error: string }> {
  // 1-4. Load credentials using the refactored helper
  const creds = await loadCredentials(restaurantId)
  if ('error' in creds) return creds
  
  const { privateKeyPem, certificate, rutEnvia } = creds
  const supabase = createAdminClient()

  // 5. Load CAF XML if cafId provided — dte_cafs stores it AES-256-GCM encrypted
  let cafXml: string | null = null
  if (cafId) {
    const { data: cafRow } = await supabase
      .from('dte_cafs')
      .select('xml_ciphertext, xml_iv, xml_auth_tag')
      .eq('id', cafId)
      .maybeSingle()

    if (cafRow) {
      try {
        cafXml = decrypt({
          ciphertext: cafRow.xml_ciphertext,
          iv:         cafRow.xml_iv,
          authTag:    cafRow.xml_auth_tag,
        }).toString('utf8')
        const cafBlockMatch = /(<CAF[\s\S]*?<\/CAF>)/.exec(cafXml)
      } catch (e) {
        console.error('signDte: CAF decryption failed:', e)
      }
    }
  } else {
    // No cafId provided — TED will have no CAF block
  }

  // 6. Build the full envelope
  try {
    const signedXml = buildEnvelope(xml, privateKeyPem, certificate, rutEnvia, cafXml, creds.resolucion)
    return { signed_xml: signedXml }
  } catch (e) {
    console.error('signDte: signing failed:', e)
    return { error: `SIGN_ERROR: ${(e as Error).message}` }
  }
}

// ── buildEnvelope ─────────────────────────────────────────────────────────────

/**
 * Builds the complete EnvioBOLETA XML with:
 *   - TED timbre (signed with CAF RSA key if available, else placeholder)
 *   - DTE signature (restaurant cert)
 *   - Envelope signature (restaurant cert)
 */
function buildEnvelope(
  dteXml: string,
  privateKeyPem: string,
  certificate: forge.pki.Certificate,
  rutEnvia: string,
  cafXml: string | null,
  resolucionOverride?: { fecha: string; numero: number }
): string {
  // Parse document type and folio from the XML
  const tipoMatch  = /<TipoDTE>(\d+)<\/TipoDTE>/.exec(dteXml)
  const folioMatch = /<Folio>(\d+)<\/Folio>/.exec(dteXml)
  const fechaMatch = /<FchEmis>([^<]+)<\/FchEmis>/.exec(dteXml)
  const rutEmisorMatch = /<RUTEmisor>([^<]+)<\/RUTEmisor>/.exec(dteXml)
  const rutRecepMatch  = /<RUTRecep>([^<]+)<\/RUTRecep>/.exec(dteXml)
  const rznRecepMatch  = /<RznSocRecep>([^<]+)<\/RznSocRecep>/.exec(dteXml)
  const mntTotalMatch  = /<MntTotal>(\d+)<\/MntTotal>/.exec(dteXml)
  const nmbItemMatch   = /<NmbItem>([^<]+)<\/NmbItem>/.exec(dteXml)

  const tipoDTE  = tipoMatch  ? parseInt(tipoMatch[1])  : 39
  const folio    = folioMatch ? parseInt(folioMatch[1]) : 0
  const fecha    = fechaMatch?.[1]  ?? new Date().toISOString().split('T')[0]
  const rutEmisor = rutEmisorMatch?.[1] ?? ''
  const rutRecep  = rutRecepMatch?.[1]  ?? '66666666-6'
  const rznRecep  = rznRecepMatch?.[1]  ?? 'Sin RUT'
  const mntTotal  = mntTotalMatch ? parseInt(mntTotalMatch[1]) : 0
  const it1       = nmbItemMatch?.[1] ?? 'Consumo'

  const isBoleta = tipoDTE === 39 || tipoDTE === 41
  const resol    = resolucionOverride ?? RESOLUCION[tipoDTE] ?? RESOLUCION[39]
  const nowDate = new Date()
  const offsetMs = nowDate.getTimezoneOffset() * 60000
  const tmst     = new Date(nowDate.getTime() - offsetMs).toISOString().substring(0, 19)
  const docId    = `LibreDTE_T${tipoDTE}F${folio}`
  const setId    = 'LibreDTE_SetDoc'

  // ── Build TED ───────────────────────────────────────────────────────────────
  let cafBlock = ''
  if (cafXml) {
    const cafMatch = /(<CAF[\s\S]*?<\/CAF>)/.exec(cafXml)
    if (cafMatch) {
      cafBlock = cafMatch[1].trim()
    }
  }

  // Build the DD with whitespace for the XML output
  const ddContent =
    `\n    <RE>${rutEmisor}</RE>\n` +
    `    <TD>${tipoDTE}</TD>\n` +
    `    <F>${folio}</F>\n` +
    `    <FE>${fecha}</FE>\n` +
    `    <RR>${rutRecep}</RR>\n` +
    `    <RSR>${rznRecep}</RSR>\n` +
    `    <MNT>${mntTotal}</MNT>\n` +
    `    <IT1>${it1}</IT1>\n` +
    (cafBlock ? `    ${cafBlock}\n` : '') +
    `    <TSTED>${tmst}</TSTED>\n  `

  const ddXml = `<DD>${ddContent}</DD>`

  // PHP signs the DD using getFlattened('/TED/DD') where the TED is parsed standalone.
  // In that context, DD has NO inherited namespaces.
  // The SII verifies using the same method.
  // We must sign the DD flattened WITHOUT any namespace declarations.
  const cafBlockFlat = cafBlock.replace(/>\s+</g, '><').replace(/\n/g, '')
  const ddForFrmt =
    `<DD>` +
    `<RE>${rutEmisor}</RE>` +
    `<TD>${tipoDTE}</TD>` +
    `<F>${folio}</F>` +
    `<FE>${fecha}</FE>` +
    `<RR>${rutRecep}</RR>` +
    `<RSR>${rznRecep}</RSR>` +
    `<MNT>${mntTotal}</MNT>` +
    `<IT1>${it1}</IT1>` +
    (cafBlockFlat ? cafBlockFlat : '') +
    `<TSTED>${tmst}</TSTED>` +
    `</DD>`

  const frmtValue = signTed(ddForFrmt, cafXml, privateKeyPem).replace(/\r?\n/g, '')

  const tedXml =
    `<TED version="1.0">\n` +
    `  ${ddXml}\n` +
    `  <FRMT algoritmo="SHA1withRSA">${frmtValue}</FRMT>\n` +
    `</TED>`

  const documentoWithTed = dteXml.replace(
    `</Documento>`,
    `  ${tedXml}\n  <TmstFirma>${tmst}</TmstFirma></Documento>`
  )

  const rootTag = isBoleta ? 'EnvioBOLETA' : 'EnvioDTE'
  const xsdName = isBoleta ? 'EnvioBOLETA_v11.xsd' : 'EnvioDTE_v10.xsd'
  const xmlDecl = `<?xml version="1.0" encoding="ISO-8859-1"?>\n`

  const caratulaXml =
    `<Caratula version="1.0">\n` +
    `      <RutEmisor>${rutEmisor}</RutEmisor>\n` +
    `      <RutEnvia>${rutEnvia}</RutEnvia>\n` +
    `      <RutReceptor>${RUT_SII}</RutReceptor>\n` +
    `      <FchResol>${resol.fecha}</FchResol>\n` +
    `      <NroResol>${resol.numero}</NroResol>\n` +
    `      <TmstFirmaEnv>${tmst}</TmstFirmaEnv>\n` +
    `      <SubTotDTE>\n` +
    `        <TpoDTE>${tipoDTE}</TpoDTE>\n` +
    `        <NroDTE>1</NroDTE>\n` +
    `      </SubTotDTE>\n` +
    `    </Caratula>`

  const unsignedEnvelope =
    `<${rootTag} xmlns="http://www.sii.cl/SiiDte" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.sii.cl/SiiDte ${xsdName}" ` +
    `version="1.0">` +
    `<SetDTE ID="${setId}">` +
    caratulaXml +
    documentoWithTed +
    `</SetDTE>` +
    `</${rootTag}>`

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DOMParser } = require('@xmldom/xmldom')
  const c14n = new C14nCanonicalization()

  // PHP canonicalizes Documento from the DTE context (not EnvioBOLETA context).
  // In the DTE context, Documento has NO inherited namespaces (DTE has no xmlns declaration).
  // The SII verifies using the same DTE-context canonicalization.
  // We must parse just the DTE fragment to get the correct canonical.
  const dteXmlForDigest =
    `<DTE version="1.0">` +
    documentoWithTed +
    `</DTE>`
  const dteDocForDigest = new DOMParser().parseFromString(dteXmlForDigest, 'text/xml')
  const documentoElForDigest = dteDocForDigest.getElementsByTagName('Documento')[0]
  const canonicalDocumento = c14n.process(documentoElForDigest, {})

  // Debug: save canonical to file
  try {
    require('fs').writeFileSync('/tmp/node_canonicalDocumento.xml', canonicalDocumento)
  } catch {}

  const digestValue = crypto.createHash('sha1').update(Buffer.from(canonicalDocumento, 'latin1')).digest('base64')

  // PHP uses self-closing tags in the SignedInfo XML that appears in the final XML
  // (generated by saveXML). The SignedInfo that gets SIGNED uses explicit closing tags
  // (generated by saveHTML). These are different strings but the SII verifies using
  // the SignedInfo as it appears in the XML (self-closing), not what was signed.
  // We must match PHP: sign with explicit closing tags, but include self-closing in XML.
  const signedInfoXmlForSigning =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${docId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`

  // Self-closing version for the XML output (matches PHP's saveXML output)
  const signedInfoXml =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${docId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`

  const docSigner = crypto.createSign('RSA-SHA1')
  docSigner.update(signedInfoXmlForSigning, 'utf8')
  const signatureBytes = docSigner.sign({ key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING })
  const signatureValue = signatureBytes.toString('base64').match(/.{1,64}/g)!.join('\n')

  const certPem = forge.pki.certificateToPem(certificate)
  const certBody = certPem.replace(/-----[^-]+-----/g, '').replace(/\r?\n/g, '').trim()
  const certWrapped = certBody.match(/.{1,64}/g)?.join('\n') ?? certBody

  const rsaKey = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey & {
    n: forge.jsbn.BigInteger; e: forge.jsbn.BigInteger
  }
  const modulusBytes = rsaKey.n.toByteArray()
  const modulusRaw = Buffer.from(
    new Uint8Array(modulusBytes.slice(modulusBytes[0] === 0 ? 1 : 0))
  ).toString('base64')
  const modulus = modulusRaw.match(/.{1,64}/g)?.join('\n') ?? modulusRaw
  const exponent = Buffer.from(new Uint8Array(rsaKey.e.toByteArray())).toString('base64')

  const keyInfoXml =
    `<KeyInfo><KeyValue><RSAKeyValue>` +
    `<Modulus>${modulus}</Modulus>` +
    `<Exponent>${exponent}</Exponent>` +
    `</RSAKeyValue></KeyValue>` +
    `<X509Data><X509Certificate>${certWrapped}</X509Certificate></X509Data></KeyInfo>`

  const dteSignatureXml =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfoXml +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    keyInfoXml +
    `</Signature>`

  const signedDte = documentoWithTed.replace('</DTE>', dteSignatureXml + '</DTE>')

  const envelopeForSetDte =
    `<${rootTag} xmlns="http://www.sii.cl/SiiDte" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.sii.cl/SiiDte ${xsdName}" ` +
    `version="1.0">\n` +
    `  <SetDTE ID="${setId}">\n` +
    `    ${caratulaXml}\n` +
    `    ${signedDte}\n` +
    `  </SetDTE>` +
    `</${rootTag}>`

  const envDoc2 = new DOMParser().parseFromString(envelopeForSetDte, 'text/xml')
  const setDteEl = envDoc2.getElementsByTagName('SetDTE')[0]
  // SetDTE inherits xmlns:xsi from EnvioBOLETA — pass it as ancestor namespace
  // so the canonical includes it (matching PHP's C14N behavior)
  const setDteAncestorNs = [
    { prefix: 'xsi', namespaceURI: 'http://www.w3.org/2001/XMLSchema-instance' }
  ]
  const canonicalSetDte = c14n.process(setDteEl, { ancestorNamespaces: setDteAncestorNs })

  const setDteDigestValue = crypto.createHash('sha1').update(Buffer.from(canonicalSetDte, 'latin1')).digest('base64')

  const setDteSignedInfoXmlForSigning =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${setId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${setDteDigestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`

  // Self-closing version for the XML output (matches PHP's saveXML output)
  const setDteSignedInfoXml =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${setId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${setDteDigestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`

  const setSigner = crypto.createSign('RSA-SHA1')
  setSigner.update(setDteSignedInfoXmlForSigning, 'utf8')
  const setSignatureBytes = setSigner.sign({ key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING })
  const setDteSignatureValue = setSignatureBytes.toString('base64').match(/.{1,64}/g)!.join('\n')

  const envelopeSignatureXml =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    setDteSignedInfoXml +
    `<SignatureValue>${setDteSignatureValue}</SignatureValue>` +
    keyInfoXml +
    `</Signature>`

  const signedEnvelope =
    `<${rootTag} xmlns="http://www.sii.cl/SiiDte" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.sii.cl/SiiDte ${xsdName}" ` +
    `version="1.0">\n` +
    `  <SetDTE ID="${setId}">\n` +
    `    ${caratulaXml}\n` +
    `    ${signedDte}\n` +
    `  </SetDTE>\n` +
    envelopeSignatureXml +
    `</${rootTag}>`

  return xmlDecl + signedEnvelope
}

// ── signTed ───────────────────────────────────────────────────────────────────

/**
 * Signs the TED DD block with the CAF RSA private key.
 * Falls back to the restaurant cert key if CAF key is unavailable.
 */
function signTed(
  ddXml: string,
  cafXml: string | null,
  fallbackKeyPem: string
): string {
  let finalKey: crypto.KeyObject | string = fallbackKeyPem

  if (cafXml) {
    try {
      const rsaskMatch = /<RSASK>([\s\S]*?)<\/RSASK>/.exec(cafXml)
      if (rsaskMatch && rsaskMatch[1]) {
        let rawContent = rsaskMatch[1].trim()
        
        let pemToTry = ''
        if (rawContent.includes('BEGIN')) {
          // The SII CAF already provides the key as a properly formatted PEM string
          pemToTry = rawContent
          console.log('signTed: RSASK contains BEGIN header natively. Using directly.')
        } else {
          // If it's a naked base64, wrap it.
          const rawB64 = rawContent.replace(/\s/g, '')
          const wrappedB64 = rawB64.match(/.{1,64}/g)?.join('\n') ?? rawB64
          pemToTry = `-----BEGIN PRIVATE KEY-----\n${wrappedB64}\n-----END PRIVATE KEY-----`
          console.log('signTed: RSASK is naked base64. Wrapping as PKCS#8.')
        }

        try {
          finalKey = crypto.createPrivateKey(pemToTry)
          console.log('signTed: RSASK parsed successfully!')
        } catch (e) {
          if (!rawContent.includes('BEGIN')) {
            // Try PKCS#1 as fallback for naked base64
            const rawB64 = rawContent.replace(/\s/g, '')
            const wrappedB64 = rawB64.match(/.{1,64}/g)?.join('\n') ?? rawB64
            pemToTry = `-----BEGIN RSA PRIVATE KEY-----\n${wrappedB64}\n-----END RSA PRIVATE KEY-----`
            finalKey = crypto.createPrivateKey(pemToTry)
            console.log('signTed: RSASK parsed successfully via PKCS#1 fallback!')
          } else {
            throw e // rethrow if natively it failed
          }
        }
      }
    } catch (e) {
      console.warn('signTed: could not parse RSASK key, using cert key as fallback:', e)
    }
  }

  const signer = crypto.createSign('RSA-SHA1')
  signer.update(Buffer.from(ddXml, 'latin1'))
  return signer.sign(finalKey, 'base64')
}

// ── signSeed ──────────────────────────────────────────────────────────────────

/**
 * Construye y firma el XML para la solicitud de token (TokenRequest) 
 * utilizando la semilla proporcionada por el SII.
 */
export function signSeed(
  seed: string,
  privateKeyPem: string,
  certificate: forge.pki.Certificate
): string {
  const xml = `<getToken><item><Semilla>${seed}</Semilla></item></getToken>`
  
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SignedXml } = require('xml-crypto')

  const certPem       = forge.pki.certificateToPem(certificate)
  const certBody    = certPem.replace(/-----[^-]+-----/g, '').replace(/\r?\n/g, '').trim()
  const certWrapped = certBody.match(/.{1,64}/g)?.join('\n') ?? certBody

  const keyInfoContent = `<X509Data><X509Certificate>\n${certWrapped}\n</X509Certificate></X509Data>`

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    getKeyInfoContent: () => keyInfoContent,
  })
  
  sig.addReference({
    xpath:           "//*[local-name(.)='getToken']",
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms:      ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
  })
  
  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
  sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
  
  sig.computeSignature(xml)
  
  return sig.getSignedXml()
}

// ── extractRutFromCert ────────────────────────────────────────────────────────

/**
 * Chilean CA (E-Sign) stores the RUT in subjectAltName as otherName,
 * but node-forge doesn't parse otherName values easily.
 * We fall back to reading the raw extension bytes for the RUT pattern.
 */
function extractRutFromCert(cert: forge.pki.Certificate): string {
  // Strategy 1: scan all subject fields for a RUT pattern
  try {
    for (const attr of cert.subject.attributes) {
      const val = String(attr.value ?? '')
      const m = /(\d{7,8}-[\dkK])/.exec(val)
      if (m) return m[1]
    }
  } catch { /* ignore */ }

  // Strategy 2: scan SAN altNames
  try {
    const sanExt = cert.getExtension('subjectAltName') as { altNames?: Array<{ type: number; value: string }> } | null
    if (sanExt?.altNames) {
      for (const alt of sanExt.altNames) {
        const val = String(alt.value ?? '')
        const m = /(\d{7,8}-[\dkK])/.exec(val)
        if (m) return m[1]
      }
    }
  } catch { /* ignore */ }

  // Strategy 3: convert cert to PEM and scan the decoded text for RUT pattern
  try {
    const der   = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).bytes()
    const b64   = forge.util.encode64(der)
    // Decode base64 to binary and scan for RUT-like patterns in the raw bytes
    const raw   = Buffer.from(b64, 'base64').toString('latin1')
    const m     = /(\d{7,8}-[\dkK])/.exec(raw)
    if (m) return m[1]
  } catch { /* ignore */ }

  console.warn('extractRutFromCert: could not extract RUT, RutEnvia will be empty')
  return ''
}

// ── escapeXml ─────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;')
}

// ── toIso88591Safe ────────────────────────────────────────────────────────────

/**
 * Converts a UTF-8 string to a form safe for ISO-8859-1 XML by replacing
 * characters outside the latin1 range (U+0100 and above) with XML numeric
 * character references (&#xNNNN;).
 *
 * Characters in the latin1 range (U+0000–U+00FF) are kept as-is so that
 * common Spanish characters (á, é, í, ó, ú, ñ, ü, etc.) are preserved as
 * their single-byte latin1 equivalents when the string is later encoded with
 * Buffer.from(str, 'latin1').
 *
 * This is critical for the TED <IT1> field: the FRMT signature is computed
 * over the raw bytes of the DD block as ISO-8859-1, so the bytes that go into
 * the hash must match the bytes in the transmitted XML.
 */
function toIso88591Safe(str: string): string {
  // Normalize accented chars and ñ to ASCII equivalents so the SII
  // doesn't reject the DTE for encoding issues.
  // ñ/Ñ → n/N, á/é/í/ó/ú/ü → a/e/i/o/u, Á/É/Í/Ó/Ú/Ü → A/E/I/O/U
  const MAP: Record<string, string> = {
    'á':'a','à':'a','ä':'a','â':'a','ã':'a',
    'é':'e','è':'e','ë':'e','ê':'e',
    'í':'i','ì':'i','ï':'i','î':'i',
    'ó':'o','ò':'o','ö':'o','ô':'o','õ':'o',
    'ú':'u','ù':'u','ü':'u','û':'u',
    'ñ':'n','ç':'c',
    'Á':'A','À':'A','Ä':'A','Â':'A','Ã':'A',
    'É':'E','È':'E','Ë':'E','Ê':'E',
    'Í':'I','Ì':'I','Ï':'I','Î':'I',
    'Ó':'O','Ò':'O','Ö':'O','Ô':'O','Õ':'O',
    'Ú':'U','Ù':'U','Ü':'U','Û':'U',
    'Ñ':'N','Ç':'C',
  }
  let result = ''
  for (const ch of str) {
    if (MAP[ch]) {
      result += MAP[ch]
    } else {
      const cp = ch.codePointAt(0) ?? 0
      // Keep latin-1 range as-is, encode anything outside as XML entity
      result += cp > 0x00FF ? `&#x${cp.toString(16).toUpperCase()};` : ch
    }
  }
  return result
}
