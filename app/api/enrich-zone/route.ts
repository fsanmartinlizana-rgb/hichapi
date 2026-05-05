/**
 * POST /api/enrich-zone
 *
 * Agente de enriquecimiento geográfico. Cuando Chapi devuelve
 * `no_results_in_zone:true`, el frontend dispara este endpoint para que
 * Google Places (New) Text Search complete la base de datos en background.
 *
 * Costo por llamada (Text Search Pro con reviews): ≈ USD $0.032.
 * Dedupe por zona en 24h evita disparos duplicados.
 *
 * No bloquea la respuesta del chat — el frontend lo dispara y luego reintenta
 * la búsqueda cuando este endpoint reporta `inserted > 0`.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveZone } from '@/lib/landmarks'

export const runtime  = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const RequestSchema = z.object({
  zone:           z.string().min(2).max(80),
  query_original: z.string().max(500).optional(),
  lat:            z.number().nullable().optional(),
  lng:            z.number().nullable().optional(),
})

// ── Helpers ────────────────────────────────────────────────────────────────────

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

/** Distancia en metros entre dos coords (haversine). Usado para dedupe geo
 *  in-memory: evita 1 RPC por candidato. */
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

// ── Google Places types (parcial — solo lo que pedimos en FieldMask) ─────────

type GLocalizedText = { text: string; languageCode?: string }

interface GReview {
  rating?:        number
  text?:          GLocalizedText
  originalText?:  GLocalizedText
  publishTime?:   string
  authorAttribution?: { displayName?: string }
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
}

// ── Mapeos ────────────────────────────────────────────────────────────────────

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

/** Infiere cuisine_type canónico desde types[] + primaryTypeDisplayName. Usa
 *  los mismos buckets que el chat para que el filtro post-enrichment matchee. */
function inferCuisine(place: GPlace): string {
  const haystack = stripAccents(
    [
      ...(place.types ?? []),
      place.primaryTypeDisplayName?.text ?? '',
    ].join(' '),
  )
  const m: [string, string][] = [
    ['sushi',          'japonesa'],
    ['ramen',          'japonesa'],
    ['japan',          'japonesa'],
    ['italian',        'italiana'],
    ['pizza',          'italiana'],
    ['pasta',          'italiana'],
    ['peruvian',       'peruana'],
    ['ceviche',        'peruana'],
    ['mexican',        'mexicana'],
    ['taco',           'mexicana'],
    ['vegan',          'vegana'],
    ['vegetar',        'vegetariana'],
    ['burger',         'hamburgueseria'],
    ['hambur',         'hamburgueseria'],
    ['thai',           'tailandesa'],
    ['parrilla',       'parrilla'],
    ['steak',          'parrilla'],
    ['seafood',        'mariscos'],
    ['marisc',         'mariscos'],
    ['cafe',           'cafeteria'],
    ['bakery',         'panaderia'],
    ['ice_cream',      'heladeria'],
    ['chilean',        'chilena'],
  ]
  for (const [k, v] of m) {
    if (haystack.includes(k)) return v
  }
  // Si nada matchea, valor canónico 'internacional'. Evita guardar literales
  // como "Restaurante" del primaryTypeDisplayName que después no matchean
  // con ningún filtro de cuisine en /api/chat.
  return 'internacional'
}

/** Extrae max 3 reviews con el shape del brief: { author, rating, text, time }.
 *  Usa originalText (idioma original) sobre text (puede venir traducido). */
