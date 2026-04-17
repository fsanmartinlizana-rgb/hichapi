/**
 * Debug script to query SII status directly and see the full response
 * 
 * Usage:
 *   npx tsx scripts/debug-sii-status.ts <restaurant_id> <track_id>
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import * as forge from 'node-forge'

// Load environment variables from .env.local manually
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const envFile = readFileSync(envPath, 'utf8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      process.env[key] = value
    }
  })
} catch (err) {
  console.error('⚠️  Could not load .env.local file')
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗')
  console.error('   DTE_MASTER_KEY:', process.env.DTE_MASTER_KEY ? '✓' : '✗')
  console.error('\nMake sure .env.local exists and contains these variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Decrypt function (copied from lib/crypto/aes.ts)
function decrypt(encrypted: { ciphertext: string; iv: string; authTag: string }): Buffer {
  const crypto = require('crypto')
  
  // Derive 32-byte key from DTE_MASTER_KEY using SHA-256
  const raw = process.env.DTE_MASTER_KEY!
  if (!raw) {
    throw new Error('DTE_MASTER_KEY not configured')
  }
  const key = crypto.createHash('sha256').update(raw, 'utf8').digest()
  
  const iv = Buffer.from(encrypted.iv, 'base64')
  const ct = Buffer.from(encrypted.ciphertext, 'base64')
  const authTag = Buffer.from(encrypted.authTag, 'base64')
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

async function signSeedXml(seed: string, restaurantId: string): Promise<string> {
  const { data: cred } = await supabase
    .from('dte_credentials')
    .select('cert_ciphertext, cert_iv, cert_auth_tag, pass_ciphertext, pass_iv, pass_auth_tag')
    .eq('restaurant_id', restaurantId)
    .single()

  if (!cred) throw new Error('No credentials found')

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

  const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'))
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, pfxPassword)

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key as forge.pki.rsa.PrivateKey

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert

  if (!privateKey || !cert) throw new Error('Invalid certificate')

  const seedXmlToSign = `<getToken><item><Semilla>${seed}</Semilla></item></getToken>`

  // Use xml-crypto for signing
  const { SignedXml } = require('xml-crypto')
  const privateKeyPem = forge.pki.privateKeyToPem(privateKey)
  const certPem = forge.pki.certificateToPem(cert)

  const certBody = certPem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\r?\n/g, '')
    .trim()
  const certWrapped = certBody.match(/.{1,64}/g)?.join('\n') ?? certBody

  const rsaKey = privateKey as forge.pki.rsa.PrivateKey & { n: forge.jsbn.BigInteger; e: forge.jsbn.BigInteger }
  const modulusBytes = rsaKey.n.toByteArray()
  const modulusRaw = Buffer.from(
    new Uint8Array(modulusBytes.slice(modulusBytes[0] === 0 ? 1 : 0))
  ).toString('base64')
  const exponent = Buffer.from(new Uint8Array(rsaKey.e.toByteArray())).toString('base64')
  const modulus = modulusRaw.match(/.{1,64}/g)?.join('\n') ?? modulusRaw

  const keyInfoContent = `<KeyValue><RSAKeyValue><Modulus>${modulus}</Modulus><Exponent>${exponent}</Exponent></RSAKeyValue></KeyValue><X509Data><X509Certificate>${certWrapped}</X509Certificate></X509Data>`

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    getKeyInfoContent: () => keyInfoContent,
  })
  sig.addReference({
    xpath: '/*',
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
  })
  sig.signingKey = privateKeyPem
  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
  sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

  sig.computeSignature(seedXmlToSign)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${sig.getSignedXml()}`
}

async function main() {
  const [restaurantId, trackId] = process.argv.slice(2)

  if (!restaurantId || !trackId) {
    console.error('Usage: npx tsx scripts/debug-sii-status.ts <restaurant_id> <track_id>')
    process.exit(1)
  }

  console.log('🔍 Querying SII status for track ID:', trackId)

  // Get restaurant RUT and environment
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('rut, dte_environment')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) {
    console.error('❌ Restaurant not found')
    process.exit(1)
  }

  const environment = restaurant.dte_environment === 'production' ? 'produccion' : 'certificacion'
  const endpoints = {
    certificacion: {
      semilla: 'https://apicert.sii.cl/recursos/v1/boleta.electronica.semilla',
      token: 'https://apicert.sii.cl/recursos/v1/boleta.electronica.token',
      status: 'https://apicert.sii.cl/recursos/v1/boleta.electronica.envio',
    },
    produccion: {
      semilla: 'https://api.sii.cl/recursos/v1/boleta.electronica.semilla',
      token: 'https://api.sii.cl/recursos/v1/boleta.electronica.token',
      status: 'https://api.sii.cl/recursos/v1/boleta.electronica.envio',
    },
  }

  const ep = endpoints[environment]

  console.log('🌍 Environment:', environment)
  console.log('🏢 Restaurant RUT:', restaurant.rut)

  // Step 1: Get seed
  console.log('\n📡 Step 1: Getting seed...')
  const seedRes = await fetch(ep.semilla, { headers: { Accept: 'application/xml' } })
  const seedXml = await seedRes.text()
  const seedMatch = /<SEMILLA>([^<]+)<\/SEMILLA>/i.exec(seedXml)
  if (!seedMatch) {
    console.error('❌ Failed to get seed:', seedXml.slice(0, 200))
    process.exit(1)
  }
  const seed = seedMatch[1].trim()
  console.log('✅ Seed obtained:', seed.slice(0, 20) + '...')

  // Step 2: Sign seed and get token
  console.log('\n🔐 Step 2: Signing seed and getting token...')
  const signedSeedXml = await signSeedXml(seed, restaurantId)
  const tokenRes = await fetch(ep.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; LibreDTE)',
      'Referer': 'https://libredte.cl',
    },
    body: signedSeedXml,
  })
  const tokenXml = await tokenRes.text()
  const tokenMatch = /<TOKEN>([^<]+)<\/TOKEN>/i.exec(tokenXml)
  if (!tokenMatch) {
    console.error('❌ Failed to get token:', tokenXml.slice(0, 200))
    process.exit(1)
  }
  const token = tokenMatch[1].trim()
  console.log('✅ Token obtained:', token.slice(0, 20) + '...')

  // Step 3: Query status
  console.log('\n📊 Step 3: Querying status...')
  const [rutNum, dv] = restaurant.rut.replace(/\./g, '').replace('-', '').match(/^(\d+)(\d|k|K)$/i)?.slice(1) ?? []
  const statusUrl = `${ep.status}/${rutNum}-${dv}-${trackId}`
  console.log('🔗 Status URL:', statusUrl)

  const statusRes = await fetch(statusUrl, {
    headers: {
      'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; LibreDTE)',
      'Referer': 'https://libredte.cl',
      'Cookie': `TOKEN=${token}`,
      'Accept': 'application/json',
    },
  })

  console.log('📡 Status code:', statusRes.status)
  const statusText = await statusRes.text()

  console.log('\n📄 Full response:')
  console.log('─'.repeat(80))
  try {
    const json = JSON.parse(statusText)
    console.log(JSON.stringify(json, null, 2))
  } catch {
    console.log(statusText)
  }
  console.log('─'.repeat(80))
}

main().catch(console.error)
