import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@/lib/supabase/server'
import { buildDteXml } from '@/lib/dte/signer'
import { takeNextFolio } from '@/lib/dte/folio'
import * as crypto from 'crypto'

/**
 * Script para comparar cómo se construye el DD del TED en Node.js vs PHP
 * 
 * Uso: npx tsx scripts/compare-ted-dd.ts <restaurant_id>
 */
async function compareTedDD() {
  const restaurantId = process.argv[2]
  if (!restaurantId) {
    console.error('❌ Error: Debes proveer un restaurant_id como argumento.')
    process.exit(1)
  }

  const supabase = createAdminClient()

  console.log(`\n🔍 COMPARACIÓN DE CONSTRUCCIÓN DEL DD DEL TED\n`)

  // 1. Cargar el restaurante
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('rut, razon_social, giro, address')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) {
    console.error('❌ Error cargando el restaurante')
    process.exit(1)
  }

  console.log(`Restaurante: ${restaurant.razon_social}`)
  console.log(`RUT: ${restaurant.rut}\n`)

  // 2. Tomar un folio
  const folioResult = await takeNextFolio(restaurantId, 39)
  if ('error' in folioResult) {
    console.error(`❌ Error solicitando folio: ${folioResult.error}`)
    process.exit(1)
  }
  
  const { folio, caf_id } = folioResult
  console.log(`Folio: ${folio}`)
  console.log(`CAF ID: ${caf_id}\n`)

  // 3. Cargar CAF
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

  // Extraer el bloque CAF y limpiarlo como lo hace buildEnvelope
  const cafBlockMatch = /<CAF[\s\S]*?<\/CAF>/.exec(cafXml)
  if (!cafBlockMatch) {
    console.error('❌ No se encontró el bloque CAF')
    process.exit(1)
  }

  const cafBlock = cafBlockMatch[0]
    // Primero limpiar M y FRMA (sin espacios en blanco)
    .replace(/(<M>)([\s\S]*?)(<\/M>)/g, (_, open, val, close) =>
      open + val.replace(/\s/g, '') + close)
    .replace(/(<FRMA[^>]*>)([\s\S]*?)(<\/FRMA>)/g, (_, open, val, close) =>
      open + val.replace(/\s/g, '') + close)
    // Luego eliminar saltos de línea entre tags pero mantener espacios en valores
    .replace(/>\s+</g, '><')
    .trim()

  // 4. Construir datos del DTE
  const fecha = new Date().toISOString().split('T')[0]
  const rutEmisor = restaurant.rut ?? ''
  const rutRecep = '66666666-6'
  const rznRecep = 'Sin RUT'
  const mntTotal = 1500
  const it1 = 'Producto de prueba'
  const nowDate = new Date()
  const offsetMs = nowDate.getTimezoneOffset() * 60000
  const tmst = new Date(nowDate.getTime() - offsetMs).toISOString().substring(0, 19)

  // 5. Construir DD como lo hace Node.js
  const ddXmlNode = 
    `<RE>${rutEmisor}</RE>` +
    `<TD>39</TD>` +
    `<F>${folio}</F>` +
    `<FE>${fecha}</FE>` +
    `<RR>${rutRecep}</RR>` +
    `<RSR>${rznRecep}</RSR>` +
    `<MNT>${mntTotal}</MNT>` +
    `<IT1>${it1}</IT1>` +
    cafBlock +
    `<TSTED>${tmst}</TSTED>`

  console.log('📋 DD construido por Node.js:\n')
  console.log(ddXmlNode)
  console.log('\n')

  // 6. Mostrar bytes del DD
  console.log('📊 ANÁLISIS DE BYTES:\n')
  const ddBuffer = Buffer.from(ddXmlNode, 'latin1')
  console.log(`Longitud total: ${ddBuffer.length} bytes`)
  console.log(`Encoding: latin1 (ISO-8859-1)`)
  console.log('\n')

  // 7. Mostrar hex de los primeros y últimos bytes
  console.log('🔍 Primeros 100 bytes (hex):')
  console.log(ddBuffer.slice(0, 100).toString('hex'))
  console.log('\n')

  console.log('🔍 Últimos 100 bytes (hex):')
  console.log(ddBuffer.slice(-100).toString('hex'))
  console.log('\n')

  // 8. Verificar el bloque CAF
  console.log('📋 BLOQUE CAF:\n')
  console.log(cafBlock)
  console.log('\n')

  // 9. Extraer y mostrar la clave privada del CAF
  const rsaskMatch = /<RSASK>([\s\S]*?)<\/RSASK>/.exec(cafXml)
  if (rsaskMatch) {
    const rsaskContent = rsaskMatch[1].trim()
    console.log('🔑 CLAVE PRIVADA DEL CAF:\n')
    console.log(`Formato: ${rsaskContent.includes('BEGIN') ? 'PEM con headers' : 'Base64 puro'}`)
    console.log(`Longitud: ${rsaskContent.length} caracteres`)
    console.log(`Primeros 50 chars: ${rsaskContent.substring(0, 50)}...`)
    console.log('\n')

    // Intentar firmar con la clave del CAF
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
      console.log(`✅ Clave privada CAF válida (tipo: ${key.asymmetricKeyType})`)

      // Firmar el DD
      const signer = crypto.createSign('RSA-SHA1')
      signer.update(Buffer.from(ddXmlNode, 'latin1'))
      const signature = signer.sign({ key, padding: crypto.constants.RSA_PKCS1_PADDING })
      const signatureB64 = signature.toString('base64')

      console.log(`\n🔐 FIRMA GENERADA:`)
      console.log(`Longitud: ${signatureB64.length} caracteres`)
      console.log(`Firma (base64): ${signatureB64}`)
      console.log('\n')

      // Verificar la firma
      const verifier = crypto.createVerify('RSA-SHA1')
      verifier.update(Buffer.from(ddXmlNode, 'latin1'))
      const isValid = verifier.verify({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, signature)
      console.log(`✅ Verificación de firma: ${isValid ? 'VÁLIDA' : 'INVÁLIDA'}`)

    } catch (e) {
      console.error(`❌ Error firmando: ${e}`)
    }
  }

  console.log('\n✅ ANÁLISIS COMPLETADO\n')
  console.log('💡 NOTAS:')
  console.log('   - El DD debe ser exactamente igual byte por byte en PHP y Node.js')
  console.log('   - Cualquier diferencia en espacios, saltos de línea o encoding causará una firma diferente')
  console.log('   - El CAF block debe estar sin espacios en blanco en M y FRMA')
  console.log('   - El encoding debe ser ISO-8859-1 (latin1) para la firma\n')
}

compareTedDD().catch((err) => {
  console.error('❌ Excepción crítica:', err)
  process.exit(1)
})
