/**
 * scripts/populate-test-data.ts
 *
 * Pobla la DB con restaurants reales de Google Places para tener buena
 * cobertura cuando los usuarios buscan. Estrategia:
 *
 *   1. Genera una matriz de (cuisine × zona) con combinaciones probables.
 *   2. Para cada combinación: llama /api/enrich-zone (ya tiene dedupe 30d
 *      y cap de budget mensual). Saltea las que ya se enriquecieron.
 *   3. Tras enrichment, dispara /api/extract-menu para los restaurants
 *      recién insertados que tengan websiteUri (de config_chapi.website).
 *
 * Costo:
 *   - Text Search Pro:    $0.032 / call
 *   - Photo descarga:     $0.007 / foto
 *   - Claude Haiku menu:  ~$0.001 / restaurant (negligible)
 *
 * El cap mensual (GOOGLE_PLACES_MONTHLY_BUDGET_USD, default $50) detiene
 * automático cuando se gasta el budget. No hay riesgo de blowup.
 *
 * Uso:
 *   npx tsx scripts/populate-test-data.ts                # dry-run plan
 *   npx tsx scripts/populate-test-data.ts --apply        # ejecuta enrich
 *   npx tsx scripts/populate-test-data.ts --apply --extract-menus  # + extract
 *   npx tsx scripts/populate-test-data.ts --apply --limit 20       # solo 20
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

async function loadEnv() {
  const lines = readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    if (!process.env[t.slice(0, eq).trim()]) {
      process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
    }
  }
}

// ── Matriz de búsqueda: combinaciones de cuisine × zona ─────────────────────

// Cuisines más buscadas en Chile/Santiago, alineadas con CUISINE_RESTAURANT_KEYWORDS.
const CUISINES = [
  'italiana',     'japonesa',    'peruana',     'mexicana',    'chilena',
  'mariscos',     'parrilla',    'hamburgueseria','cafeteria', 'sandwicheria',
  'china',        'india',       'tailandesa',  'arabe',       'mediterranea',
  'vegana',       'vegetariana', 'fusion',      'asiatica',    'panaderia',
  'heladeria',    'pizzeria',
]

// Comunas/zonas de Santiago (RM + algunas con turismo)
const ZONES = [
  'Providencia',     'Las Condes',       'Vitacura',         'Ñuñoa',
  'Santiago Centro', 'Lastarria',        'Bellavista',       'Barrio Italia',
  'Recoleta',        'San Miguel',       'La Florida',       'Maipú',
  'Puente Alto',     'Macul',            'Peñalolén',        'La Reina',
  'Lo Barnechea',    'Independencia',    'Pudahuel',         'Cerrillos',
  'Estación Central','Quilicura',        'Renca',            'Conchalí',
  'San Bernardo',    'San Joaquín',      'La Cisterna',      'El Bosque',
  'Pedro Aguirre Cerda', 'Huechuraba',
]

interface PlannedCall {
  zone: string
  cuisine: string | null   // null = "restaurantes en {zone}, Chile" sin filtro
}

function buildPlan(): PlannedCall[] {
  const out: PlannedCall[] = []
  // Tipo 1 — cada zona × cada cuisine (cobertura amplia)
  for (const z of ZONES) {
    for (const c of CUISINES) {
      out.push({ zone: z, cuisine: c })
    }
  }
  // Tipo 2 — zona genérica (sin cuisine), por si Google da resultados
  //          que no cazaron en ningún cuisine específica
  for (const z of ZONES) {
    out.push({ zone: z, cuisine: null })
  }
  return out
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function callEnrich(siteUrl: string, zone: string, cuisine: string | null) {
  try {
    const res = await fetch(`${siteUrl}/api/enrich-zone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': siteUrl,
      },
      body: JSON.stringify({
        zone,
        cuisine_type:   cuisine,
        query_original: cuisine ? `${cuisine} en ${zone}` : `restaurantes en ${zone}`,
      }),
    })
    const data = await res.json()
    return { ok: res.ok, ...data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function callExtractMenu(siteUrl: string, adminSecret: string, restaurantId: string) {
  try {
    const res = await fetch(`${siteUrl}/api/extract-menu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify({ restaurant_id: restaurantId }),
    })
    return { ok: res.ok, body: await res.text() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await loadEnv()

  const apply = process.argv.includes('--apply')
  const extractMenus = process.argv.includes('--extract-menus')
  const limitIdx = process.argv.indexOf('--limit')
  const limit = limitIdx > 0 ? parseInt(process.argv[limitIdx + 1] ?? '0', 10) : 0
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const adminSecret = process.env.ADMIN_SECRET ?? ''

  const plan = buildPlan()
  const sliced = limit > 0 ? plan.slice(0, limit) : plan

  console.log(`Plan: ${plan.length} combinaciones (${CUISINES.length} cuisines × ${ZONES.length} zonas + ${ZONES.length} genéricas)`)
  console.log(`Ejecutando: ${sliced.length}`)
  console.log(`Costo máximo teórico (sin dedupe): $${(sliced.length * 0.032).toFixed(2)} (Text Search Pro)`)
  console.log(`  Dedupe 30d evita re-trabajo. Budget mensual lo corta automático.`)

  if (!apply) {
    console.log('\nMuestra de las primeras 10 llamadas:')
    for (const p of sliced.slice(0, 10)) {
      console.log(`  - ${p.cuisine ?? '(any)'} en ${p.zone}`)
    }
    console.log('\nCorre con --apply para ejecutar.')
    return
  }

  if (!adminSecret && extractMenus) {
    console.error('❌ ADMIN_SECRET no configurada — --extract-menus requiere auth.')
    process.exit(1)
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let okCount = 0, skippedCount = 0, failedCount = 0
  let totalInserted = 0
  let costAccumUsd = 0
  const newRestaurantIds = new Set<string>()
  // Snapshot inicial de IDs para detectar inserciones de esta corrida.
  const { data: preExisting } = await sb.from('restaurants').select('id').eq('data_source', 'agent_enriched')
  const preIds = new Set((preExisting ?? []).map(r => r.id))

  console.log('\nEjecutando enrichment...')
  for (let i = 0; i < sliced.length; i++) {
    const p = sliced[i]
    const r = await callEnrich(siteUrl, p.zone, p.cuisine)
    if (r.ok && r.skipped) {
      skippedCount++
    } else if (r.ok && (r.inserted ?? 0) > 0) {
      okCount++
      totalInserted += r.inserted
      costAccumUsd += r.cost_usd ?? 0
    } else if (r.ok) {
      okCount++  // se intentó pero no encontró nada nuevo
      costAccumUsd += r.cost_usd ?? 0
    } else {
      failedCount++
    }
    if ((i + 1) % 20 === 0 || i === sliced.length - 1) {
      process.stdout.write(`\r  ${i + 1}/${sliced.length}  ` +
        `(${okCount} ok / ${skippedCount} skip / ${failedCount} fail)  ` +
        `+${totalInserted} restaurants  $${costAccumUsd.toFixed(2)} gastados`)
    }
    // pausa breve para no saturar Supabase ni Google
    await new Promise(r => setTimeout(r, 250))
  }
  console.log('\n')

  console.log(`✅ Enrichment terminado.`)
  console.log(`  Calls ok:     ${okCount}`)
  console.log(`  Skipped:      ${skippedCount}`)
  console.log(`  Failed:       ${failedCount}`)
  console.log(`  Nuevos:       ${totalInserted}`)
  console.log(`  Costo total:  $${costAccumUsd.toFixed(2)}`)

  if (!extractMenus) {
    console.log('\n(Skip --extract-menus para correr extract-menu por separado)')
    return
  }

  // Detectar restaurants nuevos de esta corrida
  const { data: postExisting } = await sb.from('restaurants').select('id, config_chapi')
    .eq('data_source', 'agent_enriched')
  const newOnes = (postExisting ?? []).filter(r => !preIds.has(r.id))

  // Filtrar a los que tienen website disponible (no tiene sentido extract si no)
  const withWebsite = newOnes.filter(r => {
    const cfg = (r.config_chapi ?? {}) as Record<string, unknown>
    return typeof cfg.website === 'string' && (cfg.website as string).startsWith('http')
  })

  console.log(`\n${newOnes.length} restaurants nuevos · ${withWebsite.length} con website (extract candidate)`)
  if (withWebsite.length === 0) {
    console.log('Sin website nuevos para extraer. Done.')
    return
  }

  let exOk = 0, exSkip = 0, exFail = 0
  for (let i = 0; i < withWebsite.length; i++) {
    const r = await callExtractMenu(siteUrl, adminSecret, withWebsite[i].id)
    if (r.ok) {
      // body contiene { ok, inserted, ... } o { skipped, reason }
      try {
        const j = JSON.parse(r.body)
        if (j.skipped) exSkip++
        else exOk++
      } catch { exOk++ }
    } else {
      exFail++
    }
    if ((i + 1) % 10 === 0 || i === withWebsite.length - 1) {
      process.stdout.write(`\r  Extract ${i + 1}/${withWebsite.length}  ` +
        `(${exOk} ok / ${exSkip} skip / ${exFail} fail)`)
    }
    await new Promise(r => setTimeout(r, 200))
  }
  console.log('\n')
  console.log(`✅ Extract-menu terminado: ${exOk} ok / ${exSkip} skip / ${exFail} fail`)
}

main().catch(e => { console.error(e); process.exit(1) })
