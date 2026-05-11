/**
 * scripts/backfill-agent-enriched-photos.ts
 *
 * Backfill de fotos de Google Places para restaurants `agent_enriched` que
 * todavía no tienen `photo_url` poblado.
 *
 * Flujo por restaurant:
 *   1. Verificar budget mensual antes de cada operación (hard stop si excede).
 *   2. Re-buscar el lugar en Google Places por nombre + dirección (Text Search).
 *   3. Tomar la primera foto (places.photos[0].name).
 *   4. Descargar via Places Photos API media endpoint.
 *   5. Subir a Supabase Storage bucket restaurant-photos/agent-enriched/.
 *   6. UPDATE restaurants con photo_url + photo_source='google_places' +
 *      google_photo_attribution + photo_fetched_at + photo_fetch_attempted.
 *   7. Log a enrichment_log con costo desglosado.
 *
 * Guard ownership: WHERE photo_source IS DISTINCT FROM 'owner_upload'.
 *
 * Uso:
 *   npx tsx scripts/backfill-agent-enriched-photos.ts             # dry-run
 *   npx tsx scripts/backfill-agent-enriched-photos.ts --apply     # ejecuta
 *   npx tsx scripts/backfill-agent-enriched-photos.ts --apply --limit 10
 */
import { readFileSync } from 'fs'
import { join } from 'path'

