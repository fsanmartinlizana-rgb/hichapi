/**
 * POST /api/enrich-zone
 *
 * Agente de enriquecimiento geográfico. Cuando Chapi devuelve
 * `no_results_in_zone:true`, el frontend dispara este endpoint para que
 * Google Places (New) Text Search complete la base de datos en background.
 *
 * Costos (Google Places Pro tier):
 *  - Text Search con reviews: $0.032 por call
 *  - Photo descargada:        $0.007 por foto
 *
 * Defensa de costos (3 capas):
 *  1. Budget mensual hard cap (env GOOGLE_PLACES_MONTHLY_BUDGET_USD, def 50)
 *  2. Dedupe 30 días por zone_key+cuisine (tabla enrichment_log)
 *  3. Dedupe 5 min por job 'running' (anti-concurrencia, enrichment_jobs)
 *
 * Override del owner: cualquier UPDATE de photo_url incluye guard
 * `WHERE photo_source IS DISTINCT FROM 'owner_upload'`. Si el dueño subió
 * su foto, el agente NUNCA la toca.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveZone } from '@/lib/landmarks'
import { canonicalCuisine, CUISINE_RESTAURANT_KEYWORDS } from '@/lib/discovery'

export const runtime  = 'nodejs'
export const maxDuration = 60

// ── Constantes de costo ────────────────────────────────────────────────────
const COST_TEXT_SEARCH_USD = 0.032
const COST_PHOTO_USD       = 0.007
const DEFAULT_MONTHLY_BUDGET_USD = 50
const DEDUPE_DAYS = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const RequestSchema = z.object({
  zone:           z.string().min(2).max(80),
  query_original: z.string().max(500).optional(),
  lat:            z.number().nullable().optional(),
  lng:            z.number().nullable().optional(),
  cuisine_type:   z.string().max(50).nullable().optional(),
})

// ── Helpers ────────────────────────────────────────────────────────────────

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function toSlug(name: string): string {
  return stripAccents(name)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

/** Distancia en metros entre dos coords (haversine). Dedupe geo in-memory. */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Clave de dedupe de enrichment_log. Prioriza el slug del texto de la zona
 *  (que es como el user típicamente busca) y solo cae a geo si no hay zone
 *  resoluble. Esto se alinea con el flujo real de búsqueda. */
function zoneKeyFor(zone: string, lat?: number | null, lng?: number | null): string {
  const slug = stripAccents(zone).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60)
  if (slug) return slug
  if (lat != null && lng != null) {
    return `geo:${lat.toFixed(3)}_${lng.toFixed(3)}`
  }
  return 'unknown'
}

// ── Google Places types ────────────────────────────────────────────────────

type GLocalizedText = { text: string; languageCode?: string }

interface GReview {
  rating?:        number
  text?:          GLocalizedText
  originalText?:  GLocalizedText
  publishTime?:   string
  authorAttribution?: { displayName?: string }
}

interface GPhotoAuthorAttribution {
  displayName?: string
  uri?:         string
  photoUri?:    string
}

interface GPhoto {
  name?:                string  // ej "places/ChIJ.../photos/AeJ..."
  widthPx?:             number
  heightPx?:            number
  authorAttributions?:  GPhotoAuthorAttribution[]
}

interface GPlace {
  displayName?:           GLocalizedText
  formattedAddress?:      string
  location?:              { latitude: number; longitude: number }
  types?:                 string[]
  priceLevel?:            string
  regularOpeningHours?:   { weekdayDescriptions?: string[]; periods?: unknown[] }
  primaryTypeDisplayName?: GLocalizedText
  rating?:                number
  userRatingCount?:       number
  reviews?:               GReview[]
  photos?:                GPhoto[]
  websiteUri?:            string
  nationalPhoneNumber?:   string
}

// ── Mapeos ────────────────────────────────────────────────────────────────

function mapPriceLevel(p?: string): 'economico' | 'medio' | 'premium' {
  switch (p) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 'economico'
    case 'PRICE_LEVEL_EXPENSIVE':
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 'premium'
    default:
      return 'medio'
  }
}

