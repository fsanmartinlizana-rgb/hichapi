import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@/lib/supabase/server'
import { loadCredentials, buildDteXml, signDte } from '@/lib/dte/signer'
import { getSiiTokenFactura, sendFacturaToSII, SiiEnvironment } from '@/lib/dte/sii-client'
import { takeNextFolio } from '@/lib/dte/folio'

/**
 * Script de prueba rápido para enviar una factura electrónica (tipo 33) al SII.
 *
 * Uso:
 *   npx tsx scripts/test-sii-factura.ts <restaurant_id>
 *
 * Opciones de entorno:
 *   El entorno (certificacion/produccion) se lee desde dte_environment del restaurante.
 *
 * Datos del receptor de prueba (empresa ficticia para certificación):
 *   RUT:      76354771-K
 *   Razón:    Empresa de Prueba SpA
 *   Giro:     Servicios de alimentación
 *   Dirección: Av. Providencia 1234
 *   Comuna:   Providencia
 */
async function runTest() {
  const restaurantId = process.argv[2]
  if (!restaurantId) {
    console.error('❌ Error: Debes proveer un restaurant_id como argumento.')
    console.error('Ejemplo: npx tsx scripts/test-sii-factura.ts "123e4567-e89b-12d3-a456-426614174000"')
    process.exit(1)
  }

  const supabase = createAdminClient()

  console.log(`\n🚀 Iniciando prueba de emisión de FACTURA para el restaurante: ${restaurantId}`)

  // ── 1. Cargar restaurante ──────────────────────────────────────────────────
  const { data: restaurant, error: restErr } = await supabase
    .from('restaurants')
    .select('rut, razon_social, giro, address, direccion, comuna, dte_environment')
    .eq('id', restaurantId)
    .single()

  if (restErr || !restaurant) {
    console.error('❌ Error cargando el restaurante:', restErr?.message || 'No encontrado')
    process.exit(1)
  }

  const environment: SiiEnvironment = restaurant.dte_environment === 'production' ? 'produccion' : 'certificacion'
  console.log(`✅ Restaurante: ${restaurant.razon_social} (RUT: ${restaurant.rut}) — Entorno: ${environment}`)

  // ── 2. Cargar credenciales ─────────────────────────────────────────────────
  const creds = await loadCredentials(restaurantId)
  if ('error' in creds) {
    console.error(`❌ Error cargando credenciales: ${creds.error}`)
    process.exit(1)
  }
  console.log(`✅ Credenciales OK. RutEnvia: ${creds.rutEnvia}`)

  // ── 3. Tomar folio tipo 33 ─────────────────────────────────────────────────
  console.log('\n📌 Solicitando folio para tipo 33 (Factura Electrónica)...')
  const folioResult = await takeNextFolio(restaurantId, 33)
  if ('error' in folioResult) {
    console.error(`❌ Error solicitando folio: ${folioResult.error}`)
    console.error('   Asegúrate de haber subido un CAF de tipo 33 en el panel /dte')
    process.exit(1)
  }

  const { folio, caf_id } = folioResult
  console.log(`✅ Folio asignado: ${folio} (CAF ID: ${caf_id})`)

  // ── 4. Construir XML ───────────────────────────────────────────────────────
  // Usar fecha local (no UTC) para evitar que el timezone offset cambie el día
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

  const unsignedXml = buildDteXml({    document_type:      33,
    folio,
    fecha_emision:      today,
    rut_emisor:         restaurant.rut ?? '',
    razon_social:       restaurant.razon_social ?? '',
    giro:               restaurant.giro ?? 'Restaurante',
    direccion:          (restaurant as any).direccion ?? restaurant.address ?? 'Dirección de prueba',
    comuna:             (restaurant as any).comuna ?? '',
    acteco:             (restaurant as any).acteco ?? '463020',  // Acteco real del RUT 77042148-9
    total_amount:       11900,   // $11.900 bruto (neto $10.000 + IVA $1.900)
    items: [
      { name: 'Consumo de prueba factura', quantity: 1, unit_price: 11900 }  // precio BRUTO — buildDteXml convierte a neto para facturas
    ],
    // Receptor de prueba — mismo RUT que usa el PHP de referencia
    rut_receptor:       '10127966-9',
    razon_receptor:     'LILIANA FUENTES PLAZA',
    giro_receptor:      'Retail',
    direccion_receptor: 'Calle Falsa 123',
    comuna_receptor:    'Santiago',
    fma_pago:           1,   // contado
  })
  console.log('✅ XML construido.')

  // ── 5. Firmar DTE ──────────────────────────────────────────────────────────
  console.log('\n📌 Firmando documento...')
  const signResult = await signDte(restaurantId, unsignedXml, caf_id)
  if (!signResult || 'error' in signResult) {
    console.error(`❌ Error firmando el DTE:`, signResult?.error || 'UNKNOWN_ERROR')
    process.exit(1)
  }
  const signedXml = signResult.signed_xml
  console.log(`✅ Documento firmado (${signedXml.length} chars)`)

  // Guardar XML firmado para inspección
  const fs = require('fs')
  const xmlPath = `/tmp/factura_folio_${folio}.xml`
  fs.writeFileSync(xmlPath, signedXml, 'latin1')
  console.log(`📄 XML firmado guardado en: ${xmlPath}`)

  // ── 6. Obtener token SOAP para factura ─────────────────────────────────────
  console.log('\n📌 Solicitando token SOAP al SII (CrSeed.jws)...')
  const tokenParams = await getSiiTokenFactura(creds.privateKeyPem, creds.certificate, environment)
  if (tokenParams.error || !tokenParams.token) {
    console.error(`❌ Error obteniendo token: ${tokenParams.error}`)
    console.error(`   Detalle: ${tokenParams.message}`)
    process.exit(1)
  }
  console.log(`✅ Token SII obtenido: ${tokenParams.token.substring(0, 15)}...`)

  // ── 7. Enviar a SII via DTEUpload ──────────────────────────────────────────
  console.log('\n📌 Enviando factura al SII (DTEUpload)...')
  console.log('   XML size:', signedXml.length, 'chars')
  const sendResult = await sendFacturaToSII(
    signedXml,
    restaurant.rut ?? '',
    creds.rutEnvia,
    tokenParams.token,
    environment
  )

  if (!sendResult.success) {
    console.error('❌ Error enviando al SII:')
    console.error('   Error:', sendResult.error)
    console.error('   Mensaje:', sendResult.message)
    if (sendResult.sii_response) {
      console.error('   Respuesta SII:', sendResult.sii_response)
    }
    process.exit(1)
  }

  console.log('\n🎉 ================================================')
  console.log('🎉  FACTURA ENVIADA AL SII EXITOSAMENTE')
  console.log(`🔥  TRACK ID: ${sendResult.track_id}`)
  console.log(`📡  ESTADO:   ${sendResult.status}`)
  console.log(`📄  FOLIO:    ${folio}`)
  console.log(`📅  FECHA:    ${today}`)
  console.log('================================================\n')

  process.exit(0)
}

runTest().catch((err) => {
  console.error('Excepción crítica:', err)
  process.exit(1)
})
