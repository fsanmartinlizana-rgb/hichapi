/** Diagnóstico rápido: cuántos restaurants tienen el placeholder fake
 *  "Plato del día" y cuántos agent_enriched quedaron mal marcados como
 *  claimed=true. */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const lines = readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    if (!process.env[t.slice(0, eq).trim()]) {
      process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
    }
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 1. Placeholder menu_items
  const { data: phItems, count } = await sb
    .from('menu_items')
    .select('id, restaurant_id, name, price, description', { count: 'exact' })
    .eq('name', 'Plato del día')
    .eq('price', 9900)
    .eq('description', 'Consultar al restaurante para la carta del día')
  console.log(`Placeholder "Plato del día" rows: ${count ?? 0}`)
  console.log(`  Restaurants únicos afectados: ${new Set((phItems ?? []).map(i => i.restaurant_id)).size}`)

  // 2. agent_enriched con claimed=true (regresión del default antiguo)
  const { data: bad } = await sb
    .from('restaurants')
    .select('id, name, slug, claimed, owner_id, data_source')
    .eq('data_source', 'agent_enriched')
    .eq('claimed', true)
  console.log(`\nagent_enriched con claimed=true (deberían ser false): ${(bad ?? []).length}`)
  for (const r of (bad ?? []).slice(0, 10)) {
    console.log(`  - ${r.name} (${r.slug}) owner_id=${r.owner_id ?? '(null)'}`)
  }

  // 3. Niu Sushi específicamente
  const { data: niu } = await sb
    .from('restaurants')
    .select('id, name, slug, claimed, owner_id, data_source, address, photo_url')
    .ilike('name', 'Niu Sushi%')
  console.log(`\nNiu Sushi:`)
  for (const r of (niu ?? [])) {
    console.log(`  - ${r.name} (${r.slug})`)
    console.log(`    claimed=${r.claimed}  owner_id=${r.owner_id ?? '(null)'}  data_source=${r.data_source}`)
    console.log(`    address=${r.address ?? '(null)'}  photo=${r.photo_url ? 'sí' : 'no'}`)
    const { data: items } = await sb.from('menu_items').select('id, name, price').eq('restaurant_id', r.id)
    console.log(`    menu_items: ${items?.length ?? 0}`)
    for (const i of (items ?? []).slice(0, 5)) console.log(`      • ${i.name} ($${i.price})`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
