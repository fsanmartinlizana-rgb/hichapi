import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@/lib/supabase/server'
import { loadCredentials, buildDteXml, signDte } from '@/lib/dte/signer'
import { getSiiToken, sendDteToSII, SiiEnvironment } from '@/lib/dte/sii-client'
import { takeNextFolio } from '@/lib/dte/folio'

/**
 * Script de prueba rápido para enviar una boleta al SII.
 * 
 * Uso: npx tsx scripts/test-sii-emission.ts <restaurant_id>
 */
async function runTest() {
  const restaurantId = process.argv[2]
  if (!restaurantId) {
    console.error('❌ Error: Debes proveer un restaurant_id como argumento.')
    console.error('Ejemplo: npx tsx scripts/test-sii-emission.ts "123e4567-e89b-12d3-a456-426614174000"')
    process.exit(1)
  }

  const supabase = createAdminClient()

  console.log(`\n🚀 Iniciando prueba de emisión rápida para el restaurante: ${restaurantId}`)

  // 1. Cargar el restaurante
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
  console.log(`✅ Restaurante cargado: ${restaurant.razon_social} (RUT: ${restaurant.rut}) - Entorno: ${environment}`)

  // 2. Cargar Credenciales
  const creds = await loadCredentials(restaurantId)
  if ('error' in creds) {
    console.error(`❌ Error cargando credenciales: ${creds.error}`)
    process.exit(1)
  }
  console.log(`✅ Credenciales decriptadas correctamente. Rut certificador: ${creds.rutEnvia}`)

  // 3. Tomar un Folio real (Tipo 39: Boleta Electrónica)
  console.log('📌 Solicitando folio para tipo 39...')
  const folioResult = await takeNextFolio(restaurantId, 39)
  if ('error' in folioResult) {
    console.error(`❌ Error solicitando folio: ${folioResult.error}`)
    process.exit(1)
  }
  
  const { folio, caf_id } = folioResult
  console.log(`✅ Folio asignado: ${folio} (CAF ID: ${caf_id})`)

  // 4. Construir DTE XML Bruto
  const unsignedXml = buildDteXml({
    document_type: 39,
    folio,
    fecha_emision: new Date().toISOString().split('T')[0],
    rut_emisor: restaurant.rut ?? '',
    razon_social: restaurant.razon_social ?? '',
    rut_receptor: '66666666-6',
    razon_receptor: 'Sin RUT',
    giro: restaurant.giro ?? 'Restaurante',
    direccion: (restaurant as any).direccion ?? restaurant.address ?? 'Direccion de prueba',
    comuna: (restaurant as any).comuna ?? '', 
    total_amount: 1500, // $1.500 bruto
    items: [
      { name: 'Consumo de prueba API', quantity: 1, unit_price: 1500 }
    ]
  })
  console.log('✅ XML en crudo construido.')

  // 5. Firmar DTE
  const signResult = await signDte(restaurantId, unsignedXml, caf_id)
  if (!signResult || 'error' in signResult) {
    console.error(`❌ Error firmando el DTE:`, signResult?.error || 'UNKNOWN_ERROR')
    process.exit(1)
  }
  const signedXml = signResult.signed_xml
  console.log(`✅ Documento firmado con éxito! (Longitud: ${signedXml.length} caracteres)`)

  // 6. Obtener Token SII
  console.log('📌 Solicitando token a SII...')
  const tokenParams = await getSiiToken(creds.privateKeyPem, creds.certificate, environment)
  if (tokenParams.error || !tokenParams.token) {
    console.error(`❌ Error en Token de SII: ${tokenParams.error} - ${tokenParams.message}`)
    process.exit(1)
  }
  console.log(`✅ Token SII rescatado de manera nativa: ${tokenParams.token.substring(0, 15)}...`)

  // 7. Enviar a SII
  console.log('📌 Enviando payload Multipart a SII (TrackID expected)...')
  const sendResult = await sendDteToSII(
    signedXml,
    restaurant.rut ?? '',
    creds.rutEnvia,
    tokenParams.token,
    environment
  )

  if (!sendResult.success) {
    console.error(`❌ Error enviando archivo al SII:`, sendResult)
    process.exit(1)
  }

  console.log('\n🎉 ================================================')
  console.log('🎉 EMISIÓN EXISTOSA. BOLETA ENVIADA AL SII.  ')
  console.log(`🔥 TRACK ID: ${sendResult.track_id}`)
  console.log(`📡 ESTADO: ${sendResult.status}`)
  console.log('================================================\n')
  
  process.exit(0)
}

runTest().catch((err) => {
  console.error('Excepción crítica corriendo el test:', err)
  process.exit(1)
})
