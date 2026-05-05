import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveZone } from '@/lib/landmarks'
import { queryCache, claudeCache, intentCacheKey, claudeCacheKey } from '@/lib/cache'

// ── Rate limiter (in-memory, per IP, 20 req/min) ───────────────────────────
const rateMap = new Map<string, { count: number; reset: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW = 60_000

let _rateSweepCounter = 0
function checkRate(ip: string): boolean {
  const now = Date.now()
  // Evict expired entries every 200 calls to prevent memory leak
  if (++_rateSweepCounter % 200 === 0) {
    for (const [k, v] of rateMap) { if (now > v.reset) rateMap.delete(k) }
  }
  const entry = rateMap.get(ip)
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RequestSchema = z.object({
  message: z.string().min(1).max(500),
  intent: z
    .object({
      budget_clp: z.number().nullable().optional(),
      zone: z.string().nullable().optional(),
      dietary_restrictions: z.array(z.string()).nullable().optional(),
      cuisine_type: z.string().nullable().optional(),
      user_lat: z.number().nullable().optional(),
      user_lng: z.number().nullable().optional(),
    })
    .optional(),
})

const SYSTEM_PROMPT = `Eres Chapi, el asistente gastronómico de HiChapi.
Tu trabajo es entender qué quiere comer el usuario y encontrar las mejores opciones en Santiago.

REGLAS:
1. Extrae del mensaje actual: presupuesto (en CLP), zona/barrio, restricciones dietéticas, tipo de cocina.
2. "25 lucas" = 25000 CLP, "30 mil" = 30000 CLP.
3. Si el usuario dice "cerca de mí" o similar → needs_location: true.
4. ready_to_search: true si el usuario mencionó CUALQUIER cosa concreta: zona, barrio, tipo de cocina, presupuesto o restricción.
5. Si el mensaje es muy vago ("quiero comer algo rico") → pide UNA cosa concreta (barrio o presupuesto).
6. NO pidas más datos si ya tienes algo con qué buscar. Lanza la búsqueda.
7. Tono: cercano, como un amigo que sabe de comida en Santiago. Máximo 2 oraciones.
8. CAMBIO DE TEMA: Si el usuario pide algo diferente a lo del contexto previo (nueva cocina, nuevo barrio), devuelve SOLO los campos del nuevo pedido y pon null en todo lo demás. No acumules parámetros de búsquedas anteriores. Ejemplo: si antes buscó "italiana" y ahora dice "japonés en Ñuñoa", devuelve cuisine_type:"japonesa", zone:"Ñuñoa", budget_clp:null, dietary_restrictions:[].

RESPONDE SIEMPRE EN ESTE JSON (sin markdown, sin explicación extra):
{
  "message": "respuesta breve para el usuario (máx 2 oraciones)",
  "intent": {
    "budget_clp": número o null,
    "zone": "barrio o zona" o null,
    "dietary_restrictions": ["sin gluten", "vegano"] o [],
    "cuisine_type": "tipo de cocina" o null,
    "user_lat": número o null,
    "user_lng": número o null
  },
  "ready_to_search": true o false,
  "needs_location": true o false
}`

type Intent = {
  budget_clp?: number | null
  zone?: string | null
  dietary_restrictions?: string[] | null
  cuisine_type?: string | null
  user_lat?: number | null
  user_lng?: number | null
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Mapa de cuisine_type canónico → keywords que podemos encontrar en nombres
// de items o categorías. Esto permite que un restaurant con cuisine="Italiana"
// aparezca en búsquedas de "hamburguesas" si tiene hamburguesas en su menú.
const CUISINE_MENU_KEYWORDS: Record<string, string[]> = {
  hamburgueseria: ['hambur', 'burger', 'cheeseburger', 'big mac'],
  japonesa:       ['sushi', 'ramen', 'japon', 'maki', 'nigiri', 'udon'],
  italiana:       ['pizza', 'pasta', 'lasagna', 'ñoqui', 'noqui', 'risotto', 'italian'],
  peruana:        ['ceviche', 'lomo saltado', 'aji de gallina', 'peruan'],
  mexicana:       ['taco', 'burrito', 'quesadilla', 'nacho', 'mexican'],
  chilena:        ['cazuela', 'empanada', 'pastel de choclo', 'chorrillana', 'completo'],
  vegana:         ['vegan', 'plant-based'],
  vegetariana:    ['vegetarian', 'verdura'],
  tailandesa:     ['thai', 'pad thai', 'curry tailand'],
  parrilla:       ['parrilla', 'parrillad', 'asado', 'churrasco', 'bife', 'chorizo'],
  mariscos:       ['marisco', 'pescado', 'salmon', 'congrio', 'locos', 'camaron'],
  cafeteria:      ['cafe', 'desayuno', 'brunch', 'sandwich', 'tostad', 'croissant'],
  panaderia:      ['pan ', 'empanada', 'dulce', 'kuchen'],
  heladeria:      ['helado', 'gelato'],
}

function cuisineMatchesMenu(c: string, menuItems: { name?: string | null; description?: string | null; category?: string | null }[]): boolean {
  const keywords = CUISINE_MENU_KEYWORDS[c] ?? [c.replace(/eria$/, '').replace(/sa$/, 'z')]
  if (keywords.length === 0) return false
  return menuItems.some(item => {
    const hay = stripAccents(`${item.name ?? ''} ${item.description ?? ''} ${item.category ?? ''}`)
    return keywords.some(k => hay.includes(k))
  })
}

type FetchOpts = {
  withZone:    boolean
  withCuisine: boolean
  /** Si presente y hay user_lat/lng, primero filtra por ST_DWithin via RPC. */
  radius_m?:   number
}

async function fetchAndFilter(intent: Intent, opts: FetchOpts) {
  const { withZone, withCuisine, radius_m } = opts

  // ── PostGIS path: cuando hay coords del usuario y radio, filtramos por
  // ST_DWithin ANTES de cualquier ranking. Esto cierra el bug "italiana en
  // Maipú devuelve Ñuñoa": el filtro geográfico es WHERE en el query plan,
  // no un filtro JS post-fetch.
  let baseSelect = supabase
    .from('restaurants')
    .select(`*, menu_items (id, name, description, price, tags, photo_url, available, category)`)
    .eq('active', true)

  if (radius_m && intent.user_lat != null && intent.user_lng != null) {
    const { data: nearby, error: rpcErr } = await supabase.rpc('restaurants_in_radius', {
      lat: intent.user_lat, lng: intent.user_lng, radius_m,
    })
    if (rpcErr || !nearby || nearby.length === 0) return []
    const ids = (nearby as { id: string }[]).map(r => r.id)
    if (ids.length === 0) return []
    baseSelect = baseSelect.in('id', ids)
  }

  const { data: restaurants, error } = await baseSelect.limit(300)

  if (error || !restaurants) return []

  let filtered = restaurants
  if (withZone && intent.zone) {
    const z = stripAccents(intent.zone)
    filtered = filtered.filter(r => r.neighborhood && stripAccents(r.neighborhood).includes(z))
  }
  if (withCuisine && intent.cuisine_type) {
    const c = stripAccents(intent.cuisine_type)
    filtered = filtered.filter(r => {
      // Match directo en cuisine_type del restaurant
      if (r.cuisine_type && stripAccents(r.cuisine_type).includes(c)) return true
      // Fallback: el restaurant tiene ítems en el menú que sí matchean la cuisine pedida
      // Esto permite que una "Cafetería / Italiana" aparezca al buscar "hamburguesas"
      // si efectivamente vende hamburguesas.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (r.menu_items as any[]) ?? []
      return cuisineMatchesMenu(c, items)
    })
  }

  const sorted = [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

  return sorted
    .map((restaurant) => {
      const items = (restaurant.menu_items as any[]) || []
      let candidateItems = items.filter((item: any) => item.available !== false)

      if (intent.budget_clp != null) {
        candidateItems = candidateItems.filter((item: any) => item.price <= intent.budget_clp!)
      }
      if (intent.dietary_restrictions && intent.dietary_restrictions.length > 0) {
        candidateItems = candidateItems.filter((item: any) =>
          intent.dietary_restrictions!.some((r) =>
            item.tags?.some((tag: string) => tag.toLowerCase().includes(r.toLowerCase()))
          )
        )
      }
      if (candidateItems.length === 0) return null

      // Sort by price desc (best value within budget first)
      const sorted = candidateItems.sort((a: any, b: any) => b.price - a.price)
      const bestDish  = sorted[0]
      const menuItems = sorted.slice(0, 3) // up to 3 dishes for the card

      // Match reason: si el cuisine_type del restaurant no matchea lo pedido pero
      // un item del menú sí, lo decimos explícitamente ("tienen hamburguesas aunque
      // el restaurante sea italiano").
      let matchReason = `Cocina ${restaurant.cuisine_type} en ${restaurant.neighborhood}`
      if (intent.cuisine_type && restaurant.cuisine_type) {
        const c = stripAccents(intent.cuisine_type)
        const cuisineDirect = stripAccents(restaurant.cuisine_type).includes(c)
        if (!cuisineDirect && bestDish) {
          matchReason = `Tienen ${bestDish.name} en ${restaurant.neighborhood}`
        }
      }

      return {
        restaurant: {
          id: restaurant.id, name: restaurant.name, slug: restaurant.slug,
          address: restaurant.address, neighborhood: restaurant.neighborhood,
          lat: restaurant.lat, lng: restaurant.lng, photo_url: restaurant.photo_url,
          cuisine_type: restaurant.cuisine_type, price_range: restaurant.price_range,
          rating: restaurant.rating, review_count: restaurant.review_count,
          // Para que el card del listado caiga al rating de Google con
          // atribución cuando HiChapi todavía no tiene reviews propias.
          google_rating:       restaurant.google_rating ?? null,
          google_rating_count: restaurant.google_rating_count ?? null,
        },
        suggested_dish: bestDish,
        menu_items: menuItems,
        match_reason: matchReason,
      }
    })
    .filter(Boolean)
    .slice(0, 3)
}

type SearchOutput = {
  results: NonNullable<Awaited<ReturnType<typeof fetchAndFilter>>>
  /** Hay zone (texto o coords) pero ningún restaurant matchea allí.
   *  Importante: NO devolvemos resultados de otra zona — eso confunde al
   *  usuario y dispara el bug "italiana en Maipú devuelve Ñuñoa". */
  no_results_in_zone: boolean
}

async function searchRestaurants(intent: Intent): Promise<SearchOutput> {
  // ── Resolver landmarks/metro → barrio canónico ───────────────────────────
  const resolvedIntent: Intent = {
    ...intent,
    zone: resolveZone(intent.zone),
  }

  // ── Caché de resultados por intent ───────────────────────────────────────
  const cacheKey = intentCacheKey(resolvedIntent)
  const cached = queryCache.get(cacheKey) as SearchOutput | undefined
  if (cached) return cached

  let results: SearchOutput['results'] = []
  let no_results_in_zone = false

  const hasCoords = resolvedIntent.user_lat != null && resolvedIntent.user_lng != null

  if (hasCoords) {
    // ── Path con coordenadas: PostGIS WHERE antes de cualquier ranking.
    // 3km → 5km → vacío. NO ampliamos sin radio: si nada en 5km, mejor que
    // el agente enriquezca la zona que mostrar resultados de otra parte.
    results = await fetchAndFilter(resolvedIntent, { withZone: false, withCuisine: true, radius_m: 3000 })
    if (results.length === 0) {
      results = await fetchAndFilter(resolvedIntent, { withZone: false, withCuisine: true, radius_m: 5000 })
    }
    if (results.length === 0 && resolvedIntent.cuisine_type) {
      // último intento: relajar cuisine pero mantener radio
      results = await fetchAndFilter(resolvedIntent, { withZone: false, withCuisine: false, radius_m: 5000 })
    }
    if (results.length === 0) no_results_in_zone = true
  } else if (resolvedIntent.zone) {
    // ── Path con zona como texto (sin coords): match estricto contra
    // neighborhood. Si vacío, ANTES de declarar no_results_in_zone intentamos
    // relajar cuisine MANTENIENDO la zona — eso es un fallback honesto:
    // "no hay italianos en Concón pero sí hay otros restaurants ahí".
    // NUNCA dropeamos la zona para mostrar resultados de otra comuna.
    results = await fetchAndFilter(resolvedIntent, { withZone: true, withCuisine: true })
    if (results.length === 0 && resolvedIntent.cuisine_type) {
      results = await fetchAndFilter(resolvedIntent, { withZone: true, withCuisine: false })
    }
    if (results.length === 0) {
      no_results_in_zone = true
    }
  } else {
    // ── Path sin zona ni coords: aquí el fallback de cuisine sí es válido
    // porque el usuario no pidió zona específica.
    results = await fetchAndFilter(resolvedIntent, { withZone: false, withCuisine: true })
    if (results.length === 0 && resolvedIntent.cuisine_type) {
      results = await fetchAndFilter(resolvedIntent, { withZone: false, withCuisine: false })
    }
  }

  // ── Enriquecer con promociones activas para channel_chapi ──────────
  // Sprint 2026-04-20: cada restaurant resultante trae sus promos que
  // están corriendo AHORA y habilitadas para Chapi. El frontend las
  // puede mostrar como chips junto al card del restaurant.
  if (results.length > 0) {
    const restIds = results.map(r => r!.restaurant.id)
    const { data: promoRows } = await supabase
      .from('promotions')
      .select('id, restaurant_id, name, description, kind, value, time_start, time_end, days_of_week, valid_from, valid_until, channel_mesa, channel_espera, channel_chapi, menu_item_ids, active')
      .in('restaurant_id', restIds)
      .eq('active', true)
      .eq('channel_chapi', true)

    const { isPromoActiveNow, promoValueLabel } = await import('@/lib/promotions')
    type Promo = import('@/lib/promotions').PromotionRow & { restaurant_id: string }
    const byRest = new Map<string, { name: string; label: string; description: string | null }[]>()
    for (const p of ((promoRows ?? []) as Promo[])) {
      if (!isPromoActiveNow(p)) continue
      const arr = byRest.get(p.restaurant_id) ?? []
      arr.push({ name: p.name, label: promoValueLabel(p), description: p.description })
      byRest.set(p.restaurant_id, arr)
    }

    for (const r of results) {
      if (!r) continue
      (r as unknown as { active_promotions?: unknown }).active_promotions = byRest.get(r.restaurant.id) ?? []
    }
  }

  const out: SearchOutput = { results, no_results_in_zone }
  // No cacheamos vacíos: el frontend dispara enrichment async y reintenta esta
  // búsqueda con el mismo intent. Si cacheamos `[]`, el retry recibe el cache
  // viejo y nunca ve los restaurantes recién insertados.
  if (results.length > 0) {
    queryCache.set(cacheKey, out)
  }
  return out
}

// ── Rule-based parser: zero AI cost, used as fallback ─────────────────────────
function ruleBasedParser(message: string, prevIntent: Intent) {
  const msg = message.toLowerCase()

  // Budget
  const lucasMatch = msg.match(/(\d+)\s*lucas/)
  const milMatch   = msg.match(/(\d+)\s*mil/)
  const budget_clp = lucasMatch ? parseInt(lucasMatch[1]) * 1000
    : milMatch ? parseInt(milMatch[1]) * 1000
    : prevIntent.budget_clp ?? null

  // Zone
  const ZONES = ['providencia','barrio italia','bellavista','lastarria','santiago centro',
    'las condes','vitacura','nunoa','ñuñoa','miraflores','recoleta','san miguel']
  const zone = ZONES.find(z => msg.includes(z)) ?? prevIntent.zone ?? null

  // Cuisine
  const CUISINES: [string, string][] = [
    ['japan','japonesa'],['ramen','japonesa'],['sushi','japonesa'],
    ['ital','italiana'],['pizza','italiana'],['pasta','italiana'],
    ['peruano','peruana'],['peruane','peruana'],['ceviche','peruana'],
    ['mexic','mexicana'],['taco','mexicana'],
    ['chil','chilena'],['cazuela','chilena'],['empanada','chilena'],
    ['vegano','vegana'],['vegane','vegana'],
    ['vegetar','vegetariana'],
    ['burger','hamburgueseria'],['hambur','hamburgueseria'],
    ['thai','tailandesa'],['tailand','tailandesa'],
    ['parril','parrilla'],['asado','parrilla'],
    ['maris','mariscos'],['pescado','mariscos'],
  ]
  const cuisine_type = CUISINES.find(([k]) => msg.includes(k))?.[1] ?? prevIntent.cuisine_type ?? null

  // Dietary
  const dietary_restrictions: string[] = []
  if (msg.includes('sin gluten') || msg.includes('celiaco')) dietary_restrictions.push('sin gluten')
  if (msg.includes('vegano') || msg.includes('vegana')) dietary_restrictions.push('vegano')
  if (msg.includes('vegetar')) dietary_restrictions.push('vegetariano')
  if (msg.includes('sin lactosa')) dietary_restrictions.push('sin lactosa')

  const hasSignal = zone || budget_clp || cuisine_type || dietary_restrictions.length > 0

  return {
    message: hasSignal
      ? '¡Buscando opciones para ti! 🍽️'
      : '¿Me dices en qué barrio o qué tipo de comida buscas?',
    intent: { budget_clp, zone, cuisine_type, dietary_restrictions,
      user_lat: prevIntent.user_lat ?? null, user_lng: prevIntent.user_lng ?? null },
    ready_to_search: !!hasSignal,
    needs_location: msg.includes('cerca de mi') || msg.includes('cerca de mí'),
  }
}

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un minuto.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { message, intent } = RequestSchema.parse(body)

    const encoder = new TextEncoder()

    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    const send = (event: string, data: unknown) =>
      writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))

    ;(async () => {
      try {
        // ── Caché de Claude: mismo mensaje + mismo contexto = skip API ──────
        const ck = claudeCacheKey(message, intent)
        const cachedClaude = claudeCache.get(ck)

        let chapiResponse: {
          message: string
          intent: Intent
          ready_to_search: boolean
          needs_location: boolean
        }

        if (cachedClaude) {
          // Hit: emitir mensaje cacheado directamente, sin llamar a Claude
          chapiResponse = cachedClaude as typeof chapiResponse
          await send('token', { text: chapiResponse.message })
        } else {

        // ── Stream Claude (primary model) ────────────────────────────────────
        let fullText = ''
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 28_000) // 28s timeout

          const claudeStream = anthropic.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system: SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: intent
                ? `Contexto previo: ${JSON.stringify(intent)}\n\nNuevo mensaje: ${message}`
                : message,
            }],
          }, { signal: controller.signal })

          for await (const chunk of claudeStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              fullText += chunk.delta.text
              const msgMatch = fullText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/)
              if (msgMatch) await send('token', { text: msgMatch[1] })
            }
          }
          clearTimeout(timeout)

          const cleaned = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          chapiResponse = JSON.parse(cleaned)

        } catch (aiErr) {
          // ── Fallback: rule-based parser, zero AI cost ─────────────────────
          // Triggered when: Claude API is down, timeout, rate limit, parse error
          console.error('Claude fallback triggered:', aiErr)
          chapiResponse = ruleBasedParser(message, intent || {})
          await send('token', { text: chapiResponse.message })
        }

        // Save to cache (only if we got a real Claude response)
        if (fullText) claudeCache.set(ck, chapiResponse)

        } // end if (cachedClaude) else

        // Merge intents: Claude's explicit null/value wins over accumulated context.
        // Only fall back to previous if Claude left a field undefined (not in response JSON).
        const mergedIntent: Intent = { ...(intent || {}) }
        if (chapiResponse.intent) {
          for (const key of Object.keys(chapiResponse.intent) as Array<keyof Intent>) {
            if (chapiResponse.intent[key] !== undefined) {
              // @ts-ignore
              mergedIntent[key] = chapiResponse.intent[key]
            }
          }
        }
        // Save Claude's own readiness decision BEFORE we override with hasSignal.
        // This matters for searched_but_empty: if Claude itself says ready_to_search:false
        // (i.e. it's still asking a clarifying question), we must NOT show the no-results
        // banner even if accumulated intent has some signal.
        const claudeSaysReady = chapiResponse.ready_to_search

        const hasSignal =
          (mergedIntent.zone && mergedIntent.zone !== null) ||
          (mergedIntent.budget_clp && mergedIntent.budget_clp > 0) ||
          (mergedIntent.dietary_restrictions && mergedIntent.dietary_restrictions.length > 0) ||
          (mergedIntent.cuisine_type && mergedIntent.cuisine_type !== null)

        if (hasSignal) {
          chapiResponse.ready_to_search = true
          chapiResponse.intent = mergedIntent
        }

        // Search restaurants if ready
        let results: any[] = []
        let no_results_in_zone = false
        if (chapiResponse.ready_to_search && !chapiResponse.needs_location) {
          const out = await searchRestaurants(chapiResponse.intent || {})
          results = out.results
          no_results_in_zone = out.no_results_in_zone
        }

        await send('done', {
          message: chapiResponse.message,
          intent: chapiResponse.intent,
          results,
          ready_to_search: chapiResponse.ready_to_search,
          needs_location: chapiResponse.needs_location,
          // Only signal empty if Claude itself decided to search (not just asking clarifying Qs)
          searched_but_empty: claudeSaysReady && !chapiResponse.needs_location && results.length === 0,
          // Vacío específicamente porque la zona pedida no tiene matches (no
          // confundir con "el usuario aún no dio una zona"). El frontend usa
          // este flag para disparar el agente de enriquecimiento.
          no_results_in_zone: no_results_in_zone && claudeSaysReady,
        })
      } catch (err) {
        await send('error', { message: 'Error procesando tu mensaje. Intenta de nuevo.' })
      } finally {
        await writer.close()
      }
    })()

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Error procesando tu mensaje. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
