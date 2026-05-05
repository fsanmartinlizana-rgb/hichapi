/**
 * scripts/qa-discovery.ts
 *
 * Test harness exhaustivo para la lógica de Discovery. Ejecuta una matriz
 * cuisines × zonas y verifica invariantes:
 *
 *  1. results.length <= 3
 *  2. Si results.length > 0 y resolved_zone existe, todos los neighborhoods
 *     de los results matchean la resolved_zone (case/accent insensitive).
 *  3. Si results.length > 0 y se pidió cuisine, cada result satisface el
 *     match estricto (cuisine_type del restaurant matchea OR menú matchea).
 *     Esto se asegura por construcción dentro de fetchAndFilter, así que
 *     acá validamos que el match_reason no esté vacío.
 *  4. no_results_in_zone === true ⇒ results.length === 0.
 *  5. alternatives_in_zone_count > 0 ⇒ no_results_in_zone === true.
 *  6. No hay slugs duplicados dentro del set de results.
 *  7. canonicalCuisine es idempotente y nunca devuelve undefined.
 *
 * Uso: npx tsx scripts/qa-discovery.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'

// Cargar .env.local antes de importar lib/discovery (necesita SUPABASE_*)
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
} catch { /* opcional */ }

import {
  searchRestaurants,
  canonicalCuisine,
  stripAccents,
  type SearchOutput,
} from '../lib/discovery'

// ── Matriz de prueba ─────────────────────────────────────────────────────────

const CUISINES: string[] = [
  // 22 canónicas
  'japonesa', 'italiana', 'peruana', 'mexicana', 'chilena',
  'vegana', 'vegetariana', 'tailandesa', 'parrilla', 'mariscos',
  'cafeteria', 'panaderia', 'heladeria', 'india', 'china',
  'coreana', 'vietnamita', 'arabe', 'americana', 'argentina',
  'venezolana', 'colombiana', 'mediterranea', 'griega', 'espanola',
  'francesa', 'asiatica', 'sandwicheria', 'cerveceria', 'fusion',
  'hamburgueseria',
  // 5 aliases (verifican canonicalCuisine)
  'hindu', 'sushi', 'pizza', 'ramen', 'taco',
  // 3 inválidas (deben ser tratadas como cuisine no-canónica → no rompe)
  'klingon', 'martian', 'zzunknownzz',
]

const ZONES: string[] = [
  // Comunas RM canónicas
  'Providencia', 'Las Condes', 'Vitacura', 'Ñuñoa', 'Santiago Centro',
  'Lastarria', 'Bellavista', 'Barrio Italia', 'Recoleta', 'San Miguel',
  'La Florida', 'Maipú', 'Puente Alto', 'Macul', 'Peñalolén',
  'La Reina', 'Lo Barnechea', 'Independencia', 'Pudahuel', 'Cerrillos',
  'Estación Central', 'Quilicura', 'Renca', 'Conchalí', 'Lo Prado',
  'Quinta Normal', 'San Joaquín', 'San Ramón', 'La Granja', 'La Pintana',
  'El Bosque', 'La Cisterna', 'Pedro Aguirre Cerda', 'Huechuraba',
  // Aledañas
  'San Bernardo', 'Buin', 'Calera de Tango', 'Padre Hurtado',
  'Colina', 'Lampa', 'Til Til', 'Pirque',
  // Landmarks/metros (deben resolver vía landmarks.ts)
  'metro Tobalaba', 'metro Manuel Montt', 'plaza Italia', 'Costanera Center',
  'metro Los Leones', 'metro Salvador', 'metro Pedro de Valdivia',
  'metro Universidad de Chile', 'metro Bellas Artes', 'metro Plaza Egaña',
  'metro Irarrázaval', 'metro Baquedano', 'estación central',
  'plaza de armas', 'la moneda', 'usach', 'el golf', 'isidora goyenechea',
  'sanhattan', 'manquehue', 'tobalaba', 'apoquindo', 'av vitacura',
  'pedro de valdivia', 'patio bellavista', 'parque forestal',
  // Otras regiones (Discovery solo Santiago, pero el motor debe manejar)
  'Concón', 'Viña del Mar', 'Valparaíso', 'Rancagua', 'Talca',
  'Chillán', 'Concepción', 'Temuco', 'Puerto Montt',
  // Edge cases — strings raros
  'asdf', 'ZONA_INEXISTENTE', 'Calle inexistente 9999', '???',
  'A', '',
]

// Filtramos zone vacía (el motor requiere min length para resolveZone)
const VALID_ZONES = ZONES.filter(z => z && z.length >= 2)

// ── Invariantes ──────────────────────────────────────────────────────────────

interface Failure {
  caseId:    string
  invariant: string
  details:   unknown
}

