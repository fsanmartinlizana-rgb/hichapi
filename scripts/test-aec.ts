/**
 * scripts/test-aec.ts
 *
 * Genera un XML AEC de prueba cargando el certificado desde Supabase
 * (igual que en producción) y valida la firma RSA-SHA1.
 *
 * Uso:
 *   npx tsx scripts/test-aec.ts <restaurant_id>
 */

// Cargar variables de entorno desde .env.local antes de cualquier import
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import fs     from 'fs'
import crypto from 'crypto'
import * as forge from 'node-forge'
import { loadCredentials } from '../lib/dte/signer'
import { buildRecepcionDteXml, buildEnvioRecibosXml, buildResultadoDteXml } from '../lib/dte/aec-builder'

// Leer restaurant_id desde args o .env.local
const restaurantId = process.argv[2] ?? process.env.TEST_RESTAURANT_ID

async function main() {
  if (!restaurantId) {
    console.error('❌ Uso: npx tsx scripts/test-aec.ts <restaurant_id>')
    console.error('   O define TEST_RESTAURANT_ID en .env.local')
    process.exit(1)
  }

  console.log('🔑 Cargando credenciales desde Supabase para:', restaurantId)

  const creds = await loadCredentials(restaurantId)
  if ('error' in creds) {
    console.error('❌ Error cargando credenciales:', creds.error)
    process.exit(1)
  }

  console.log('✅ Certificado cargado')

  const baseInput = {
    rutReceptor:   '77042148-9',
    razonReceptor: 'Comercial Italia Licores SPA',
    rutEmisor:     '76354771-K',
    razonEmisor:   'Empresa de Prueba SpA',
    documento: {
      tipoDte:      33,
      folio:        321,
      fechaEmision: '2025-08-22',
      rutEmisor:    '76354771-K',
      rutReceptor:  '77042148-9',
      montoTotal:   10000,
    },
    privateKeyPem: creds.privateKeyPem,
    certificate:   creds.certificate,
  }

  // Generar las 3 etapas
  const xml015 = buildRecepcionDteXml(baseInput)
  const xml016 = buildEnvioRecibosXml(baseInput, 'Bodega central')
  const xml017 = buildResultadoDteXml({ ...baseInput, estado: 'aceptado' })

  fs.writeFileSync('/tmp/015_RecepcionDTE.xml',  xml015, 'utf8')
  fs.writeFileSync('/tmp/016_EnvioRecibos.xml',  xml016, 'utf8')
  fs.writeFileSync('/tmp/017_ResultadoDTE.xml',  xml017, 'utf8')

  console.log('✅ XMLs generados:')
  console.log('   /tmp/015_RecepcionDTE.xml')
  console.log('   /tmp/016_EnvioRecibos.xml')
  console.log('   /tmp/017_ResultadoDTE.xml')

  // ── Validar la firma RSA-SHA1 del XML 017 ────────────────────────────────────
  console.log('\n🔍 Validando firma RSA-SHA1 del 017_ResultadoDTE...')

  const sigMatch    = /<SignatureValue>([\s\S]*?)<\/SignatureValue>/.exec(xml017)
  const digestMatch = /<DigestValue>([^<]+)<\/DigestValue>/.exec(xml017)
  const idMatch     = /RespuestaEnvioDTE ID="([^"]+)"/.exec(xml017)

  const sigValue    = sigMatch?.[1]?.replace(/\s/g, '')
  const digestValue = digestMatch?.[1]?.replace(/\s/g, '')
  const resultId    = idMatch?.[1] ?? ''

  if (!sigValue || !digestValue) {
    console.error('❌ No se encontró SignatureValue o DigestValue en el XML')
    process.exit(1)
  }

  // Reconstruir el SignedInfo que se firmó (con closing tags explícitos)
  const signedInfoForVerify =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${resultId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`

  // Importar forge para obtener el PEM del certificado
  const certPem = forge.pki.certificateToPem(creds.certificate)

  const verifier = crypto.createVerify('RSA-SHA1')
  verifier.update(signedInfoForVerify, 'utf8')
  const isValid = verifier.verify(certPem, Buffer.from(sigValue, 'base64'))

  if (isValid) {
    console.log('✅ Firma RSA-SHA1 VÁLIDA — el XML es auténtico')
  } else {
    console.error('❌ Firma RSA-SHA1 INVÁLIDA')
  }

  // ── Mostrar primeras líneas del XML 017 ──────────────────────────────────────
  console.log('\n📄 017_ResultadoDTE (primeras 35 líneas):')
  xml017.split('\n').slice(0, 35).forEach((line, i) =>
    console.log(`  ${String(i+1).padStart(3)}: ${line}`)
  )

  console.log('\n📋 Para abrir los XMLs:')
  console.log('  open /tmp/015_RecepcionDTE.xml')
  console.log('  open /tmp/016_EnvioRecibos.xml')
  console.log('  open /tmp/017_ResultadoDTE.xml')
}

main().catch(err => {
  console.error('❌ Error inesperado:', err)
  process.exit(1)
})
