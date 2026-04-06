import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveZone } from '@/lib/landmarks'
import { queryCache, claudeCache, intentCacheKey, claudeCacheKey } from '@/lib/cache'

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

async function fetchAndFilter(intent: Intent, withZone: boolean) {
  let query = supabase
    .from('restaurants')
    .select(`*, menu_items (id, name, description, price, tags, photo_url, available)`)
    .eq('active', true)
    .limit(15)

  if (withZone && intent.zone) {
    query = query.ilike('neighborhood', `%${intent.zone}%`)
  }
  if (intent.cuisine_type) {
    query = query.ilike('cuisine_type', `%${intent.cuisine_type}%`)
  }

  const { data: restaurants, error } = await query
  if (error || !restaurants) return []

  const sorted = [...restaurants].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

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

      return {
        restaurant: {
          id: restaurant.id, name: restaurant.name, slug: restaurant.slug,
          address: restaurant.address, neighborhood: restaurant.neighborhood,
          lat: restaurant.lat, lng: restaurant.lng, photo_url: restaurant.photo_url,
          cuisine_type: restaurant.cuisine_type, price_range: restaurant.price_range,
          rating: restaurant.rating, review_count: restaurant.review_count,
        },
        suggested_dish: bestDish,
        menu_items: menuItems,
        match_reason: `Cocina ${restaurant.cuisine_type} en ${restaurant.neighborhood}`,
      }
    })
    .filter(Boolean)
    .slice(0, 3)
}

async function searchRestaurants(intent: Intent) {
  // ── Resolver landmarks/metro → barrio canónico ───────────────────────────
  const resolvedIntent: Intent = {
    ...intent,
    zone: resolveZone(intent.zone),
  }

  // ── Caché de resultados por intent ───────────────────────────────────────
  const cacheKey = intentCacheKey(resolvedIntent)
  const cached = queryCache.get(cacheKey)
  if (cached) return cached

  // ── Query Supabase ────────────────────────────────────────────────────────
  let results = await fetchAndFilter(resolvedIntent, true)
  if (results.length === 0 && resolvedIntent.zone) {
    results = await fetchAndFilter(resolvedIntent, false)
  }

  queryCache.set(cacheKey, results)
  return results
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
          })

          for await (const chunk of claudeStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              fullText += chunk.delta.text
              const msgMatch = fullText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/)
              if (msgMatch) await send('token', { text: msgMatch[1] })
            }
          }

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
        if (chapiResponse.ready_to_search && !chapiResponse.needs_location) {
          results = await searchRestaurants(chapiResponse.intent || {})
        }

        await send('done', {
          message: chapiResponse.message,
          intent: chapiResponse.intent,
          results,
          ready_to_search: chapiResponse.ready_to_search,
          needs_location: chapiResponse.needs_location,
          // Only signal empty if Claude itself decided to search (not just asking clarifying Qs)
          searched_but_empty: claudeSaysReady && !chapiResponse.needs_location && results.length === 0,
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
