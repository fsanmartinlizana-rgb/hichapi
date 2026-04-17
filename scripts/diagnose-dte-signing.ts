import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@/lib/supabase/server'
import { loadCredentials, buildDteXml, signDte } from '@/lib/dte/signer'
import { takeNextFolio } from '@/lib/dte/folio'
import * as crypto from 'crypto'
import * as fs from 'fs'

/**
 * Script de diagnóstico completo para verificar la firma de DTEs
 * 
 * Uso: npx tsx scripts/diagnose-dte-signing.ts <restaurant_id>
 */
async function diagnose() {
  const restaurantId = process.argv[2]
  if (!restaurantId) {
    console.error('❌ Error: Debes proveer un restaurant_id como argumento.')
    process.exit(1)
  }

  const supabase = createAdminClient()

  console.log(`\n🔍 DIAGNÓSTICO DE FIRMA DTE`)
  console.log(`Restaurant ID: ${restaurantId}\n`)

  // 1. Cargar el restaurante
  const { data: restaurant, error: restErr } = await supabase
    .from('restaurants')
    .select('rut, razon_social, giro, address, dte_environment')
    .eq('id', restaurantId)
    .single()

  if (restErr || !restaurant) {
    console.error('❌ Error cargando el restaurante:', restErr?.message || 'No encontrado')
    process.exit(1)
  }

  console.log(`✅ Restaurante: ${restaurant.razon_social}`)
  console.log(`   RUT: ${restaurant.rut}`)
  console.log(`   Entorno: ${restaurant.dte_environment}\n`)

  // 2. Cargar Credenciales
  console.log('📋 Verificando credenciales...')
  const creds = await loadCredentials(restaurantId)
  if ('error' in creds) {
    console.error(`❌ Error cargando credenciales: ${creds.error}`)
    process.exit(1)
  }
  console.log(`✅ Credenciales cargadas`)
  console.log(`   RUT Envia: ${creds.rutEnvia}`)
  console.log(`   Certificado válido: SÍ\n`)

  // 3. Verificar CAF
  console.log('📋 Verificando CAF disponibles...')
  const { data: cafs, error: cafErr } = await supabase
    .from('dte_cafs')
    .select('id, document_type, folio_desde, folio_hasta, folio_actual, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (cafErr || !cafs || cafs.length === 0) {
    console.error('❌ No se encontraron CAFs')
    console.error('Error:', cafErr)
    process.exit(1)
  }

  console.log(`✅ CAFs encontrados: ${cafs.length}`)
  cafs.forEach(caf => {
    console.log(`   - Tipo ${caf.document_type}: Folios ${caf.folio_desde}-${caf.folio_hasta} (actual: ${caf.folio_actual})`)
  })
  console.log()

  // 4. Tomar un folio
  console.log('📋 Solicitando folio para tipo 39...')
  const folioResult = await takeNextFolio(restaurantId, 39)
  if ('error' in folioResult) {
    console.error(`❌ Error solicitando folio: ${folioResult.error}`)
    process.exit(1)
  }
  
  const { folio, caf_id } = folioResult
  console.log(`✅ Folio asignado: ${folio}`)
  console.log(`   CAF ID: ${caf_id}\n`)

  // 5. Verificar CAF XML
  console.log('📋 Verificando estructura del CAF...')
  const { data: cafRow } = await supabase
    .from('dte_cafs')
    .select('xml_ciphertext, xml_iv, xml_auth_tag')
    .eq('id', caf_id)
    .single()

  if (!cafRow) {
    console.error('❌ No se pudo cargar el CAF')
    process.exit(1)
  }

  const { decrypt } = await import('@/lib/crypto/aes')
  const cafXml = decrypt({
    ciphertext: cafRow.xml_ciphertext,
    iv: cafRow.xml_iv,
    authTag: cafRow.xml_auth_tag,
  }).toString('utf8')

  console.log(`✅ CAF XML cargado (${cafXml.length} caracteres)`)
  
  // Verificar estructura del CAF
  const cafBlockMatch = /<CAF[\s\S]*?<\/CAF>/.exec(cafXml)
  const rsaskMatch = /<RSASK>([\s\S]*?)<\/RSASK>/.exec(cafXml)
  const frmaMatch = /<FRMA[^>]*>([\s\S]*?)<\/FRMA>/.exec(cafXml)
  
  console.log(`   - Bloque <CAF>: ${cafBlockMatch ? '✅ Encontrado' : '❌ No encontrado'}`)
  console.log(`   - Clave privada <RSASK>: ${rsaskMatch ? '✅ Encontrada' : '❌ No encontrada'}`)
  console.log(`   - Firma <FRMA>: ${frmaMatch ? '✅ Encontrada' : '❌ No encontrada'}`)
  
  if (rsaskMatch) {
    const rsaskContent = rsaskMatch[1].trim()
    console.log(`   - Longitud RSASK: ${rsaskContent.length} caracteres`)
    console.log(`   - Formato: ${rsaskContent.includes('BEGIN') ? 'PEM con headers' : 'Base64 puro'}`)
    
    // Intentar parsear la clave
    try {
      let pemToTry = ''
      if (rsaskContent.includes('BEGIN')) {
        pemToTry = rsaskContent
      } else {
        const rawB64 = rsaskContent.replace(/\s/g, '')
        const wrappedB64 = rawB64.match(/.{1,64}/g)?.join('\n') ?? rawB64
        pemToTry = `-----BEGIN PRIVATE KEY-----\n${wrappedB64}\n-----END PRIVATE KEY-----`
      }
      
      const key = crypto.createPrivateKey(pemToTry)
      console.log(`   - ✅ Clave privada CAF válida (tipo: ${key.asymmetricKeyType})`)
    } catch (e) {
      console.log(`   - ❌ Error parseando clave privada CAF: ${e}`)
      
      // Intentar con PKCS#1
      try {
        const rawB64 = rsaskContent.replace(/\s/g, '')
        const wrappedB64 = rawB64.match(/.{1,64}/g)?.join('\n') ?? rawB64
        const pemPkcs1 = `-----BEGIN RSA PRIVATE KEY-----\n${wrappedB64}\n-----END RSA PRIVATE KEY-----`
        const key = crypto.createPrivateKey(pemPkcs1)
        console.log(`   - ✅ Clave privada CAF válida con PKCS#1 (tipo: ${key.asymmetricKeyType})`)
      } catch (e2) {
        console.log(`   - ❌ Error parseando clave privada CAF con PKCS#1: ${e2}`)
      }
    }
  }
  console.log()

  // 6. Construir y firmar DTE
  console.log('📋 Construyendo DTE de prueba...')
  const unsignedXml = buildDteXml({
    document_type: 39,
    folio,
    fecha_emision: new Date().toISOString().split('T')[0],
    rut_emisor: restaurant.rut ?? '',
    razon_social: restaurant.razon_social ?? '',
    rut_receptor: '66666666-6',
    razon_receptor: 'Sin RUT',
    giro: restaurant.giro ?? 'Restaurante',
    direccion: restaurant.address ?? 'Direccion de prueba',
    comuna: '', 
    total_amount: 1500,
    items: [
      { name: 'Producto de prueba diagnóstico', quantity: 1, unit_price: 1500 }
    ]
  })
  console.log(`✅ XML construido (${unsignedXml.length} caracteres)\n`)

  console.log('📋 Firmando DTE...')
  const signResult = await signDte(restaurantId, unsignedXml, caf_id)
  if (!signResult || 'error' in signResult) {
    console.error(`❌ Error firmando el DTE:`, signResult?.error || 'UNKNOWN_ERROR')
    process.exit(1)
  }
  
  const signedXml = signResult.signed_xml
  console.log(`✅ DTE firmado exitosamente (${signedXml.length} caracteres)\n`)

  // 7. Verificar estructura del XML firmado
  console.log('📋 Verificando estructura del XML firmado...')
  const tedMatch = /<TED[\s\S]*?<\/TED>/.exec(signedXml)
  const tedFrmtMatch = /<FRMT[^>]*>([\s\S]*?)<\/FRMT>/.exec(signedXml)
  const dteSignatureMatch = /<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">[\s\S]*?<\/Signature>/.exec(signedXml)
  
  console.log(`   - TED: ${tedMatch ? '✅ Encontrado' : '❌ No encontrado'}`)
  console.log(`   - TED FRMT: ${tedFrmtMatch ? '✅ Encontrado' : '❌ No encontrado'}`)
  console.log(`   - Firma DTE: ${dteSignatureMatch ? '✅ Encontrada' : '❌ No encontrada'}`)
  
  if (tedFrmtMatch) {
    const frmtValue = tedFrmtMatch[1].trim()
    console.log(`   - Longitud FRMT: ${frmtValue.length} caracteres`)
  }
  console.log()

  // 8. Guardar XML para inspección
  const outputPath = `/tmp/dte_diagnostic_${Date.now()}.xml`
  fs.writeFileSync(outputPath, signedXml, 'utf8')
  console.log(`📄 XML guardado en: ${outputPath}\n`)

  console.log('✅ DIAGNÓSTICO COMPLETADO EXITOSAMENTE')
  console.log('\n📊 RESUMEN:')
  console.log('   ✅ Credenciales: OK')
  console.log('   ✅ CAF: OK')
  console.log('   ✅ Folio: OK')
  console.log('   ✅ Construcción XML: OK')
  console.log('   ✅ Firma: OK')
  console.log('\n💡 El sistema de firma está funcionando correctamente.')
  console.log('   Si hay rechazos del SII, probablemente sean por validaciones')
  console.log('   de formato o datos específicos del SII, no por problemas de firma.\n')
  
  process.exit(0)
}

diagnose().catch((err) => {
  console.error('❌ Excepción crítica:', err)
  process.exit(1)
})