function pickReviews(reviews?: GReview[]): unknown[] {
  if (!reviews || reviews.length === 0) return []
  return reviews.slice(0, 3).map(r => ({
    author: r.authorAttribution?.displayName ?? 'Anónimo',
    rating: r.rating ?? null,
    text:   (r.originalText ?? r.text)?.text ?? '',
    time:   r.publishTime ?? null,
  }))
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Same-origin guard (no es endpoint público). Aceptamos:
  //   - Origin/referer matching NEXT_PUBLIC_SITE_URL (prod)
  //   - Origin/referer matching el host del request (preview/staging/dev)
  //   - Origin vacío (server-side fetch)
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

  // ── 1. Dedupe inteligente:
  // (a) bloquear si hay un job 'running' creado hace menos de 5 min (concurrencia)
  // (b) bloquear si hay un job 'done' exitoso (>0 inserts) en las últimas 24h
  // Casos NO bloqueantes:
  //   - 'failed' / 'skipped' previos → permitir reintento
  //   - 'done' con 0 inserts → permitir reintento (Google quizás ahora sí, o
  //     la zona se cubrió desde otra entrada)
  //   - 'running' viejo (>5 min) → asumir muerto por timeout, permitir reintento
  const concurrentSince = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: concurrent } = await supabase
    .from('enrichment_jobs')
    .select('id')
    .eq('zone', zone)
    .eq('status', 'running')
    .gte('created_at', concurrentSince)
    .limit(1)

  if (concurrent && concurrent.length > 0) {
    return NextResponse.json({ skipped: true, reason: 'running', inserted: 0 })
  }

  const recentSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentSuccess } = await supabase
    .from('enrichment_jobs')
    .select('id, restaurants_inserted')
    .eq('zone', zone)
    .eq('status', 'done')
    .gt('restaurants_inserted', 0)
    .gte('created_at', recentSince)
    .limit(1)

  if (recentSuccess && recentSuccess.length > 0) {
    return NextResponse.json({
      skipped:  true,
      reason:   'recent_success',
      inserted: 0,
    })
  }

  // ── 2. Insertar job con status='running' ─────────────────────────────────
  const { data: job, error: jobErr } = await supabase
    .from('enrichment_jobs')
    .insert({
      zone,
      query_original: parsed.query_original ?? null,
      status:         'running',
    })
    .select('id')
    .single()

  if (jobErr || !job) {
    console.error('enrichment_jobs insert error:', jobErr)
    return NextResponse.json({ error: 'No se pudo crear el job' }, { status: 500 })
  }

  // Helper para cerrar el job en cualquier salida.
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

  try {
    // ── 3. Llamar Google Places New Text Search ───────────────────────────
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
    ].join(',')

    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'X-Goog-Api-Key':     process.env.GOOGLE_PLACES_API_KEY!,
        'X-Goog-FieldMask':   fieldMask,
      },
      body: JSON.stringify({
        textQuery:    `restaurantes en ${zone}, Santiago, Chile`,
        languageCode: 'es',
      }),
      signal: AbortSignal.timeout(25_000),
    })

    if (!placesRes.ok) {
      const detail = await placesRes.text().catch(() => '')
      await finishJob('failed', 0, 0, `Google Places ${placesRes.status}: ${detail.slice(0, 200)}`)
      return NextResponse.json({ error: 'Google Places error', inserted: 0 }, { status: 200 })
    }

    const placesData = (await placesRes.json()) as { places?: GPlace[] }
    const places     = placesData.places ?? []

    if (places.length === 0) {
      await finishJob('done', 0, 0)
      return NextResponse.json({ inserted: 0, found: 0 })
    }

    // ── 4. Cargar existentes para dedupe (slug + lat/lng + name) ─────────
    const { data: existing } = await supabase
      .from('restaurants')
      .select('id, name, slug, lat, lng')
      .eq('active', true)

    const existingSlugs = new Set((existing ?? []).map(r => r.slug))
    const existingByLoc = (existing ?? []).filter(
      r => r.lat != null && r.lng != null,
    ) as { id: string; name: string; lat: number; lng: number }[]

    // ── 5. Mapear Google → fila de restaurants ───────────────────────────
    type Row = {
      name:                string
      slug:                string
      address:             string | null
      neighborhood:        string
      lat:                 number
      lng:                 number
      cuisine_type:        string
      price_range:         'economico' | 'medio' | 'premium'
      rating:              number
      review_count:        number
      active:              boolean
      plan:                'free'
      photo_url:           null
      claimed:             false
      verified:            false
      data_source:         'agent_enriched'
      google_rating:       number | null
      google_rating_count: number | null
      google_reviews:      unknown[]
      config_chapi:        Record<string, unknown>
    }

    const toInsert: Row[] = []
    let usedSlugs = new Set(existingSlugs)

    for (const p of places) {
      const name = p.displayName?.text?.trim()
      const lat  = p.location?.latitude
      const lng  = p.location?.longitude
      if (!name || lat == null || lng == null) continue

      // Dedupe geo: ¿hay alguno existente a < 50m?
      const tooClose = existingByLoc.some(
        r => haversineMeters(r.lat, r.lng, lat, lng) < 50,
      )
      if (tooClose) continue

      // Dedupe por slug (resolver colisiones agregando sufijo).
      let slug = toSlug(name) || `place-${toInsert.length}`
      if (usedSlugs.has(slug)) {
        let n = 2
        while (usedSlugs.has(`${slug}-${n}`)) n++
        slug = `${slug}-${n}`
      }
      usedSlugs.add(slug)

      toInsert.push({
        name,
        slug,
        address:             p.formattedAddress ?? null,
        neighborhood:        zone,
        lat,
        lng,
        cuisine_type:        inferCuisine(p),
        price_range:         mapPriceLevel(p.priceLevel),
        // El rating propio de HiChapi arranca en 0. NUNCA copiamos el de Google
        // a `rating` porque eso lo presentaría como rating de HiChapi en la
        // ficha. El de Google va en su propio campo con atribución explícita.
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
          horarios:   p.regularOpeningHours?.weekdayDescriptions ?? null,
          tipo_local: p.primaryTypeDisplayName?.text ?? null,
          types:      p.types ?? [],
        },
      })
    }

    if (toInsert.length === 0) {
      await finishJob('done', places.length, 0)
      return NextResponse.json({ inserted: 0, found: places.length })
    }

    // ── 6. Insert en bulk ────────────────────────────────────────────────
    const { data: inserted, error: insertErr } = await supabase
      .from('restaurants')
      .insert(toInsert)
      .select('id, name')

    if (insertErr) {
      await finishJob('failed', places.length, 0, `Insert: ${insertErr.message}`)
      return NextResponse.json(
        { error: insertErr.message, inserted: 0 },
        { status: 200 },
      )
    }

    // ── 7. Plato del día genérico para que el chat pueda surfacearlos ────
    // Sin esto, el filtro de menú en /api/chat los descarta porque
    // `candidateItems.length === 0` corta el restaurant.
    const placeholderItems = (inserted ?? []).map(r => ({
      restaurant_id: r.id,
      name:          'Plato del día',
      description:   'Consultar al restaurante para la carta del día',
      price:         9900,
      category:      'platos principales',
      tags:          ['internacional'],
      available:     true,
    }))

    if (placeholderItems.length > 0) {
      await supabase.from('menu_items').insert(placeholderItems)
    }

    await finishJob('done', places.length, inserted?.length ?? 0)

    return NextResponse.json({
      inserted: inserted?.length ?? 0,
      found:    places.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    await finishJob('failed', 0, 0, msg.slice(0, 500))
    console.error('enrich-zone error:', err)
    return NextResponse.json({ error: msg, inserted: 0 }, { status: 200 })
  }
}
