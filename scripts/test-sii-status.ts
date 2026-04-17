import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@/lib/supabase/server'
import { loadCredentials } from '@/lib/dte/signer'
import { getSiiToken, checkDteStatus, SiiEnvironment } from '@/lib/dte/sii-client'

/**
 * Script de prueba rápido para consultar el estado de un envío al SII.
 * 
 * Uso: npx tsx scripts/test-sii-status.ts <restaurant_id> <track_id>
 */
async function runStatus() {
  const restaurantId = process.argv[2]
  const trackId = process.argv[3]

  if (!restaurantId || !trackId) {
    console.error('❌ Error: Debes proveer un restaurant_id y un track_id.')
    console.error('Ejemplo: npx tsx scripts/test-sii-status.ts "2c8864cd..." "27763236"')
    process.exit(1)
  }

  const supabase = createAdminClient()

  console.log(`\n🔍 Consultando estado del Track ID [${trackId}] para el restaurante: ${restaurantId}`)

  // 1. Cargar el restaurante
  const { data: restaurant, error: restErr } = await supabase
    .from('restaurants')
    .select('rut, razon_social, dte_environment')
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

  // 3. Obtener Token SII
  console.log('📌 Solicitando nuevo token a SII para consultar estado...')
  const tokenParams = await getSiiToken(creds.privateKeyPem, creds.certificate, environment)
  if (tokenParams.error || !tokenParams.token) {
    console.error(`❌ Error en Token de SII: ${tokenParams.error} - ${tokenParams.message}`)
    process.exit(1)
  }
  console.log(`✅ Token SII rescatado: ${tokenParams.token.substring(0, 15)}...`)

  // 4. Consultar Estado
  console.log(`📌 Consultando estado del envío...`)
  const statusResult = await checkDteStatus(
    trackId,
    restaurant.rut ?? '',
    tokenParams.token,
    environment
  )

  if (!statusResult.success) {
    console.error(`❌ Error consultando estado al SII:`, statusResult)
    process.exit(1)
  }

  console.log('\n🎉 ================================================')
  console.log('📡 RESPUESTA DEL ESTADO (SII):')
  console.log(`🔥 ESTADO: ${statusResult.status || 'N/A'}`)
  console.log(JSON.stringify(statusResult.sii_response, null, 2))
  console.log('================================================\n')
  
  process.exit(0)
}

runStatus().catch((err) => {
  console.error('Excepción crítica corriendo el script:', err)
  process.exit(1)
})