async function loadEnv() {
  try {
    const lines = readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      const k = t.slice(0, eq).trim()
      const v = t.slice(eq + 1).trim()
      if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}

const COST_TEXT_SEARCH_USD = 0.032
const COST_PHOTO_USD       = 0.007
const DEFAULT_MONTHLY_BUDGET_USD = 50

async function main() {
  await loadEnv()
  const { createClient } = await import('@supabase/supabase-js')

  const apply = process.argv.includes('--apply')
  const limitIdx = process.argv.indexOf('--limit')
  const limit = limitIdx > 0 ? parseInt(process.argv[limitIdx + 1] ?? '0', 10) : 0

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY no configurada')
    process.exit(1)
  }

  // Targets: agent_enriched sin foto, sin intento previo, sin owner override.
  let q = sb
    .from('restaurants')
    .select('id, name, slug, address, neighborhood, lat, lng, photo_source, photo_fetch_attempted')
    .eq('data_source', 'agent_enriched')
    .is('photo_url', null)
    .eq('photo_fetch_attempted', false)
    .neq('photo_source', 'owner_upload')

  if (limit > 0) q = q.limit(limit)

  const { data: targets, error } = await q
  if (error) { console.error(error); process.exit(1) }
  if (!targets || targets.length === 0) {
    console.log('No hay restaurants pendientes de backfill.')
    return
  }

  console.log(`Targets: ${targets.length}`)
  console.log(`Costo estimado máximo: $${(targets.length * (COST_TEXT_SEARCH_USD + COST_PHOTO_USD)).toFixed(2)}`)
  console.log(`Apply mode: ${apply ? 'ON (ejecuta)' : 'OFF (dry-run)'}`)
  console.log('')

  if (!apply) {
    console.log('Primeros 10 targets:')
    for (const r of targets.slice(0, 10)) {
      console.log(`  - ${r.name}  (${r.neighborhood ?? '?'})  [${r.slug}]`)
    }
    console.log('\nCorre con --apply para ejecutar.')
    return
  }

  // Budget check
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1); startOfMonth.setUTCHours(0, 0, 0, 0)
  const { data: log } = await sb
    .from('enrichment_log').select('cost_usd')
    .gte('last_enriched_at', startOfMonth.toISOString())
  let spend = (log as { cost_usd: number | string }[] ?? [])
    .reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
  const budget = Number(process.env.GOOGLE_PLACES_MONTHLY_BUDGET_USD ?? DEFAULT_MONTHLY_BUDGET_USD)
  console.log(`Gasto mensual actual: $${spend.toFixed(4)} / $${budget.toFixed(2)}`)
  console.log('')

  let okCount = 0
  let failCount = 0

  for (const r of targets) {
    // Re-check budget antes de cada call
    if (spend >= budget) {
      console.log(`⏸  Budget excedido — frenando. ${okCount} ok / ${failCount} fail / ${targets.length - okCount - failCount} pendientes.`)
      break
    }

    let textCount = 0, photoCount = 0
    try {
      // 1. Re-buscar el lugar
      const textQuery = `${r.name} ${r.address ?? r.neighborhood ?? ''}`.slice(0, 200)
      const tsRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
          'X-Goog-FieldMask': 'places.photos.name,places.photos.authorAttributions,places.location',
        },
        body: JSON.stringify({ textQuery, languageCode: 'es' }),
        signal: AbortSignal.timeout(20000),
      })
      textCount = 1
      spend += COST_TEXT_SEARCH_USD

      if (!tsRes.ok) {
        console.warn(`  ✗ ${r.slug}: text search ${tsRes.status}`)
        failCount++
        await sb.from('restaurants').update({
          photo_fetch_attempted: true,
          photo_source: 'placeholder',
        }).eq('id', r.id).neq('photo_source', 'owner_upload')
        await sb.from('enrichment_log').insert({
          zone_key: 'backfill', cuisine: '',
          results_count: 0, cost_usd: COST_TEXT_SEARCH_USD,
          text_search_count: textCount, photo_count: 0,
        })
        continue
      }

      const data = await tsRes.json() as { places?: Array<{ photos?: Array<{ name?: string; authorAttributions?: unknown }> }> }
      const photos = data.places?.[0]?.photos ?? []
      const first  = photos[0]
      if (!first?.name) {
        console.log(`  - ${r.slug}: sin photos — placeholder`)
        await sb.from('restaurants').update({
          photo_fetch_attempted: true,
          photo_source: 'placeholder',
        }).eq('id', r.id).neq('photo_source', 'owner_upload')
        await sb.from('enrichment_log').insert({
          zone_key: 'backfill', cuisine: '',
          results_count: 0, cost_usd: COST_TEXT_SEARCH_USD,
          text_search_count: textCount, photo_count: 0,
        })
        okCount++
        continue
      }

      // 2. Descargar foto
      const url = `https://places.googleapis.com/v1/${first.name}/media?maxWidthPx=1200&key=${process.env.GOOGLE_PLACES_API_KEY}`
      const photoRes = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow' })
      photoCount = 1
      spend += COST_PHOTO_USD

      if (!photoRes.ok) {
        console.warn(`  ✗ ${r.slug}: photo download ${photoRes.status}`)
        await sb.from('restaurants').update({
          photo_fetch_attempted: true,
          photo_source: 'placeholder',
        }).eq('id', r.id).neq('photo_source', 'owner_upload')
        await sb.from('enrichment_log').insert({
          zone_key: 'backfill', cuisine: '',
          results_count: 0, cost_usd: COST_TEXT_SEARCH_USD + COST_PHOTO_USD,
          text_search_count: textCount, photo_count: photoCount,
        })
        failCount++
        continue
      }

      const buf = Buffer.from(await photoRes.arrayBuffer())
      const path = `agent-enriched/${r.slug}-${Date.now()}.jpg`
      const { error: upErr } = await sb.storage.from('restaurant-photos')
        .upload(path, buf, { contentType: 'image/jpeg', upsert: true })

      if (upErr) {
        console.error(`  ✗ ${r.slug}: storage upload — ${upErr.message}`)
        failCount++
        await sb.from('enrichment_log').insert({
          zone_key: 'backfill', cuisine: '',
          results_count: 0, cost_usd: COST_TEXT_SEARCH_USD + COST_PHOTO_USD,
          text_search_count: textCount, photo_count: photoCount,
        })
        continue
      }

      const { data: urlData } = sb.storage.from('restaurant-photos').getPublicUrl(path)

      // 3. UPDATE restaurant con guard owner_upload
      await sb.from('restaurants').update({
        photo_url:                urlData.publicUrl,
        photo_source:             'google_places',
        photo_fetched_at:         new Date().toISOString(),
        photo_fetch_attempted:    true,
        google_photo_attribution: first.authorAttributions ?? null,
      }).eq('id', r.id).neq('photo_source', 'owner_upload')

      await sb.from('enrichment_log').insert({
        zone_key: 'backfill', cuisine: '',
        results_count: 1, cost_usd: COST_TEXT_SEARCH_USD + COST_PHOTO_USD,
        text_search_count: textCount, photo_count: photoCount,
      })

      okCount++
      console.log(`  ✓ ${r.slug}  [$${(COST_TEXT_SEARCH_USD + COST_PHOTO_USD).toFixed(4)} → total $${spend.toFixed(4)}]`)
    } catch (err) {
      failCount++
      console.error(`  ✗ ${r.slug}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log('')
  console.log(`✅ Done. ${okCount} ok / ${failCount} fail.`)
  console.log(`Gasto total acumulado del mes: $${spend.toFixed(4)}`)
}

main().catch(e => { console.error(e); process.exit(1) })
