import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

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
  note: z.string().optional(),
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

function buildSystemPrompt(
  restaurantName: string,
  tableLabel: string,
  menu: { id: string; name: string; description: string | null; price: number; tags: string[]; category: string; available: boolean }[],
  cart: z.infer<typeof CartItemSchema>[]
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
      `  - [${i.id}] ${i.name} · $${(i.price/1000).toFixed(1)}k${i.description ? ` · ${i.description}` : ''}${i.tags?.length ? ` · tags: ${i.tags.join(', ')}` : ''}`
    ).join('\n')}`
  ).join('\n\n')

  const cartText = cart.length > 0
    ? `\nPEDIDO ACTUAL DEL CLIENTE:\n${cart.map(c => `  - ${c.quantity}× ${c.name} $${(c.unit_price/1000).toFixed(1)}k${c.note ? ` (${c.note})` : ''}`).join('\n')}\nTotal actual: $${(cart.reduce((s,c) => s + c.unit_price * c.quantity, 0)/1000).toFixed(1)}k\n`
    : '\nEl cliente aún no ha pedido nada.\n'

  return `Eres Chapi, el asistente de ${restaurantName} en la ${tableLabel}.
Tu trabajo: ayudar al cliente a pedir, recomendar platos y gestionar su cuenta.
Eres cercano, conoces la carta de memoria, y haces la experiencia deliciosa.

CARTA DISPONIBLE HOY:
${menuText}
${cartText}
REGLAS:
1. Si el cliente pide algo concreto → acción "add_items" con los items del menú (usa los IDs exactos).
2. Si pide algo que no existe → sugiere la alternativa más parecida disponible.
3. Si pide restricciones (sin gluten, vegano, etc.) → filtra por tags y recomienda lo correcto.
4. Si dice "la cuenta" o "quiero pagar" → acción "request_bill".
5. Si pide dividir la cuenta → acción "request_split" con split_count.
6. Si recomienda sin pedir → acción "recommend", sugiere 2-3 platos con descripción breve y precio.
7. Si es saludo o pregunta general → acción "chat", responde amigablemente.
8. Máximo 2 oraciones por mensaje. Tono: cálido, como un amigo que trabaja ahí.
9. NUNCA inventes precios ni platos que no estén en la carta.

RESPONDE SIEMPRE EN JSON (sin markdown):
{
  "message": "respuesta al cliente",
  "action": "add_items" | "request_bill" | "request_split" | "recommend" | "chat",
  "items_to_add": [{ "menu_item_id": "uuid", "name": "nombre", "quantity": 1, "note": "opcional" }] | null,
  "split_count": número | null
}`
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, restaurant_slug, table_id, cart, history } = RequestSchema.parse(body)

    // ── Fetch restaurant + menu ──────────────────────────────────────────────
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, menu_items(*)')
      .eq('slug', restaurant_slug)
      .single()

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
      try {
        let fullText = ''

        const claudeStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: buildSystemPrompt(resName, tableLabel, menu, cart),
          messages,
        })

        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullText += chunk.delta.text
            // Stream the message field as it builds
            const msgMatch = fullText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/)
            if (msgMatch) await send('token', { text: msgMatch[1] })
          }
        }

        const cleaned = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed  = JSON.parse(cleaned)

        // ── Resolve menu_item prices for new items ────────────────────────────
        const resolvedItems = (parsed.items_to_add ?? []).map((item: { menu_item_id: string; name: string; quantity: number; note?: string }) => {
          const menuItem = menu.find((m: { id: string }) => m.id === item.menu_item_id)
          return {
            ...item,
            unit_price: menuItem?.price ?? 0,
            name: menuItem?.name ?? item.name,
          }
        })

        await send('done', {
          message: parsed.message,
          action: parsed.action ?? 'chat',
          items_to_add: resolvedItems,
          split_count: parsed.split_count ?? null,
        })

      } catch (err) {
        console.error('Table chat error:', err)
        await send('error', { message: 'Ups, no entendí bien. ¿Me lo dices de otra forma?' })
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
