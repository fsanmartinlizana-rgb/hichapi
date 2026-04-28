import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sanitizeMessagePrices, recoverMessageFromRawText } from '@/lib/chat/sanitize'

// ── Rate limiter (in-memory, per IP, 30 req/min) ───────────────────────────
const rateMap = new Map<string, { count: number; reset: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW = 60_000

let _rateSweepCounter = 0
function checkRate(ip: string): boolean {
  const now = Date.now()
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Schemas ───────────────────────────────────────────────────────────────────

const CartItemSchema = z.object({
  menu_item_id: z.string(),
  name: z.string(),
  quantity: z.number().int().min(1),
  unit_price: z.number(),
  note: z.string().nullable().optional(),
})

const RequestSchema = z.object({
  message: z.string().min(1).max(500),
  restaurant_slug: z.string(),
  table_id: z.string(),
  cart: z.array(CartItemSchema).default([]),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).default([]),
})

// ── Build system prompt with live menu ───────────────────────────────────────

// Formato CLP chileno: $18.000 (con punto de miles, sin decimales)
function formatCLP(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('es-CL').replace(/,/g, '.')
}

// Formatea la lista de ingredientes de un plato (JSONB en menu_items.ingredients)
function formatIngredients(ingredients: unknown): string {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return ''
  const names = ingredients
    .map((ing: unknown) => {
      if (typeof ing === 'string') return ing
      if (typeof ing === 'object' && ing) {
        const obj = ing as Record<string, unknown>
        return (obj.name as string) ?? (obj.stock_item as string) ?? null
      }
      return null
    })
    .filter(Boolean)
    .slice(0, 8)
  return names.length > 0 ? ` · ingredientes: ${names.join(', ')}` : ''
}

interface ActivePromo {
  name:        string
  label:       string
  description: string | null
  schedule:    string
}

interface MenuRow {
  id: string
  name: string
  description: string | null
  price: number
  tags: string[]
  category: string
  available: boolean
  ingredients?: unknown
  allergens?: unknown
}

function buildSystemPrompt(
  restaurantName: string,
  tableLabel: string,
  menu: MenuRow[],
  cart: z.infer<typeof CartItemSchema>[],
  activePromotions: ActivePromo[] = [],
) {
  const available = menu.filter(m => m.available)

  const menuByCategory = available.reduce((acc, item) => {
    const cat = item.category || 'otros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, typeof available>)

  const menuText = Object.entries(menuByCategory).map(([cat, items]) =>
    `${cat.toUpperCase()}:\n${items.map(i =>
      `  - [${i.id}] ${i.name} · ${formatCLP(i.price)}${i.description ? ` · ${i.description}` : ''}${i.tags?.length ? ` · tags: ${i.tags.join(', ')}` : ''}${formatIngredients(i.ingredients)}`
    ).join('\n')}`
  ).join('\n\n')

  const featuredItems = available.filter(i => i.tags?.includes('promovido'))
  const featuredText = featuredItems.length > 0
    ? `\nPLATOS ESPECIALES HOY (recomiéndalos activamente a cada mesa, en el momento oportuno):\n${featuredItems.map(i => `  - ${i.name} · ${formatCLP(i.price)}`).join('\n')}\n`
    : ''

  // ── Promociones activas para el canal "mesa" (Sprint 2026-04-20) ────
  // Chapi debe ofrecerlas proactivamente cuando son relevantes al pedido
  // del cliente (ej: happy hour a las 16h, combo cuando pide un plato,
  // 2x1 cuando pide una bebida).
  const promosText = activePromotions.length > 0
    ? `\nPROMOCIONES ACTIVAS AHORA (ofreceselas al cliente cuando sean relevantes):\n${activePromotions.map(p =>
        `  - ${p.name} — ${p.label}${p.description ? `: ${p.description}` : ''}${p.schedule ? ` · Vigencia: ${p.schedule}` : ''}`
      ).join('\n')}\n`
    : ''

  const cartText = cart.length > 0
    ? `\nPEDIDO ACTUAL DEL CLIENTE:\n${cart.map(c => `  - ${c.quantity}× ${c.name} ${formatCLP(c.unit_price)}${c.note ? ` (${c.note})` : ''}`).join('\n')}\nTotal actual: ${formatCLP(cart.reduce((s,c) => s + c.unit_price * c.quantity, 0))}\n`
    : '\nEl cliente aún no ha pedido nada.\n'

  return `Eres Chapi, el asistente de ${restaurantName} en la ${tableLabel}.
Tu trabajo: ayudar al cliente a pedir, recomendar platos y gestionar su cuenta.
Eres cercano, conoces la carta de memoria, y haces la experiencia deliciosa.

CARTA DISPONIBLE HOY:
${menuText}
${featuredText}${promosText}${cartText}
REGLAS:
1. AGREGAR vs RECOMENDAR:
   - "add_items" SOLO cuando el cliente diga claramente que quiere algo ("quiero X", "tráeme X", "agrega X", "dame X", o un "sí" tras una recomendación tuya específica).
   - Si pregunta abierta ("¿qué me recomiendas?", "qué tienen rico", "estoy con hambre") → "recommend" SIN agregar nada al carrito. Esperá la confirmación.
   - Si describe situación (aniversario, dieta, presupuesto) sin pedir explícitamente → "recommend".
2. CRÍTICO: Cuando agregues items, SIEMPRE usa el ID exacto [uuid] que aparece en la CARTA DISPONIBLE. NUNCA inventes IDs ni nombres. Si el cliente pide "Sprite", buscá "[id] Sprite" en la carta y usá ese ID exacto.
3. CANTIDAD POR DEFECTO:
   - PLATO PRINCIPAL individual (salmón, pasta, hamburguesa, principal) + el cliente dice 'para dos' o cuántas personas son → quantity igual al número de personas (cada uno come el suyo).
   - POSTRE: por defecto quantity 1 (típicamente se comparte o se pide solo). Solo agregar más si el cliente lo dice EXPLÍCITAMENTE ('dos postres', 'uno para cada uno').
   - BEBIDA: por defecto quantity igual al número de personas (cada uno bebe la suya), salvo que sea para compartir (ej: una botella de vino, jarra).
   - PLATO COMPARTIDO POR NATURALEZA (tabla, picada, fuente, para picar) → quantity: 1, ACLARÁ cuántas personas cubre: 'este plato alcanza para 2-3 personas'.
   - Si hay ambigüedad → preguntá ANTES de agregar. NUNCA asumas en silencio.
4. Si pide algo que no existe en la carta → sugiere la alternativa más parecida disponible, pero NO lo agregues automáticamente.
5. Si pide restricciones (sin gluten, vegano, etc.) → filtra por tags y recomienda lo correcto.
6. Si dice "la cuenta" o "quiero pagar" → acción "request_bill".
7. Si pide dividir la cuenta → acción "request_split" con split_count.
8. Si recomienda sin pedir → acción "recommend", sugiere 2-3 platos con descripción breve y precio.
9. Si es saludo o pregunta general → acción "chat", responde amigablemente.
10. Si pide "ver la carta", "el menú", "qué tienen", "qué puedo pedir" → acción "show_menu".
11. Si pregunta por ingredientes de un plato ("¿qué lleva el...?", "con qué viene...") → usa la lista de ingredientes de la CARTA DISPONIBLE de arriba para responder.
12. Máximo 2-3 oraciones por mensaje. Tono: cálido, como un amigo que trabaja ahí.
13. PRECIOS INDIVIDUALES ÚNICAMENTE: Menciona el precio de cada plato por separado. NUNCA calcules ni escribas totales en el mensaje — el sistema los calcula automáticamente. Correcto: 'El Salmón ($18.500) y la Leche Asada ($5.900)'. INCORRECTO: 'entre los dos andan en $24.400'. Siempre con separador de miles, nunca '18k'.
14. NUNCA inventes precios, platos ni ingredientes que no estén en la carta.
15. PRESUPUESTO ES INVIOLABLE: Si el cliente dio un presupuesto (ej: "menos de 30 mil"), validá MENTALMENTE (sin escribir el total) que la suma de PEDIDO ACTUAL + lo que vas a agregar no lo supere. Si lo supera, NO agregues — recomendá una combinación más barata o menor cantidad. Acordate que "para dos" típicamente son 2 platos principales + 1 postre compartido.
16. CARRITO SOBRE PRESUPUESTO: Si el cliente dice algo tipo "me pasé del presupuesto", "supera mi presupuesto", "está caro", "muy caro", o "es mucho" → acción "chat", reconocé el problema y sugerí EXPLÍCITAMENTE qué item del PEDIDO ACTUAL se podría quitar (el más caro o el que duplica a otro) para volver al presupuesto. NUNCA respondas "no entendí". El cliente tendrá que quitarlo manualmente desde la UI.

RESPONDE SIEMPRE EN JSON (sin markdown):
{
  "message": "respuesta al cliente",
  "action": "add_items" | "request_bill" | "request_split" | "recommend" | "show_menu" | "chat",
  "items_to_add": [{ "menu_item_id": "uuid", "name": "nombre", "quantity": 1, "note": "opcional" }] | null,
  "split_count": número | null
}`
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un minuto.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { message, restaurant_slug, table_id, cart, history } = RequestSchema.parse(body)

    // ── Fetch restaurant + menu (incluye ingredientes) ──────────────────────
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, menu_items(id, name, description, price, tags, category, available, ingredients)')
      .eq('slug', restaurant_slug)
      .single()

    // ── Fetch promociones activas para este restaurant + canal "mesa" ───
    // Sprint 2026-04-20: el chat Chapi debe conocer las promos vigentes
    // y ofrecerlas proactivamente.
    let activePromotions: ActivePromo[] = []
    if (restaurant?.id) {
      const { data: promoRows } = await supabase
        .from('promotions')
        .select('id, name, description, kind, value, time_start, time_end, days_of_week, valid_from, valid_until, channel_mesa, channel_espera, channel_chapi, menu_item_ids, active')
        .eq('restaurant_id', restaurant.id)
        .eq('active', true)
        .eq('channel_mesa', true)

      const { isPromoActiveNow, promoValueLabel, promoScheduleLabel } =
        await import('@/lib/promotions')

      activePromotions = ((promoRows ?? []) as import('@/lib/promotions').PromotionRow[])
        .filter(p => isPromoActiveNow(p))
        .map(p => ({
          name:        p.name,
          label:       promoValueLabel(p),
          description: p.description,
          schedule:    promoScheduleLabel(p),
        }))
    }

    // ── Fetch table label (supports qr_token or UUID) ───────────────────────
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(table_id)
    const { data: table } = await supabase
      .from('tables')
      .select('id, label')
      .eq(isUUID ? 'id' : 'qr_token', table_id)
      .single()

    const menu    = restaurant?.menu_items ?? []
    const resName = restaurant?.name ?? 'el restaurante'
    const tableLabel = table?.label ?? 'tu mesa'

    // ── Build messages array with history ────────────────────────────────────
    const messages: Anthropic.MessageParam[] = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    // ── SSE stream setup ─────────────────────────────────────────────────────
    const encoder = new TextEncoder()
    const stream  = new TransformStream()
    const writer  = stream.writable.getWriter()

    const send = (event: string, data: unknown) =>
      writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))

    ;(async () => {
      let fullText = ''
      let sentDone = false
      try {
        const claudeStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          // 800 tokens (subido de 500): el JSON puede llevar varios items con
          // UUIDs de 36 chars cada uno, y un response cortado revienta JSON.parse
          // → "Ups, no entendí bien" en prod. 800 da margen, costo despreciable.
          max_tokens: 800,
          system: buildSystemPrompt(resName, tableLabel, menu, cart, activePromotions),
          messages,
        })

        let lastEmitted = ''
        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullText += chunk.delta.text
            // Match the message field progressively (no closing quote required)
            // so tokens stream as they arrive instead of appearing all at once.
            const openMatch = fullText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/)
            if (openMatch) {
              // Unescape simple JSON escapes so the display looks natural
              const current = openMatch[1]
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
              if (current !== lastEmitted) {
                lastEmitted = current
                await send('token', { text: current })
              }
            }
          }
        }

        const cleaned = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        // JSON recovery: si Claude devolvió JSON malformado (típicamente porque
        // max_tokens cortó la respuesta a la mitad), intentamos rescatar al
        // menos el campo "message" para no caer al genérico "Ups, no entendí"
        // que el cliente ve. Degrada a action="chat" sin items.
        type ParsedClaudeResponse = {
          message?: string
          action?: string
          items_to_add?: Array<{ menu_item_id: string; name: string; quantity: number; note?: string }>
          split_count?: number | null
        }
        let parsed: ParsedClaudeResponse
        try {
          parsed = JSON.parse(cleaned)
        } catch (parseErr) {
          const recovered = recoverMessageFromRawText(fullText)
          if (recovered) {
            console.warn(
              `[chat/table] JSON.parse falló, recuperado message como chat. ` +
              `Length=${cleaned.length}. First 200 chars: ${cleaned.slice(0, 200)}`,
              parseErr,
            )
            parsed = { message: recovered, action: 'chat', items_to_add: [], split_count: null }
          } else {
            // No hay siquiera un message rescatable → re-throw para caer al catch externo
            console.error(
              `[chat/table] JSON.parse falló y sin message rescatable. ` +
              `Length=${cleaned.length}. First 200 chars: ${cleaned.slice(0, 200)}`,
            )
            throw parseErr
          }
        }

        // ── Resolve menu_item prices for new items ────────────────────────────
        // First try matching by id, then fall back to EXACT case-insensitive name match.
        // NO fuzzy matching — si Claude devuelve un nombre incorrecto, mejor rechazarlo
        // que agregar el item equivocado (ej: Sprite → Fanta).
        type ResolvedItem = { menu_item_id: string; name: string; quantity: number; unit_price: number; note?: string }
        const resolvedItems = (parsed.items_to_add ?? []).map((item: { menu_item_id: string; name: string; quantity: number; note?: string }): ResolvedItem | null => {
          let menuItem = menu.find((m: { id: string }) => m.id === item.menu_item_id) as { id: string; name: string; price: number } | undefined
          
          // Log para debugging: qué está devolviendo Claude
          console.log(`[chat/table] Claude returned: id="${item.menu_item_id}", name="${item.name}"`)
          
          if (!menuItem && item.name) {
            const lower = item.name.toLowerCase().trim()
            // SOLO match exacto por nombre (no fuzzy)
            menuItem = menu.find((m: { name: string }) => m.name.toLowerCase().trim() === lower) as { id: string; name: string; price: number } | undefined
            
            if (!menuItem) {
              console.error(`[chat/table] ❌ Item NO encontrado en menú: id="${item.menu_item_id}", name="${item.name}"`)
              console.error(`[chat/table] Items disponibles en menú: ${menu.map((m: { name: string }) => m.name).join(', ')}`)
              // NO agregar el item si no existe — mejor que agregue el incorrecto
              return null
            } else {
              console.warn(`[chat/table] ⚠️ ID incorrecto pero nombre match: "${menuItem.name}" (id correcto: ${menuItem.id})`)
            }
          } else if (menuItem) {
            console.log(`[chat/table] ✅ Match exacto por ID: "${menuItem.name}"`)
          }
          
          return {
            ...item,
            menu_item_id: menuItem?.id ?? item.menu_item_id,
            unit_price: menuItem?.price ?? 0,
            name: menuItem?.name ?? item.name,
          }
        }).filter((item: ResolvedItem | null): item is ResolvedItem => item !== null)

        // Sanitizar precios en el mensaje: cualquier $ no presente en el menú
        // se considera total computado por el modelo y se strippea. Los precios
        // canónicos viven en el carrito / UI, nunca en el texto del LLM.
        const menuPrices = new Set<number>(menu.map((m: { price: number }) => m.price))
        const { sanitized: sanitizedMessage, strippedCount } =
          sanitizeMessagePrices(parsed.message ?? '', menuPrices)
        if (strippedCount > 0) {
          console.warn(`[chat/table] sanitizeMessagePrices: stripped ${strippedCount} sentence(s) with non-menu $ amounts`)
        }

        await send('done', {
          message: sanitizedMessage,
          action: parsed.action ?? 'chat',
          items_to_add: resolvedItems,
          split_count: parsed.split_count ?? null,
        })
        sentDone = true

      } catch (err) {
        console.error('Table chat error:', err)
        // Solo enviar error si no enviamos 'done' exitosamente
        if (!sentDone) {
          await send('error', { message: 'Ups, no entendí bien. ¿Me lo dices de otra forma?' })
        }
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

  } catch (err) {
    console.error('Table route error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
