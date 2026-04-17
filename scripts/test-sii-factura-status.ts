import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@/lib/supabase/server'
import { loadCredentials } from '@/lib/dte/signer'
import { getSiiTokenFactura, queryEstDteFactura, SiiEnvironment } from '@/lib/dte/sii-client'

/**
 * Consulta el estado individual de una factura electrónica en el SII
 * usando el servicio SOAP QueryEstDte.
 *
 * Uso:
 *   npx tsx scripts/test-sii-factura-status.ts <restaurant_id> <folio> <rut_receptor> <fecha_emision> <monto>
 *
 * Ejemplo:
 *   npx tsx scripts/test-sii-factura-status.ts "2c8864cd-..." 14 "76354771-K" "2026-04-16" 11900
 *
 * Nota: QueryEstDte consulta por folio + receptor + fecha + monto, NO por track_id.
 *       El track_id es para el envío batch; QueryEstDte es para el estado individual.
 */
async function runStatus() {
  const restaurantId  = process.argv[2]
  const folio         = parseInt(process.argv[3] ?? '')
  const rutReceptor   = process.argv[4]
  const fechaEmision  = process.argv[5]   // YYYY-MM-DD
  const monto         = parseInt(process.argv[6] ?? '')

  if (!restaurantId || !folio || !rutReceptor || !fechaEmision || !monto) {
    console.error('❌ Uso: npx tsx scripts/test-sii-factura-status.ts <restaurant_id> <folio> <rut_receptor> <fecha_emision_YYYY-MM-DD> <monto>')
    console.error('Ejemplo: npx tsx scripts/test-sii-factura-status.ts "2c8864cd-..." 14 "76354771-K" "2026-04-16" 11900')
    process.exit(1)
  }

  const supabase = createAdminClient()
  console.log(`\n🔍 Consultando estado de Factura Folio ${folio} para restaurante: ${restaurantId}`)

  // 1. Cargar restaurante
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
  console.log(`✅ Restaurante: ${restaurant.razon_social} (RUT: ${restaurant.rut}) — Entorno: ${environment}`)

  // 2. Cargar credenciales
  const creds = await loadCredentials(restaurantId)
  if ('error' in creds) {
    console.error(`❌ Error cargando credenciales: ${creds.error}`)
    process.exit(1)
  }

  // 3. Obtener token SOAP para factura
  console.log('\n📌 Solicitando token SOAP (CrSeed.jws)...')
  const tokenParams = await getSiiTokenFactura(creds.privateKeyPem, creds.certificate, environment)
  if (tokenParams.error || !tokenParams.token) {
    console.error(`❌ Error obteniendo token: ${tokenParams.error} — ${tokenParams.message}`)
    process.exit(1)
  }
  console.log(`✅ Token obtenido: ${tokenParams.token.substring(0, 15)}...`)

  // 4. Consultar estado via QueryEstDte
  console.log('\n📌 Consultando estado via QueryEstDte...')
  const result = await queryEstDteFactura(
    {
      rutConsultante:  restaurant.rut ?? '',
      rutCompania:     restaurant.rut ?? '',
      rutReceptor,
      tipoDte:         33,
      folioDte:        folio,
      fechaEmisionDte: fechaEmision,
      montoDte:        monto,
      token:           tokenParams.token,
    },
    environment
  )

  if (result.error) {
    console.error(`❌ Error consultando estado: ${result.error}`)
    process.exit(1)
  }

  console.log('\n🎉 ================================================')
  console.log(`📡 ESTADO:  ${result.estado}`)
  console.log(`📝 GLOSA:   ${result.glosa ?? '—'}`)
  console.log('================================================')

  // Interpretar el estado
  // FAU con ERR_CODE=3 y glosa "DTE No Recibido" = documento aún en cola de procesamiento
  // FAU con ERR_CODE=1 = firma inválida
  const interpretaciones: Record<string, string> = {
    'DOK':  '✅ Documento aceptado por el SII',
    'DOK1': '✅ Documento aceptado con observaciones',
    'FAU':  '⏳ Documento aún en proceso (o firma inválida) — si la glosa dice "No Recibido", espera 5-15 min',
    'FNA':  '❌ Documento no ha sido enviado al SII',
    'FNF':  '⏳ Documento no encontrado — puede estar en proceso, espera unos minutos',
    'RFR':  '❌ Documento rechazado por el receptor',
    'RCT':  '❌ Documento reclamado por el receptor',
    'EPR':  '⏳ Documento en proceso de revisión',
  }
  const interp = interpretaciones[result.estado ?? ''] ?? '❓ Estado desconocido'
  console.log(`\n${interp}\n`)

  process.exit(0)
}

runStatus().catch((err) => {
  console.error('Excepción crítica:', err)
  process.exit(1)
})
