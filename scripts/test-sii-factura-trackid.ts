import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@/lib/supabase/server'
import { loadCredentials } from '@/lib/dte/signer'
import { getSiiTokenFactura, SiiEnvironment } from '@/lib/dte/sii-client'

/**
 * Consulta el estado de un envío por Track ID usando QueryEstUp (getEstUp).
 * Esto devuelve el detalle completo del rechazo, incluyendo el código de error.
 *
 * Uso: npx tsx scripts/test-sii-factura-trackid.ts <restaurant_id> <track_id>
 * Ejemplo: npx tsx scripts/test-sii-factura-trackid.ts "2c8864cd-..." "0247079532"
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require('https') as typeof import('https')

async function queryEstUp(
  rutEmisor: string,
  trackId: string,
  token: string,
  environment: SiiEnvironment
): Promise<string> {
  const servidor = environment === 'produccion' ? 'palena' : 'maullin'

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Body>
    <getEstUp xmlns="http://DefaultNamespace">
      <RutEmpresa>${rutEmisor.split('-')[0]}</RutEmpresa>
      <DvEmpresa>${rutEmisor.split('-')[1]}</DvEmpresa>
      <TrackId>${trackId}</TrackId>
      <token>${token}</token>
    </getEstUp>
  </soapenv:Body>
</soapenv:Envelope>`

  const url = new URL(`https://${servidor}.sii.cl/DTEWS/QueryEstUp.jws`)
  return new Promise((resolve, reject) => {
    let settled = false
    let gotResponse = false
    const done = (v: string) => { if (!settled) { settled = true; resolve(v) } }
    const fail = (e: Error)  => { if (!settled) { settled = true; reject(e) } }

    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': '',
        'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; LibreDTE)',
        'Connection': 'close',
      },
    }, (res) => {
      gotResponse = true
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => done(Buffer.concat(chunks).toString('utf8')))
      res.on('close', () => { if (chunks.length > 0) done(Buffer.concat(chunks).toString('utf8')) })
      res.on('error', (e: Error) => { if (chunks.length > 0) done(Buffer.concat(chunks).toString('utf8')); else fail(e) })
    })

    req.on('error', (err: NodeJS.ErrnoException) => {
      if (gotResponse) setTimeout(() => fail(err), 500)
      else fail(err)
    })

    req.write(soapEnvelope)
    req.end()
  })
}

async function run() {
  const restaurantId = process.argv[2]
  const trackId      = process.argv[3]

  if (!restaurantId || !trackId) {
    console.error('Uso: npx tsx scripts/test-sii-factura-trackid.ts <restaurant_id> <track_id>')
    process.exit(1)
  }

  const supabase = createAdminClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('rut, dte_environment')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) { console.error('❌ Restaurante no encontrado'); process.exit(1) }

  const environment: SiiEnvironment = restaurant.dte_environment === 'production' ? 'produccion' : 'certificacion'
  console.log(`\n🔍 Consultando Track ID ${trackId} — Entorno: ${environment}`)

  const creds = await loadCredentials(restaurantId)
  if ('error' in creds) { console.error('❌ Error credenciales:', creds.error); process.exit(1) }

  const tokenResult = await getSiiTokenFactura(creds.privateKeyPem, creds.certificate, environment)
  if (!tokenResult.token) { console.error('❌ Error token:', tokenResult.error); process.exit(1) }
  console.log(`✅ Token: ${tokenResult.token.substring(0, 15)}...`)

  console.log('\n📌 Consultando QueryEstUp...')
  const response = await queryEstUp(restaurant.rut ?? '', trackId, tokenResult.token, environment)

  console.log('\n📥 Respuesta raw del SII:')
  console.log(response)

  // Intentar extraer el estado y glosa
  const import_re = (s: string) => s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&#xd;/gi,'')
  const returnMatch = /<(?:\w+:)?getEstUpReturn[^>]*>([\s\S]*?)<\/(?:\w+:)?getEstUpReturn>/.exec(response)
  if (returnMatch) {
    const inner = import_re(returnMatch[1])
    console.log('\n📋 XML interno decodificado:')
    console.log(inner)
  }
}

run().catch(err => { console.error('Error:', err); process.exit(1) })
