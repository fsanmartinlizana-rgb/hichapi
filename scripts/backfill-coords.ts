/**
 * Geocodifica restaurants que tienen address pero no lat/lng. Usa Google
 * Places Text Search New (mismo API que ya usamos para enrichment).
 * Costo: ~$0.005 por restaurant (Essentials tier sin reviews).
 *
 * Uso:
 *   npx tsx scripts/backfill-coords.ts          # dry-run
 *   npx tsx scripts/backfill-coords.ts --apply  # ejecuta
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const lines = readFileSync('.env.local','utf8').split('\n')
  for (const l of lines) {
    const eq = l.indexOf('='); if (eq < 0) continue
    if (!process.env[l.slice(0,eq).trim()]) process.env[l.slice(0,eq).trim()] = l.slice(eq+1).trim()
  }
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY no configurada')
    process.exit(1)
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const apply = process.argv.includes('--apply')

  const { data } = await sb
    .from('restaurants')
    .select('id, name, address, neighborhood')
    .or('lat.is.null,lng.is.null')
    .eq('active', true)
  const targets = data ?? []

  console.log(`Targets sin coords: ${targets.length}`)
  console.log(`Costo estimado: $${(targets.length * 0.005).toFixed(2)} (Text Search Essentials)`)

  if (!apply) {
    console.log('\nPrimeros 10 targets:')
    for (const r of targets.slice(0, 10)) {
      console.log(`  - ${r.name} (${r.neighborhood ?? '?'}) ${r.address ? '['+r.address.slice(0,40)+']' : '[sin address]'}`)
    }
    console.log('\nCorre con --apply para geocodificar.')
    return
  }

  let ok = 0, fail = 0
  for (let i = 0; i < targets.length; i++) {
    const r = targets[i]
    // Query: name + address (más preciso) o name + neighborhood + Santiago Chile
    const textQuery = r.address
      ? `${r.name} ${r.address}`
      : `${r.name} ${r.neighborhood ?? ''} Santiago Chile`

    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
          'X-Goog-FieldMask': 'places.location,places.formattedAddress',
        },
        body: JSON.stringify({ textQuery: textQuery.slice(0, 200), languageCode: 'es' }),
        signal: AbortSignal.timeout(15_000),
      })
      const j = await res.json() as { places?: Array<{ location?: { latitude: number; longitude: number }, formattedAddress?: string }> }
      const place = j.places?.[0]
      if (!place?.location) {
        console.log(`  ✗ ${r.name}: Google no devolvió coords`)
        fail++
        continue
      }
      const { latitude, longitude } = place.location
      const update: { lat: number; lng: number; address?: string } = { lat: latitude, lng: longitude }
      if (!r.address && place.formattedAddress) update.address = place.formattedAddress
      await sb.from('restaurants').update(update).eq('id', r.id)
      ok++
      process.stdout.write(`\r  ${i + 1}/${targets.length}  ok=${ok} fail=${fail}`)
    } catch (err) {
      fail++
      console.log(`\n  ✗ ${r.name}: ${err instanceof Error ? err.message : err}`)
    }
    await new Promise(r => setTimeout(r, 200))
  }
  console.log(`\n\n✅ Done. ${ok} actualizados / ${fail} fallaron`)
}

main().catch(e => { console.error(e); process.exit(1) })
