#!/usr/bin/env tsx
/**
 * Test script for PHP bridge
 * Tests emitting a DTE using the PHP LibreDTE code
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createAdminClient } from '../lib/supabase/server'
import { decrypt } from '../lib/crypto/aes'
import { emitDteViaPHP } from '../lib/dte/php-bridge'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

async function testPhpBridge() {
  console.log('🧪 Testing PHP Bridge for DTE emission\n')

  const supabase = createAdminClient()

  // Get restaurant ID from command line or use default
  const restaurantId = process.argv[2] || '2c8864cd-84a8-4517-b4c1-920b5f6c25f1'
  
  console.log(`📍 Restaurant ID: ${restaurantId}`)

  // 1. Get restaurant data - use hardcoded for now
  const restaurant = {
    rut: '77042148-9',
    razon_social: 'COMERCIAL ITALIA LICORES SPA',
    giro: 'VENTA AL POR MAYOR DE BEBIDAS ALCOHOLICAS Y NO ALCOHOLICAS',
    direccion: 'Av. Ejemplo 123',
    comuna: 'Ovalle',
  }

  console.log(`🏢 Restaurant: ${restaurant.razon_social} (${restaurant.rut})`)

  // 2. Get certificate
  const { data: cred } = await supabase
    .from('dte_credentials')
    .select('cert_ciphertext, cert_iv, cert_auth_tag, pass_ciphertext, pass_iv, pass_auth_tag')
    .eq('restaurant_id', restaurantId)
    .single()

  if (!cred) {
    console.error('❌ Certificate not found')
    process.exit(1)
  }

  const pfxBuffer = decrypt({
    ciphertext: cred.cert_ciphertext,
    iv: cred.cert_iv,
    authTag: cred.cert_auth_tag,
  })
  const pfxPassword = decrypt({
    ciphertext: cred.pass_ciphertext,
    iv: cred.pass_iv,
    authTag: cred.pass_auth_tag,
  }).toString('utf8')

  // Convert to base64 - ensure it's clean base64 without any special characters
  const certBase64 = pfxBuffer.toString('base64').replace(/[\r\n]/g, '')
  console.log(`🔐 Certificate loaded (${certBase64.length} bytes base64)`)
  console.log(`   First 50 chars: ${certBase64.substring(0, 50)}...`)
  console.log(`   Password length: ${pfxPassword.length} chars`)

  // 3. Get an active CAF for type 39 (boleta)
  const { data: caf } = await supabase
    .from('dte_cafs')
    .select('id, xml_ciphertext, xml_iv, xml_auth_tag, folio_actual, folio_hasta')
    .eq('restaurant_id', restaurantId)
    .eq('document_type', 39)
    .eq('status', 'active')
    .single()

  if (!caf) {
    console.error('❌ No active CAF found for type 39')
    process.exit(1)
  }

  const cafXml = decrypt({
    ciphertext: caf.xml_ciphertext,
    iv: caf.xml_iv,
    authTag: caf.xml_auth_tag,
  }).toString('utf8')

  const folio = caf.folio_actual
  console.log(`📄 Using CAF with folio: ${folio}`)

  // 4. Prepare test data
  const testInput = {
    document_type: 39 as const,
    folio: folio,
    fecha_emision: new Date().toISOString().split('T')[0],
    rut_emisor: restaurant.rut,
    razon_social: restaurant.razon_social,
    giro: restaurant.giro || undefined,
    direccion: restaurant.direccion || undefined,
    comuna: restaurant.comuna || undefined,
    total_amount: 1000,
    rut_receptor: '66666666-6',
    razon_receptor: 'Sin RUT',
    items: [
      {
        name: 'TEST PHP BRIDGE',
        quantity: 1,
        unit_price: 1000,
      },
    ],
  }

  console.log('\n📦 Test data prepared:')
  console.log(`   - Document type: ${testInput.document_type}`)
  console.log(`   - Folio: ${testInput.folio}`)
  console.log(`   - Total: $${testInput.total_amount}`)
  console.log(`   - Items: ${testInput.items.length}`)

  // 5. Call PHP bridge
  console.log('\n🚀 Calling PHP bridge...\n')

  // Save the input to a file for debugging
  const inputJson = {
    cert_base64: certBase64,
    cert_password: pfxPassword,
    caf_xml: cafXml,
    document_type: testInput.document_type,
    folio: testInput.folio,
    fecha_emision: testInput.fecha_emision,
    rut_emisor: testInput.rut_emisor,
    razon_social: testInput.razon_social,
    rut_envia: '10089092-5',
    rut_receptor: testInput.rut_receptor,
    razon_receptor: testInput.razon_receptor,
    giro: testInput.giro,
    direccion: testInput.direccion,
    comuna: testInput.comuna,
    items: testInput.items,
  }
  
  const fs = await import('fs')
  fs.writeFileSync('/tmp/php_bridge_input.json', JSON.stringify(inputJson, null, 2))
  console.log('📝 Input saved to /tmp/php_bridge_input.json')
  console.log(`   JSON size: ${JSON.stringify(inputJson).length} bytes\n`)

  const result = await emitDteViaPHP(inputJson)

  console.log('\n📥 Result:')
  console.log(JSON.stringify(result, null, 2))

  if ('error' in result) {
    console.error('\n❌ Emission failed:', result.error)
    process.exit(1)
  }

  console.log('\n✅ Emission successful!')
  console.log(`   - Track ID: ${result.trackid}`)
  if (result.xml_file) {
    console.log(`   - XML saved to: ${result.xml_file}`)
  }

  // 6. Update folio in database
  await supabase
    .from('dte_cafs')
    .update({ folio_actual: folio + 1 })
    .eq('id', caf.id)

  console.log(`   - Folio updated: ${folio} → ${folio + 1}`)
}

testPhpBridge().catch((err) => {
  console.error('\n💥 Fatal error:', err)
  process.exit(1)
})
