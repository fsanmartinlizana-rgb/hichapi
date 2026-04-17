#!/usr/bin/env tsx
/**
 * Complete DTE diagnostic script
 * Compares Node.js vs PHP DTE generation step by step
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createAdminClient } from '../lib/supabase/server'
import { decrypt } from '../lib/crypto/aes'
import { buildDteXml, signDte, loadCredentials } from '../lib/dte/signer'
import { emitDteViaPHP } from '../lib/dte/php-bridge'
import * as fs from 'fs'
import * as crypto from 'crypto'

config({ path: resolve(process.cwd(), '.env.local') })

async function diagnose() {
  console.log('🔍 COMPLETE DTE DIAGNOSTIC\n')
  console.log('=' .repeat(80))

  const supabase = createAdminClient()
  const restaurantId = process.argv[2] || '2c8864cd-84a8-4517-b4c1-920b5f6c25f1'

  console.log(`\n📍 Restaurant ID: ${restaurantId}\n`)

  // 1. Load restaurant data
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('rut, razon_social, giro, address')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) {
    console.error('❌ Restaurant not found')
    process.exit(1)
  }

  console.log(`🏢 Restaurant: ${restaurant.razon_social}`)
  console.log(`   RUT: ${restaurant.rut}`)
  console.log(`   Giro: ${restaurant.giro || '(none)'}`)
  console.log(`   Address: ${restaurant.address || '(none)'}\n`)

  // 2. Load credentials
  const { data: cred } = await supabase
    .from('dte_credentials')
    .select('cert_ciphertext, cert_iv, cert_auth_tag, pass_ciphertext, pass_iv, pass_auth_tag, rut_envia')
    .eq('restaurant_id', restaurantId)
    .single()

  if (!cred) {
    console.error('❌ Credentials not found')
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

  const certBase64 = pfxBuffer.toString('base64').replace(/[\r\n]/g, '')
  console.log(`🔐 Certificate loaded: ${certBase64.length} bytes`)
  console.log(`   RUT Envia: ${cred.rut_envia || '(will extract from cert)'}\n`)

  // 3. Load CAF
  const { data: caf } = await supabase
    .from('dte_cafs')
    .select('id, xml_ciphertext, xml_iv, xml_auth_tag, folio_actual, folio_hasta')
    .eq('restaurant_id', restaurantId)
    .eq('document_type', 39)
    .eq('status', 'active')
    .single()

  if (!caf) {
    console.error('❌ No active CAF found')
    process.exit(1)
  }

  const cafXml = decrypt({
    ciphertext: caf.xml_ciphertext,
    iv: caf.xml_iv,
    authTag: caf.xml_auth_tag,
  }).toString('utf8')

  const folio = caf.folio_actual
  console.log(`📄 CAF loaded: folio ${folio}`)
  console.log(`   Range: ${caf.folio_actual} - ${caf.folio_hasta}`)
  console.log(`   CAF XML length: ${cafXml.length} bytes\n`)

  // Extract RSASK from CAF
  const rsaskMatch = /<RSASK>([\s\S]*?)<\/RSASK>/.exec(cafXml)
  if (rsaskMatch) {
    const rsask = rsaskMatch[1].trim()
    console.log(`🔑 CAF Private Key (RSASK):`)
    console.log(`   Length: ${rsask.length} chars`)
    console.log(`   Has BEGIN header: ${rsask.includes('BEGIN') ? 'YES' : 'NO'}`)
    console.log(`   First 50 chars: ${rsask.substring(0, 50)}...`)
    console.log(`   Last 50 chars: ...${rsask.substring(rsask.length - 50)}\n`)

    // Try to parse the key
    try {
      let keyPem = ''
      if (rsask.includes('BEGIN')) {
        keyPem = rsask
      } else {
        const rawB64 = rsask.replace(/\s/g, '')
        const wrappedB64 = rawB64.match(/.{1,64}/g)?.join('\n') ?? rawB64
        keyPem = `-----BEGIN PRIVATE KEY-----\n${wrappedB64}\n-----END PRIVATE KEY-----`
      }
      
      const keyObj = crypto.createPrivateKey(keyPem)
      console.log(`✅ CAF key parsed successfully as PKCS#8`)
      console.log(`   Key type: ${keyObj.asymmetricKeyType}`)
      console.log(`   Key size: ${keyObj.asymmetricKeyDetails?.modulusLength || 'unknown'} bits\n`)
    } catch (e1) {
      console.log(`❌ Failed to parse as PKCS#8: ${(e1 as Error).message}`)
      
      // Try PKCS#1
      try {
        const rawB64 = rsask.replace(/\s/g, '')
        const wrappedB64 = rawB64.match(/.{1,64}/g)?.join('\n') ?? rawB64
        const keyPem = `-----BEGIN RSA PRIVATE KEY-----\n${wrappedB64}\n-----END RSA PRIVATE KEY-----`
        const keyObj = crypto.createPrivateKey(keyPem)
        console.log(`✅ CAF key parsed successfully as PKCS#1`)
        console.log(`   Key type: ${keyObj.asymmetricKeyType}`)
        console.log(`   Key size: ${keyObj.asymmetricKeyDetails?.modulusLength || 'unknown'} bits\n`)
      } catch (e2) {
        console.log(`❌ Failed to parse as PKCS#1: ${(e2 as Error).message}\n`)
      }
    }
  }

  // Extract CAF block
  const cafBlockMatch = /(<CAF[\s\S]*?<\/CAF>)/.exec(cafXml)
  if (cafBlockMatch) {
    const cafBlock = cafBlockMatch[1]
    console.log(`📦 CAF Block:`)
    console.log(`   Length: ${cafBlock.length} chars`)
    console.log(`   Has line breaks: ${cafBlock.includes('\n') ? 'YES' : 'NO'}`)
    console.log(`   Has spaces between tags: ${/>\s+</.test(cafBlock) ? 'YES' : 'NO'}\n`)

    // Clean CAF block (Node.js way)
    const cleanedCaf = cafBlock
      .replace(/(<M>)([\s\S]*?)(<\/M>)/g, (_, open, val, close) =>
        open + val.replace(/\s/g, '') + close)
      .replace(/(<FRMA[^>]*>)([\s\S]*?)(<\/FRMA>)/g, (_, open, val, close) =>
        open + val.replace(/\s/g, '') + close)
      .replace(/>\s+</g, '><')
      .trim()

    console.log(`🧹 Cleaned CAF Block (Node.js):`)
    console.log(`   Length: ${cleanedCaf.length} chars`)
    console.log(`   Has line breaks: ${cleanedCaf.includes('\n') ? 'YES' : 'NO'}`)
    console.log(`   Has spaces between tags: ${/>\s+</.test(cleanedCaf) ? 'YES' : 'NO'}\n`)
  }

  // 4. Prepare test data
  const testInput = {
    document_type: 39 as const,
    folio: folio,
    fecha_emision: new Date().toISOString().split('T')[0],
    rut_emisor: restaurant.rut,
    razon_social: restaurant.razon_social,
    giro: restaurant.giro || 'Restaurante',
    direccion: restaurant.address || 'Direccion de prueba',
    comuna: 'Ovalle',
    total_amount: 1000,
    rut_receptor: '66666666-6',
    razon_receptor: 'Sin RUT',
    items: [
      {
        name: 'TEST DIAGNOSTIC',
        quantity: 1,
        unit_price: 1000,
      },
    ],
  }

  console.log('=' .repeat(80))
  console.log('\n🔬 GENERATING DTE WITH NODE.JS\n')
  console.log('=' .repeat(80) + '\n')

  // 5. Generate with Node.js
  const unsignedXml = buildDteXml(testInput)
  console.log(`📝 Unsigned XML generated: ${unsignedXml.length} chars\n`)

  const signResult = await signDte(restaurantId, unsignedXml, caf.id)
  if ('error' in signResult) {
    console.error(`❌ Node.js signing failed: ${signResult.error}`)
  } else {
    const nodeXml = signResult.signed_xml
    console.log(`✅ Node.js DTE signed: ${nodeXml.length} chars`)
    
    // Save to file
    const nodeXmlPath = '/tmp/dte_diagnostic_nodejs.xml'
    fs.writeFileSync(nodeXmlPath, nodeXml)
    console.log(`   Saved to: ${nodeXmlPath}\n`)

    // Analyze TED
    const tedMatch = /<TED[\s\S]*?<\/TED>/.exec(nodeXml)
    if (tedMatch) {
      const ted = tedMatch[0]
      console.log(`🎫 Node.js TED:`)
      console.log(`   Length: ${ted.length} chars`)
      
      const ddMatch = /<DD>([\s\S]*?)<\/DD>/.exec(ted)
      if (ddMatch) {
        const dd = ddMatch[1]
        console.log(`   DD content length: ${dd.length} chars`)
        console.log(`   DD has CAF: ${dd.includes('<CAF') ? 'YES' : 'NO'}`)
      }
      
      const frmtMatch = /<FRMT[^>]*>([^<]*)<\/FRMT>/.exec(ted)
      if (frmtMatch) {
        console.log(`   FRMT length: ${frmtMatch[1].length} chars`)
        console.log(`   FRMT first 50: ${frmtMatch[1].substring(0, 50)}...\n`)
      }
    }
  }

  console.log('=' .repeat(80))
  console.log('\n🔬 GENERATING DTE WITH PHP\n')
  console.log('=' .repeat(80) + '\n')

  // 6. Generate with PHP
  const phpInput = {
    cert_base64: certBase64,
    cert_password: pfxPassword,
    caf_xml: cafXml,
    document_type: testInput.document_type,
    folio: testInput.folio,
    fecha_emision: testInput.fecha_emision,
    rut_emisor: testInput.rut_emisor,
    razon_social: testInput.razon_social,
    rut_envia: cred.rut_envia || '10089092-5',
    rut_receptor: testInput.rut_receptor,
    razon_receptor: testInput.razon_receptor,
    giro: testInput.giro,
    direccion: testInput.direccion,
    comuna: testInput.comuna,
    items: testInput.items,
  }

  const phpResult = await emitDteViaPHP(phpInput)
  
  if ('error' in phpResult) {
    console.error(`❌ PHP emission failed: ${phpResult.error}`)
    if (phpResult.message) {
      console.error(`   Message: ${phpResult.message}`)
    }
  } else {
    console.log(`✅ PHP DTE emitted successfully`)
    console.log(`   Track ID: ${phpResult.trackid}`)
    console.log(`   XML file: ${phpResult.xml_file}\n`)

    // Read PHP XML
    if (phpResult.xml_file && fs.existsSync(phpResult.xml_file)) {
      const phpXml = fs.readFileSync(phpResult.xml_file, 'utf8')
      console.log(`📄 PHP XML length: ${phpXml.length} chars\n`)

      // Analyze TED
      const tedMatch = /<TED[\s\S]*?<\/TED>/.exec(phpXml)
      if (tedMatch) {
        const ted = tedMatch[0]
        console.log(`🎫 PHP TED:`)
        console.log(`   Length: ${ted.length} chars`)
        
        const ddMatch = /<DD>([\s\S]*?)<\/DD>/.exec(ted)
        if (ddMatch) {
          const dd = ddMatch[1]
          console.log(`   DD content length: ${dd.length} chars`)
          console.log(`   DD has CAF: ${dd.includes('<CAF') ? 'YES' : 'NO'}`)
        }
        
        const frmtMatch = /<FRMT[^>]*>([^<]*)<\/FRMT>/.exec(ted)
        if (frmtMatch) {
          console.log(`   FRMT length: ${frmtMatch[1].length} chars`)
          console.log(`   FRMT first 50: ${frmtMatch[1].substring(0, 50)}...\n`)
        }
      }

      // Compare XMLs
      if ('signed_xml' in signResult) {
        console.log('=' .repeat(80))
        console.log('\n📊 COMPARISON\n')
        console.log('=' .repeat(80) + '\n')

        const elements = [
          'TipoDTE', 'Folio', 'FchEmis', 'RUTEmisor', 'RznSocEmisor',
          'GiroEmisor', 'DirOrigen', 'CmnaOrigen', 'RUTRecep', 'RznSocRecep',
          'MntTotal', 'RutEmisor', 'RutEnvia', 'RutReceptor', 'FchResol', 'NroResol'
        ]

        for (const elem of elements) {
          const nodeMatch = new RegExp(`<${elem}>([^<]*)<\/${elem}>`).exec(signResult.signed_xml)
          const phpMatch = new RegExp(`<${elem}>([^<]*)<\/${elem}>`).exec(phpXml)
          
          const nodeValue = nodeMatch ? nodeMatch[1] : '(not found)'
          const phpValue = phpMatch ? phpMatch[1] : '(not found)'
          
          if (nodeValue !== phpValue) {
            console.log(`❌ ${elem}:`)
            console.log(`   Node.js: ${nodeValue}`)
            console.log(`   PHP:     ${phpValue}\n`)
          } else {
            console.log(`✅ ${elem}: ${nodeValue}`)
          }
        }
      }
    }
  }

  console.log('\n' + '=' .repeat(80))
  console.log('✅ DIAGNOSTIC COMPLETE')
  console.log('=' .repeat(80) + '\n')
}

diagnose().catch((err) => {
  console.error('\n💥 Fatal error:', err)
  process.exit(1)
})