function checkInvariants(
  caseId: string,
  cuisine: string,
  out: SearchOutput,
): Failure[] {
  const failures: Failure[] = []

  // 1. results <= 3
  if (out.results.length > 3) {
    failures.push({
      caseId, invariant: 'results.length <= 3',
      details: { count: out.results.length },
    })
  }

  // 2. neighborhood matches resolved_zone
  if (out.results.length > 0 && out.resolved_zone) {
    const z = stripAccents(out.resolved_zone)
    for (const r of out.results) {
      const n = r.restaurant.neighborhood
      if (n && !stripAccents(n).includes(z) && !z.includes(stripAccents(n))) {
        failures.push({
          caseId, invariant: 'neighborhood matches resolved_zone',
          details: {
            restaurant: r.restaurant.name,
            neighborhood: n,
            resolved_zone: out.resolved_zone,
          },
        })
      }
    }
  }

  // 3. cada result tiene match_reason
  if (out.results.length > 0) {
    for (const r of out.results) {
      if (!r.match_reason || r.match_reason.length < 3) {
        failures.push({
          caseId, invariant: 'every result has a match_reason',
          details: { restaurant: r.restaurant.name, reason: r.match_reason },
        })
      }
    }
  }

  // 4. no_results_in_zone ⇒ results.length === 0
  if (out.no_results_in_zone && out.results.length > 0) {
    failures.push({
      caseId, invariant: 'no_results_in_zone ⇒ empty results',
      details: { count: out.results.length },
    })
  }

  // 5. alternatives_count > 0 ⇒ no_results_in_zone
  if (out.alternatives_in_zone_count > 0 && !out.no_results_in_zone) {
    failures.push({
      caseId, invariant: 'alternatives_count > 0 ⇒ no_results_in_zone',
      details: {
        alternatives_count: out.alternatives_in_zone_count,
      },
    })
  }

  // 6. No duplicados por slug
  const slugs = out.results.map(r => r.restaurant.slug)
  const dupeSet = new Set<string>()
  const dupes: string[] = []
  for (const s of slugs) {
    if (dupeSet.has(s)) dupes.push(s)
    dupeSet.add(s)
  }
  if (dupes.length > 0) {
    failures.push({
      caseId, invariant: 'no duplicate slugs',
      details: { dupes },
    })
  }

  // 7. canonicalCuisine es idempotente y nunca rompe
  const canon = canonicalCuisine(cuisine)
  const reCanon = canonicalCuisine(canon)
  if (canon !== reCanon) {
    failures.push({
      caseId, invariant: 'canonicalCuisine idempotent',
      details: { canon, reCanon },
    })
  }
  if (cuisine && canon === undefined) {
    failures.push({
      caseId, invariant: 'canonicalCuisine never returns undefined',
      details: { cuisine },
    })
  }

  return failures
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function runOne(cuisine: string, zone: string): Promise<{ failures: Failure[]; out: SearchOutput }> {
  const caseId = `cuisine="${cuisine}" zone="${zone}"`
  try {
    const out = await searchRestaurants({ cuisine_type: cuisine, zone })
    return { failures: checkInvariants(caseId, cuisine, out), out }
  } catch (err) {
    return {
      out: { results: [], no_results_in_zone: false, alternatives_in_zone_count: 0, resolved_zone: null },
      failures: [{
        caseId, invariant: 'searchRestaurants does not throw',
        details: err instanceof Error ? err.message : String(err),
      }],
    }
  }
}

async function main() {
  const cases: [string, string][] = []
  for (const c of CUISINES) for (const z of VALID_ZONES) cases.push([c, z])

  console.log(`Running ${cases.length} cases (${CUISINES.length} cuisines × ${VALID_ZONES.length} zones)...`)
  const startedAt = Date.now()

  const allFailures: Failure[] = []
  let totalResults     = 0
  let emptyCases       = 0
  let noResInZoneCases = 0
  let altOfferedCases  = 0

  // Concurrencia limitada para no saturar Supabase.
  const BATCH = 12
  for (let i = 0; i < cases.length; i += BATCH) {
    const batch = cases.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(([c, z]) => runOne(c, z)))
    for (const { failures, out } of results) {
      allFailures.push(...failures)
      totalResults += out.results.length
      if (out.results.length === 0) emptyCases++
      if (out.no_results_in_zone) noResInZoneCases++
      if (out.alternatives_in_zone_count > 0) altOfferedCases++
    }
    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, cases.length)}/${cases.length}`)
  }
  process.stdout.write('\n')

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n=== QA REPORT ===`)
  console.log(`Total cases:                ${cases.length}`)
  console.log(`Elapsed:                    ${elapsed}s`)
  console.log(`Cases with results:         ${cases.length - emptyCases}`)
  console.log(`Empty results:              ${emptyCases}`)
  console.log(`no_results_in_zone:         ${noResInZoneCases}`)
  console.log(`Alternatives offered:       ${altOfferedCases}`)
  console.log(`Total result rows:          ${totalResults}`)
  console.log(`Failures:                   ${allFailures.length}`)

  if (allFailures.length > 0) {
    // Resumen por invariante
    const byInv = new Map<string, Failure[]>()
    for (const f of allFailures) {
      const arr = byInv.get(f.invariant) ?? []
      arr.push(f)
      byInv.set(f.invariant, arr)
    }
    console.log(`\n=== FAILURES BY INVARIANT ===`)
    for (const [inv, list] of byInv) {
      console.log(`\n[${inv}] (${list.length} cases)`)
      for (const f of list.slice(0, 5)) {
        console.log(`  • ${f.caseId} → ${JSON.stringify(f.details)}`)
      }
      if (list.length > 5) console.log(`  ... and ${list.length - 5} more`)
    }
    process.exit(1)
  }

  console.log('\n✅ All invariants hold across all cases.')
  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(2)
})
