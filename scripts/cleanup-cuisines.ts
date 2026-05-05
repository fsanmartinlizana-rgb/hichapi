/**
 * scripts/cleanup-cuisines.ts
 *
 * Limpia `restaurants.cuisine_type` para que todos los valores sean canónicos.
 * Los registros heredados con valores como "Restaurante" o "Pizzeria
 * tradicional" (literal del Google primaryTypeDisplayName) se normalizan
 * usando los mismos matchers que la búsqueda en runtime.
 *
 * Idempotente: solo toca filas con cuisine_type no canónico.
 *
 * Uso: npx tsx scripts/cleanup-cuisines.ts
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
import {
  CUISINE_RESTAURANT_KEYWORDS,
  stripAccents,
} from '../lib/discovery'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const CANONICAL_VALUES = Object.keys(CUISINE_RESTAURANT_KEYWORDS)

/** Mapea un cuisine_type cualquiera (literal o no) al canónico más cercano.
 *  Si no encuentra match, devuelve 'internacional' como catch-all. */
function normalize(raw: string | null): string {
  if (!raw) return 'internacional'
  const norm = stripAccents(raw)
  // Match exacto
  if (CANONICAL_VALUES.includes(norm)) return norm
  // Buscar por keywords
  for (const [canon, keywords] of Object.entries(CUISINE_RESTAURANT_KEYWORDS)) {
    if (keywords.some(k => norm.includes(k))) return canon
  }
  return 'internacional'
}

async function main() {
  console.log('Cargando restaurants...')
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_type, data_source')
  if (error || !data) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log(`Total restaurants: ${data.length}`)

  const updates: { id: string; from: string; to: string }[] = []
  for (const r of data) {
    const current = (r as { cuisine_type: string | null }).cuisine_type ?? null
    const target  = normalize(current)
    if (current !== target) {
      updates.push({ id: r.id, from: current ?? '(null)', to: target })
    }
  }

  console.log(`Restaurants con cuisine_type no canónico: ${updates.length}`)
  if (updates.length === 0) {
    console.log('✅ Nothing to clean.')
    process.exit(0)
  }

  // Resumen del cambio
  const changeCounts = new Map<string, number>()
  for (const u of updates) {
    const k = `${u.from} → ${u.to}`
    changeCounts.set(k, (changeCounts.get(k) ?? 0) + 1)
  }
  console.log('\nCambios propuestos:')
  for (const [k, c] of [...changeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.toString().padStart(4)} × ${k}`)
  }

  if (process.argv.includes('--apply')) {
    console.log('\nAplicando cambios...')
    let ok = 0
    for (const u of updates) {
      const { error } = await supabase
        .from('restaurants')
        .update({ cuisine_type: u.to })
        .eq('id', u.id)
      if (!error) ok++
    }
    console.log(`✅ ${ok}/${updates.length} actualizados.`)
  } else {
    console.log('\n(Dry run — corre con --apply para aplicar.)')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