function inferCuisine(place: GPlace): string {
  const haystack = stripAccents(
    [
      ...(place.types ?? []),
      place.primaryTypeDisplayName?.text ?? '',
      place.displayName?.text ?? '',
    ].join(' '),
  )
  const TYPE_MAP: [string, string][] = [
    ['sushi_restaurant', 'japonesa'], ['japanese_restaurant', 'japonesa'],
    ['italian_restaurant', 'italiana'], ['pizza_restaurant', 'italiana'],
    ['mexican_restaurant', 'mexicana'], ['indian_restaurant', 'india'],
    ['chinese_restaurant', 'china'], ['korean_restaurant', 'coreana'],
    ['vietnamese_restaurant', 'vietnamita'], ['thai_restaurant', 'tailandesa'],
    ['middle_eastern_restaurant', 'arabe'], ['lebanese_restaurant', 'arabe'],
    ['turkish_restaurant', 'arabe'], ['american_restaurant', 'americana'],
    ['mediterranean_restaurant', 'mediterranea'], ['greek_restaurant', 'griega'],
    ['spanish_restaurant', 'espanola'], ['french_restaurant', 'francesa'],
    ['seafood_restaurant', 'mariscos'], ['vegan_restaurant', 'vegana'],
    ['vegetarian_restaurant', 'vegetariana'], ['hamburger_restaurant', 'hamburgueseria'],
    ['fast_food_restaurant', 'hamburgueseria'], ['steak_house', 'parrilla'],
    ['ice_cream_shop', 'heladeria'], ['coffee_shop', 'cafeteria'],
    ['bakery', 'panaderia'], ['cafe', 'cafeteria'],
    ['sandwich_shop', 'sandwicheria'], ['pub', 'cerveceria'],
    ['brewery', 'cerveceria'], ['wine_bar', 'cerveceria'], ['bar', 'cerveceria'],
  ]
  for (const t of place.types ?? []) {
    const tNorm = t.toLowerCase()
    const hit = TYPE_MAP.find(([k]) => tNorm === k)
    if (hit) return hit[1]
  }
  const KW: [string, string][] = [
    ['sushi', 'japonesa'], ['ramen', 'japonesa'],
    ['pizza', 'italiana'], ['pasta', 'italiana'], ['italian', 'italiana'],
    ['ceviche', 'peruana'], ['cebich', 'peruana'], ['peruvian', 'peruana'], ['nikkei', 'peruana'],
    ['taco', 'mexicana'], ['mexican', 'mexicana'],
    ['hambur', 'hamburgueseria'], ['burger', 'hamburgueseria'],
    ['thai', 'tailandesa'],
    ['parrilla', 'parrilla'], ['steak', 'parrilla'], ['churrasq', 'parrilla'],
    ['marisc', 'mariscos'], ['pescad', 'mariscos'], ['seafood', 'mariscos'],
    ['kebab', 'arabe'], ['shawarma', 'arabe'], ['falafel', 'arabe'],
    ['curry', 'india'], ['tandoor', 'india'],
    ['indian', 'india'], ['chinese', 'china'], ['chifa', 'china'],
    ['vegan', 'vegana'], ['vegetar', 'vegetariana'],
    ['cafe', 'cafeteria'], ['brunch', 'cafeteria'], ['coffee', 'cafeteria'],
    ['ice_cream', 'heladeria'], ['helader', 'heladeria'], ['gelato', 'heladeria'],
    ['bakery', 'panaderia'], ['panader', 'panaderia'],
    ['sandwich', 'sandwicheria'],
    ['chilean', 'chilena'], ['chilen', 'chilena'], ['picada', 'chilena'], ['patagon', 'chilena'],
    ['american', 'americana'],
    ['argentin', 'argentina'], ['venezuelan', 'venezolana'], ['arepa', 'venezolana'],
    ['colombian', 'colombiana'], ['mediterran', 'mediterranea'],
    ['greek', 'griega'], ['spanish', 'espanola'], ['paella', 'espanola'],
    ['french', 'francesa'], ['asian', 'asiatica'],
    ['brewery', 'cerveceria'], ['pub', 'cerveceria'],
  ]
  for (const [k, v] of KW) {
    if (haystack.includes(k)) return v
  }
  return 'internacional'
}

