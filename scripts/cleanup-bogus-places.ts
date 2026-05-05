/**
 * scripts/cleanup-bogus-places.ts
 *
 * Borra restaurants `agent_enriched` cuyo nombre claramente NO es un local
 * de comida (escuelas, institutos, etc.). El agente los podía meter antes
 * del filtro FOOD_TYPES — esos registros viejos se limpian acá.
 *
 * Uso: npx tsx scripts/cleanup-bogus-places.ts          # dry-run
 *      npx tsx scripts/cleanup-bogus-places.ts --apply  # borra
 */
import { readFileSync } from 'fs'
import { join } from 'path'

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

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const NON_FOOD_PATTERNS: RegExp[] = [
  /lyc[ée]e/i, /instituto/i, /colegio/i, /\bschool\b/i, /escuela/i,
  /academia/i, /universidad/i, /facultad/i, /campus/i, /municipalidad/i,
  /centro\s+m[ée]dico/i, /cl[íi]nica/i, /hospital/i, /supermercado/i,
  /\bbanco\b/i, /\bgym\b/i, /\bgimnasio\b/i,
]

async function main() {
  const { data, error } = await sb
    .from('restaurants')
    .select('id, name, data_source')
    .eq('data_source', 'agent_enriched')

  if (error || !data) { console.error(error); process.exit(1) }

  const bogus = data.filter(r => NON_FOOD_PATTERNS.some(p => p.test(r.name)))
  console.log(`Total agent_enriched: ${data.length}`)
  console.log(`Bogus encontrados:    ${bogus.length}`)
  for (const b of bogus) console.log(`  - ${b.name}  (id=${b.id})`)

  if (!process.argv.includes('--apply')) {
    console.log('\n(Dry-run — corre con --apply para borrar)')
    return
  }

  for (const b of bogus) {
    await sb.from('menu_items').delete().eq('restaurant_id', b.id)
    await sb.from('restaurants').delete().eq('id', b.id)
  }
  console.log(`✅ ${bogus.length} bogus borrados.`)
}

main().catch(e => { console.error(e); process.exit(1) })
