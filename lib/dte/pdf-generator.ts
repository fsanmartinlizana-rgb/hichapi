// ─────────────────────────────────────────────────────────────────────────────
// lib/dte/pdf-generator.ts
//
// Orquesta el pipeline completo de generación de PDF para un DTE:
//   1. Parsear el XML firmado
//   2. Generar el código PDF417 del TED
//   3. Renderizar el PDF con @react-pdf/renderer
// ─────────────────────────────────────────────────────────────────────────────

import { parseDteXml } from './pdf-parser'
import { generateTedBarcode } from './ted-barcode'
import { renderDtePdf } from './pdf-renderer'

export interface GenerateDtePdfResult {
  ok:      boolean
  buffer?: Buffer
  error?:  string
}

/**
 * Genera el PDF de representación impresa de un DTE a partir de su XML firmado.
 *
 * @param signedXml  Contenido del XML firmado (string, no base64)
 * @param logoUrl    URL pública del logo del restaurante (opcional)
 * @returns          { ok: true, buffer } o { ok: false, error }
 */
export async function generateDtePdf(
  signedXml: string,
  logoUrl?:  string,
): Promise<GenerateDtePdfResult> {
  try {
    console.log('[pdf-generator] Starting PDF generation')
    
    // 1. Parsear el XML
    console.log('[pdf-generator] Parsing XML')
    const dte = parseDteXml(signedXml)

    if (!dte.folio || !dte.tipoDte) {
      return { ok: false, error: 'XML inválido: no se pudo extraer folio o tipo de documento' }
    }

    console.log('[pdf-generator] Parsed DTE:', { folio: dte.folio, tipoDte: dte.tipoDte })

    // 2. Generar código de barras PDF417 del TED
    console.log('[pdf-generator] Generating TED barcode')
    let tedPngB64 = ''
    if (dte.tedXml) {
      try {
        tedPngB64 = await generateTedBarcode(dte.tedXml)
        console.log('[pdf-generator] TED barcode generated successfully')
      } catch (tedErr) {
        // TED fallido no bloquea el PDF — se muestra sin timbre
        console.warn('[pdf-generator] No se pudo generar el TED:', tedErr)
      }
    }

    // 3. Renderizar PDF
    console.log('[pdf-generator] Rendering PDF')
    const buffer = await renderDtePdf(dte, tedPngB64, logoUrl)
    console.log('[pdf-generator] PDF rendered successfully')

    return { ok: true, buffer }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[pdf-generator] Error generando PDF DTE:', msg)
    console.error('[pdf-generator] Stack trace:', err instanceof Error ? err.stack : 'No stack trace')
    return { ok: false, error: msg }
  }
}
