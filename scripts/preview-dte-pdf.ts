/**
 * scripts/preview-dte-pdf.ts
 *
 * Genera un PDF de prueba desde el XML de referencia y lo guarda en /tmp.
 *
 * Uso:
 *   npx tsx scripts/preview-dte-pdf.ts
 *
 * El PDF queda en: /tmp/factura_preview.pdf
 * Ábrelo con: open /tmp/factura_preview.pdf
 */

import fs from 'fs'
import path from 'path'
import { generateDtePdf } from '../lib/dte/pdf-generator'

async function main() {
  // Leer el XML de referencia
  const xmlPath = path.join(process.cwd(), '.kiro/SII/APISII/xml/factura/valida.xml')

  if (!fs.existsSync(xmlPath)) {
    console.error('❌ No se encontró el XML en:', xmlPath)
    process.exit(1)
  }

  const xmlContent = fs.readFileSync(xmlPath, 'utf-8')
  console.log('📄 XML leído:', xmlPath)

  // Logo opcional — usa el de labodega si quieres verlo con logo
  const logoUrl = 'https://labodega.realdev.cl/assets/img/brand/logo.png'

  console.log('⚙️  Generando PDF...')
  const result = await generateDtePdf(xmlContent, logoUrl)

  if (!result.ok || !result.buffer) {
    console.error('❌ Error generando PDF:', result.error)
    process.exit(1)
  }

  const outPath = '/tmp/factura_preview.pdf'
  fs.writeFileSync(outPath, result.buffer)

  console.log('✅ PDF generado exitosamente')
  console.log('📁 Guardado en:', outPath)
  console.log('')
  console.log('Para abrirlo:')
  console.log('  open /tmp/factura_preview.pdf')
}

main().catch(err => {
  console.error('❌ Error inesperado:', err)
  process.exit(1)
})
