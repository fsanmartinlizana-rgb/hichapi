/** Audit: qué data tenemos en agent_enriched vs qué mostramos hoy en /r */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const lines = readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')
  for (const line of lines) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data } = await sb
    .from('restaurants')
    .select('id,name,slug,config_chapi,address,phone,website,instagram,description,hours,google_rating,google_rating_count,google_reviews')
    .eq('data_source','agent_enriched')
    .not('config_chapi','is',null)
    .limit(3)

  for (const r of (data ?? [])) {
    console.log(`\n=== ${r.name} (${r.slug}) ===`)
    console.log('Columnas estructuradas:')
    console.log('  address:', r.address)
    console.log('  phone (col):', r.phone)
    console.log('  website (col):', r.website)
    console.log('  hours (col):', r.hours ? 'SET' : 'null')
    console.log('  description (col):', r.description ? `"${r.description.slice(0, 60)}"` : 'null')
    console.log('  google_rating:', r.google_rating, ' / ', r.google_rating_count, ' reviews')
    console.log('  google_reviews:', r.google_reviews ? `${(r.google_reviews as unknown[]).length} items` : 'null')
    console.log('config_chapi:', JSON.stringify(r.config_chapi, null, 2))
  }

  // Cuántos agent_enriched tienen estas piezas?
  const { data: all } = await sb
    .from('restaurants')
    .select('id,config_chapi,phone,website,hours,description')
    .eq('data_source','agent_enriched')

  let withCfgPhone=0, withCfgWebsite=0, withCfgHorarios=0, withColPhone=0, withColWebsite=0, withColHours=0, withDescription=0
  for (const r of (all ?? [])) {
    const cfg = (r.config_chapi ?? {}) as Record<string, unknown>
    if (cfg.phone)    withCfgPhone++
    if (cfg.website)  withCfgWebsite++
    if (cfg.horarios) withCfgHorarios++
    if (r.phone)       withColPhone++
    if (r.website)     withColWebsite++
    if (r.hours)       withColHours++
    if (r.description) withDescription++
  }
  console.log(`\n=== Stats sobre ${all?.length ?? 0} agent_enriched ===`)
  console.log(`  config_chapi.phone    : ${withCfgPhone} (vs col phone: ${withColPhone})`)
  console.log(`  config_chapi.website  : ${withCfgWebsite} (vs col website: ${withColWebsite})`)
  console.log(`  config_chapi.horarios : ${withCfgHorarios} (vs col hours: ${withColHours})`)
  console.log(`  col description       : ${withDescription}`)
}
main().catch(e => { console.error(e); process.exit(1) })