function pickReviews(reviews?: GReview[]): unknown[] {
  if (!reviews || reviews.length === 0) return []
  return reviews.slice(0, 3).map(r => ({
    author: r.authorAttribution?.displayName ?? 'Anónimo',
    rating: r.rating ?? null,
    text:   (r.originalText ?? r.text)?.text ?? '',
    time:   r.publishTime ?? null,
  }))
}

// ── Budget mensual (single source of truth = SUM(enrichment_log)) ──────────

async function getMonthlySpendUSD(): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)
  const { data } = await supabase
    .from('enrichment_log')
    .select('cost_usd')
    .gte('last_enriched_at', startOfMonth.toISOString())
  if (!data) return 0
  return (data as { cost_usd: number | string }[])
    .reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
}

function getBudgetUSD(): number {
  const env = process.env.GOOGLE_PLACES_MONTHLY_BUDGET_USD
  const n = env ? Number(env) : NaN
  return Number.isFinite(n) ? n : DEFAULT_MONTHLY_BUDGET_USD
}

// ── Descarga de foto de Google Places y subida a Supabase Storage ──────────

async function downloadAndStorePhoto(
  photoName: string,
  restaurantSlug: string,
): Promise<string | null> {
  try {
    const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${process.env.GOOGLE_PLACES_API_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'follow' })
    if (!res.ok) {
      console.warn(`Photo download failed (${res.status}) for ${restaurantSlug}`)
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0) return null

    const path = `agent-enriched/${restaurantSlug}-${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage
      .from('restaurant-photos')
      .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
    if (upErr) {
      console.error('Photo upload failed:', upErr)
      return null
    }
    const { data: urlData } = supabase.storage.from('restaurant-photos').getPublicUrl(path)
    return urlData.publicUrl
  } catch (err) {
    console.warn('Photo fetch threw:', err instanceof Error ? err.message : err)
    return null
  }
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Same-origin guard (no es endpoint público).
  const origin    = req.headers.get('origin')  ?? ''
  const referer   = req.headers.get('referer') ?? ''
  const reqHost   = req.headers.get('host')    ?? ''
  const reqOrigin = `${req.nextUrl.protocol}//${reqHost}`
  const siteUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const isOwn =
    origin === '' ||
    (siteUrl   && (origin.startsWith(siteUrl)   || referer.startsWith(siteUrl))) ||
    (reqOrigin && (origin.startsWith(reqOrigin) || referer.startsWith(reqOrigin)))
  if (!isOwn) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: 'GOOGLE_PLACES_API_KEY no configurada' },
      { status: 500 },
    )
  }

  let parsed: z.infer<typeof RequestSchema>
  try {
    parsed = RequestSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const zone = resolveZone(parsed.zone) ?? parsed.zone
  const cuisineLabel = parsed.cuisine_type?.trim() ?? null
  const textQuery = cuisineLabel
    ? `${cuisineLabel} en ${zone}, Chile`
    : `restaurantes en ${zone}, Chile`
  const zKey = zoneKeyFor(zone, parsed.lat, parsed.lng)

  // ── 1. Budget mensual (single source of truth = SUM enrichment_log) ─────
  const spend = await getMonthlySpendUSD()
  const budget = getBudgetUSD()
  if (spend >= budget) {
    console.warn(`[enrich-zone] Monthly budget exceeded: $${spend.toFixed(2)} / $${budget.toFixed(2)}`)
    return NextResponse.json({
      skipped:  true,
      reason:   'monthly_budget_exceeded',
      inserted: 0,
      spend_usd: Number(spend.toFixed(4)),
      budget_usd: budget,
    })
  }

  // ── 2. Dedupe 30 días por zone_key + cuisine (enrichment_log) ──────────
  const dedupeSince = new Date(Date.now() - DEDUPE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const cuisineFilter = canonicalCuisine(cuisineLabel)
  const { data: recentLog } = await supabase
    .from('enrichment_log')
    .select('id, last_enriched_at, results_count')
    .eq('zone_key', zKey)
    .eq('cuisine', cuisineFilter ?? '')  // empty string para "no cuisine"
    .gte('last_enriched_at', dedupeSince)
    .gt('results_count', 0)
    .order('last_enriched_at', { ascending: false })
    .limit(1)

  if (recentLog && recentLog.length > 0) {
    return NextResponse.json({
      skipped:  true,
      reason:   `cap_${DEDUPE_DAYS}d`,
      inserted: 0,
      last_enriched_at: recentLog[0].last_enriched_at,
    })
  }

  // ── 3. Dedupe 5 min anti-concurrencia (enrichment_jobs running) ────────
  const concurrentSince = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: concurrent } = await supabase
    .from('enrichment_jobs')
    .select('id')
    .eq('zone', zone)
    .eq('query_original', textQuery)
    .eq('status', 'running')
    .gte('created_at', concurrentSince)
    .limit(1)
  if (concurrent && concurrent.length > 0) {
    return NextResponse.json({ skipped: true, reason: 'running', inserted: 0 })
  }

  // ── 4. Crear el job (status='running') ─────────────────────────────────
  const { data: job, error: jobErr } = await supabase
    .from('enrichment_jobs')
    .insert({ zone, query_original: textQuery, status: 'running' })
    .select('id')
    .single()

  if (jobErr || !job) {
    console.error('enrichment_jobs insert error:', jobErr)
    return NextResponse.json({ error: 'No se pudo crear el job' }, { status: 500 })
  }

  // Tracking de costo para esta corrida (alimenta enrichment_log al cierre).
  let textSearchCount = 0
  let photoCount      = 0
  let resultsCount    = 0

  async function finishJob(
    status: 'done' | 'failed' | 'skipped',
    found:  number,
    inserted: number,
    error?: string,
  ) {
    await supabase
      .from('enrichment_jobs')
      .update({
        status,
        restaurants_found:    found,
        restaurants_inserted: inserted,
        error:                error ?? null,
        completed_at:         new Date().toISOString(),
      })
      .eq('id', job!.id)
  }

  async function logEnrichment(rCount: number) {
    const cost = textSearchCount * COST_TEXT_SEARCH_USD + photoCount * COST_PHOTO_USD
    await supabase.from('enrichment_log').insert({
      zone_key:           zKey,
      cuisine:            cuisineFilter ?? '',
      results_count:      rCount,
      cost_usd:           cost,
      text_search_count:  textSearchCount,
      photo_count:        photoCount,
      enrichment_job_id:  job!.id,
    })
  }

  try {
    // ── 5. Llamar Google Places Text Search ────────────────────────────
    const fieldMask = [
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.types',
      'places.priceLevel',
      'places.regularOpeningHours',
      'places.primaryTypeDisplayName',
      'places.rating',
      'places.userRatingCount',
      'places.reviews',
      'places.photos.name',
      'places.photos.authorAttributions',
      'places.websiteUri',
      'places.nationalPhoneNumber',
    ].join(',')

    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'X-Goog-Api-Key':     process.env.GOOGLE_PLACES_API_KEY!,
        'X-Goog-FieldMask':   fieldMask,
      },
      body: JSON.stringify({ textQuery, languageCode: 'es' }),
      signal: AbortSignal.timeout(25_000),
    })

    textSearchCount = 1  // contamos el call independiente del resultado

    if (!placesRes.ok) {
      const detail = await placesRes.text().catch(() => '')
      await finishJob('failed', 0, 0, `Google Places ${placesRes.status}: ${detail.slice(0, 200)}`)
      await logEnrichment(0)
      return NextResponse.json({ error: 'Google Places error', inserted: 0 }, { status: 200 })
    }

    const placesData = (await placesRes.json()) as { places?: GPlace[] }
    const places     = placesData.places ?? []
    if (places.length === 0) {
      await finishJob('done', 0, 0)
      await logEnrichment(0)
      return NextResponse.json({ inserted: 0, found: 0 })
    }

    // ── 6. Cargar existentes para dedupe geo/slug ──────────────────────
    const { data: existing } = await supabase
      .from('restaurants')
      .select('id, name, slug, lat, lng')
      .eq('active', true)
    const existingSlugs = new Set((existing ?? []).map(r => r.slug))
    const existingByLoc = (existing ?? []).filter(
      r => r.lat != null && r.lng != null,
    ) as { id: string; name: string; lat: number; lng: number }[]

    // ── 7. Mapear Google → rows + decidir cuáles insertar ──────────────
    type Row = {
      name: string; slug: string; address: string | null; neighborhood: string
      lat: number; lng: number; cuisine_type: string
      price_range: 'economico' | 'medio' | 'premium'
      rating: number; review_count: number
      active: boolean; plan: 'free'; photo_url: null
      claimed: false; verified: false; data_source: 'agent_enriched'
      google_rating: number | null; google_rating_count: number | null
      google_reviews: unknown[]
      config_chapi: Record<string, unknown>
      // Pre-tracked para evitar segundo round-trip a Google después del insert
      _photoName?: string | null
      _photoAttribution?: GPhotoAuthorAttribution[] | null
    }

    const requestedCanon    = canonicalCuisine(cuisineLabel)
    const requestedKeywords = requestedCanon
      ? CUISINE_RESTAURANT_KEYWORDS[requestedCanon] ?? [requestedCanon]
      : null

    const FOOD_TYPES = new Set([
      'restaurant', 'food', 'cafe', 'bar', 'bakery', 'meal_takeaway',
      'meal_delivery', 'sandwich_shop', 'pizza_restaurant', 'sushi_restaurant',
      'italian_restaurant', 'japanese_restaurant', 'mexican_restaurant',
      'chinese_restaurant', 'indian_restaurant', 'french_restaurant',
      'thai_restaurant', 'korean_restaurant', 'vietnamese_restaurant',
      'spanish_restaurant', 'american_restaurant', 'seafood_restaurant',
      'steak_house', 'hamburger_restaurant', 'vegan_restaurant',
      'vegetarian_restaurant', 'middle_eastern_restaurant', 'greek_restaurant',
      'turkish_restaurant', 'lebanese_restaurant', 'mediterranean_restaurant',
      'fast_food_restaurant', 'ice_cream_shop', 'coffee_shop', 'pub',
      'wine_bar', 'brewery', 'bistro', 'breakfast_restaurant',
      'brunch_restaurant', 'fine_dining_restaurant',
    ])

    const toInsert: Row[] = []
    const usedSlugs = new Set(existingSlugs)

    for (const p of places) {
      const name = p.displayName?.text?.trim()
      const lat  = p.location?.latitude
      const lng  = p.location?.longitude
      if (!name || lat == null || lng == null) continue

      const types = p.types ?? []
      if (!types.some(t => FOOD_TYPES.has(t))) continue

      if (requestedKeywords && requestedKeywords.length > 0) {
        const haystack = stripAccents([
          ...types,
          p.primaryTypeDisplayName?.text ?? '',
          p.displayName?.text ?? '',
        ].join(' '))
        if (!requestedKeywords.some(k => haystack.includes(k))) continue
      }

      if (existingByLoc.some(r => haversineMeters(r.lat, r.lng, lat, lng) < 50)) continue

      let slug = toSlug(name) || `place-${toInsert.length}`
      if (usedSlugs.has(slug)) {
        let n = 2
        while (usedSlugs.has(`${slug}-${n}`)) n++
        slug = `${slug}-${n}`
      }
      usedSlugs.add(slug)

      const primaryPhoto = p.photos?.[0]
      toInsert.push({
        name, slug,
        address:             p.formattedAddress ?? null,
        neighborhood:        zone,
        lat, lng,
        cuisine_type:        inferCuisine(p),
        price_range:         mapPriceLevel(p.priceLevel),
        rating:              0,
        review_count:        0,
        active:              true,
        plan:                'free',
        photo_url:           null,
        claimed:             false,
        verified:            false,
        data_source:         'agent_enriched',
        google_rating:       p.rating ?? null,
        google_rating_count: p.userRatingCount ?? null,
        google_reviews:      pickReviews(p.reviews),
        config_chapi: {
          horarios:    p.regularOpeningHours?.weekdayDescriptions ?? null,
          tipo_local:  p.primaryTypeDisplayName?.text ?? null,
          types,
          website:     p.websiteUri ?? null,
          phone:       p.nationalPhoneNumber ?? null,
          // menu_extracted: false significa que el endpoint extract-menu
          // todavía no procesó este restaurant. El cron / botón admin lo
          // dispara para sacar platos reales del website con Claude.
          menu_extracted: false,
        },
        _photoName:        primaryPhoto?.name ?? null,
        _photoAttribution: primaryPhoto?.authorAttributions ?? null,
      })
    }

    if (toInsert.length === 0) {
      await finishJob('done', places.length, 0)
      await logEnrichment(0)
      return NextResponse.json({ inserted: 0, found: places.length })
    }

    // ── 8. Insert en bulk (sin las props internas _photo*) ─────────────
    type InsertRow = Omit<Row, '_photoName' | '_photoAttribution'>
    const insertRows: InsertRow[] = toInsert.map(({ _photoName, _photoAttribution, ...rest }) => rest)
    const { data: inserted, error: insertErr } = await supabase
      .from('restaurants')
      .insert(insertRows)
      .select('id, slug')

    if (insertErr) {
      await finishJob('failed', places.length, 0, `Insert: ${insertErr.message}`)
      await logEnrichment(0)
      return NextResponse.json({ error: insertErr.message, inserted: 0 }, { status: 200 })
    }
    resultsCount = inserted?.length ?? 0

    // ── 9. NO insertamos placeholder "Plato del día" ─────────────────
    // Antes: insertábamos un item fake. Era deshonesto (precio inventado
    // $9.900, sin tags reales) y bloqueaba el filtro dietary del chat
    // (siempre matcheaba nada). Ahora la card muestra "Carta aún no
    // disponible" cuando menu_items=0, y el cron de extract-menu va a
    // poblar platos reales scrapeando el website (si existe).

    // ── 10. Descargar foto principal por cada insertado ────────────────
    // Hacemos en paralelo con concurrencia limitada para no saturar.
    type Insertion = { id: string; slug: string }
    const insertedRows = (inserted ?? []) as Insertion[]
    const bySlug = new Map<string, typeof toInsert[number]>()
    for (const r of toInsert) bySlug.set(r.slug, r)

    const PHOTO_CONCURRENCY = 3
    for (let i = 0; i < insertedRows.length; i += PHOTO_CONCURRENCY) {
      const batch = insertedRows.slice(i, i + PHOTO_CONCURRENCY)
      await Promise.all(batch.map(async ins => {
        const row = bySlug.get(ins.slug)
        if (!row?._photoName) {
          // No hay foto disponible en Google → marcar attempted=true, source='placeholder'
          await supabase.from('restaurants').update({
            photo_fetch_attempted: true,
            photo_source:          'placeholder',
          })
          .eq('id', ins.id)
          // Guard: nunca pisar al owner — esta row recién creada no puede ser
          // owner_upload, pero por consistencia con el resto del flow:
          .neq('photo_source', 'owner_upload')
          return
        }
        const publicUrl = await downloadAndStorePhoto(row._photoName, ins.slug)
        photoCount++  // contamos call incluso si falla — Google nos cobra igual
        if (publicUrl) {
          await supabase.from('restaurants').update({
            photo_url:                publicUrl,
            photo_source:             'google_places',
            photo_fetched_at:         new Date().toISOString(),
            photo_fetch_attempted:    true,
            google_photo_attribution: row._photoAttribution ?? null,
          })
          .eq('id', ins.id)
          .neq('photo_source', 'owner_upload')  // owner override guard
        } else {
          await supabase.from('restaurants').update({
            photo_fetch_attempted: true,
            photo_source:          'placeholder',
          })
          .eq('id', ins.id)
          .neq('photo_source', 'owner_upload')
        }
      }))
    }

    // ── 11. Cerrar job + log de costo ──────────────────────────────────
    await finishJob('done', places.length, resultsCount)
    await logEnrichment(resultsCount)

    const totalCost = textSearchCount * COST_TEXT_SEARCH_USD + photoCount * COST_PHOTO_USD
    return NextResponse.json({
      inserted:  resultsCount,
      found:     places.length,
      cost_usd:  Number(totalCost.toFixed(4)),
      photos_downloaded: photoCount,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    await finishJob('failed', 0, 0, msg.slice(0, 500))
    await logEnrichment(0)
    console.error('enrich-zone error:', err)
    return NextResponse.json({ error: msg, inserted: 0 }, { status: 200 })
  }
}
