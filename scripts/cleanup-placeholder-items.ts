/** Borra los menu_items placeholder "Plato del día" — data inventada de
 *  versiones anteriores del agente que ya no se inserta. Idempotente.
 *
 *  Uso:
 *    npx tsx scripts/cleanup-placeholder-items.ts          # dry-run
 *    npx tsx scripts/cleanup-placeholder-items.ts --apply  # ejecuta
 */
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

  // Buscar todos los placeholders. Triple-check para no borrar nada real
  // (name + price + description exactos).
  const { data } = await sb
    .from('menu_items')
    .select('id, restaurant_id, name, price, description')
    .eq('name', 'Plato del día')
    .eq('price', 9900)
    .eq('description', 'Consultar al restaurante para la carta del día')

  const items = data ?? []
  console.log(`Placeholders encontrados: ${items.length}`)
  console.log(`Restaurants únicos afectados: ${new Set(items.map(i => i.restaurant_id)).size}`)

  if (!process.argv.includes('--apply')) {
    console.log('\n(Dry run — corre con --apply para borrar)')
    return
  }

  // Borrar en batches de 100 (Supabase tiene límites de query)
  let deleted = 0
  for (let i = 0; i < items.length; i += 100) {
    const batch = items.slice(i, i + 100).map(x => x.id)
    const { error } = await sb.from('menu_items').delete().in('id', batch)
    if (error) {
      console.error(`Batch ${i} failed:`, error.message)
      continue
    }
    deleted += batch.length
    process.stdout.write(`\r  Deleted ${deleted}/${items.length}`)
  }
  console.log(`\n✅ ${deleted} placeholders borrados.`)
}

main().catch(e => { console.error(e); process.exit(1) })
