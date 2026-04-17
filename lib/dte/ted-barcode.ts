// ─────────────────────────────────────────────────────────────────────────────
// lib/dte/ted-barcode.ts
//
// Genera el código de barras PDF417 del TED (Timbre Electrónico del DTE)
// usando bwip-js en Node.js. Devuelve un PNG en base64 listo para incrustar
// en el PDF con @react-pdf/renderer.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un PNG base64 del código PDF417 a partir del XML del bloque <TED>.
 * El contenido del código es el XML del <DD> (datos del documento) sin espacios
 * extra, tal como lo especifica el SII.
 *
 * @param tedXml  Bloque XML completo del TED: <TED version="1.0">...</TED>
 * @returns       PNG en base64 (sin prefijo data:image/png;base64,)
 */
export async function generateTedBarcode(tedXml: string): Promise<string> {
  // Extraer solo el bloque <DD>...</DD> que es lo que va en el código de barras
  const ddMatch = /<DD>[\s\S]*?<\/DD>/.exec(tedXml)
  if (!ddMatch) {
    throw new Error('TED inválido: no se encontró el bloque <DD>')
  }

  // El contenido del PDF417 es el XML del DD normalizado (sin saltos de línea extra)
  const ddContent = ddMatch[0]
    .replace(/\r\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim()

  // bwip-js en Node.js
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bwipjs = require('bwip-js') as typeof import('bwip-js')

  const pngBuffer: Buffer = await bwipjs.toBuffer({
    bcid:          'pdf417',
    text:          ddContent,
    scale:         2,
    height:        12,        // altura en mm (el SII exige mínimo 10mm)
    width:         60,        // ancho en mm
    columns:       13,        // columnas PDF417 (estándar SII)
    eclevel:       2,         // nivel de corrección de errores
    includetext:   false,
    textxalign:    'center',
  })

  return pngBuffer.toString('base64')
}
