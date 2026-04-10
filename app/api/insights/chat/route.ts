import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

// ══════════════════════════════════════════════════════════════════════════════
//  Chapi Insights — Claude Sonnet chat with tool use over Supabase
// ══════════════════════════════════════════════════════════════════════════════
//  The frontend sends a conversation history + a restaurant id. We pass the
//  conversation to Sonnet along with a toolbox that lets the model query the
//  database directly (sales summary, top items, sentiment, low stock, caja).
//  Every tool is scoped to the caller's restaurant_id to prevent cross-tenant
//  leakage. The loop runs until the model returns a final text response or we
//  hit MAX_ROUNDS of tool-use (safety cap).
// ══════════════════════════════════════════════════════════════════════════════

const MAX_ROUNDS = 6
const MODEL      = 'claude-sonnet-4-5'

const ChatMessageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: z.string(),
})

const ChatRequestSchema = z.object({
  restaurant_id: z.string().uuid(),
  messages:      z.array(ChatMessageSchema).min(1).max(30),
})

// ── Tool definitions (JSON Schema) ───────────────────────────────────────────

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'get_sales_summary',
    description:
      'Resumen de ventas en un rango de fechas: total de pedidos pagados, revenue total, '
      + 'ticket promedio, desglose cash/digital. Usa cuando el admin pregunta por ventas, '
      + 'ingresos, facturación, promedio, o "¿cómo vamos hoy/esta semana/este mes?".',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Fecha inicial en formato YYYY-MM-DD.' },
        end_date:   { type: 'string', description: 'Fecha final inclusive en formato YYYY-MM-DD.' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_top_items',
    description:
      'Top N platos más vendidos en un rango de fechas, ordenados por cantidad de unidades. '
      + 'Devuelve nombre, unidades vendidas y revenue por plato. '
      + 'Usa cuando preguntan "¿mi plato más vendido?", "best sellers", "qué se vende más".',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'YYYY-MM-DD inicial.' },
        end_date:   { type: 'string', description: 'YYYY-MM-DD final inclusive.' },
        limit:      { type: 'integer', description: 'Cuántos platos top devolver (default 10).' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_sentiment_breakdown',
    description:
      'Análisis de reseñas en un rango: total, promedio de estrellas, desglose por sentiment '
      + '(positive/neutral/negative), temas más mencionados, y 3 comentarios destacados. '
      + 'Usa cuando preguntan por reseñas, satisfacción, feedback, calidad del servicio.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'YYYY-MM-DD inicial.' },
        end_date:   { type: 'string', description: 'YYYY-MM-DD final inclusive.' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_low_stock',
    description:
      'Lista todos los insumos con stock bajo (current_qty <= min_qty). Usa cuando '
      + 'preguntan por inventario, quiebres, faltantes, o "qué tengo que comprar".',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_cash_reconciliation',
    description:
      'Resumen de caja para una fecha específica: apertura, efectivo recibido, gastos, '
      + 'cierre, diferencia (sobrante/faltante). Usa cuando preguntan por caja, '
      + 'cuadratura, efectivo, gastos del día.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD. Default: hoy.' },
      },
    },
  },
]

// ── Tool implementations ─────────────────────────────────────────────────────

type Supabase = ReturnType<typeof createAdminClient>

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
function startOf(d: string) { return `${d}T00:00:00Z` }
function endOf(d: string)   { return `${d}T23:59:59Z` }

async function runTool(
  name: string,
  input: Record<string, unknown>,
  restaurantId: string,
  supabase: Supabase,
): Promise<unknown> {
  switch (name) {
    case 'get_sales_summary': {
      const start = String(input.start_date ?? ymd(new Date()))
      const end   = String(input.end_date   ?? ymd(new Date()))
      const { data: orders } = await supabase
        .from('orders')
        .select('total, cash_amount, digital_amount, payment_method')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'paid')
        .gte('updated_at', startOf(start))
        .lte('updated_at', endOf(end))

      type O = { total: number; cash_amount: number | null; digital_amount: number | null; payment_method: string | null }
      const rows = (orders ?? []) as O[]
      const total_orders  = rows.length
      const total_revenue = rows.reduce((s, o) => s + (o.total ?? 0), 0)
      const total_cash    = rows.reduce((s, o) => s + (o.cash_amount ?? 0), 0)
      const total_digital = rows.reduce((s, o) => s + (o.digital_amount ?? 0), 0)
      const avg_ticket    = total_orders > 0 ? Math.round(total_revenue / total_orders) : 0

      return {
        range: { start, end },
        total_orders,
        total_revenue,
        avg_ticket,
        total_cash,
        total_digital,
        currency: 'CLP',
      }
    }

    case 'get_top_items': {
      const start = String(input.start_date ?? ymd(new Date()))
      const end   = String(input.end_date   ?? ymd(new Date()))
      const limit = Number(input.limit ?? 10)

      // Fetch paid orders in range
      const { data: orderIds } = await supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'paid')
        .gte('updated_at', startOf(start))
        .lte('updated_at', endOf(end))

      const ids = (orderIds ?? []).map((o: { id: string }) => o.id)
      if (ids.length === 0) return { range: { start, end }, items: [] }

      const { data: items } = await supabase
        .from('order_items')
        .select('menu_item_id, name, quantity, unit_price')
        .in('order_id', ids)

      type Item = { menu_item_id: string | null; name: string; quantity: number; unit_price: number }
      const agg = new Map<string, { name: string; units: number; revenue: number }>()
      for (const row of (items ?? []) as Item[]) {
        const key = row.name
        const prev = agg.get(key) ?? { name: row.name, units: 0, revenue: 0 }
        prev.units   += row.quantity
        prev.revenue += row.quantity * row.unit_price
        agg.set(key, prev)
      }

      const ranked = Array.from(agg.values())
        .sort((a, b) => b.units - a.units)
        .slice(0, limit)

      return { range: { start, end }, items: ranked, currency: 'CLP' }
    }

    case 'get_sentiment_breakdown': {
      const start = String(input.start_date ?? ymd(new Date()))
      const end   = String(input.end_date   ?? ymd(new Date()))
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating, sentiment, topics, comment, ai_summary, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startOf(start))
        .lte('created_at', endOf(end))
        .order('created_at', { ascending: false })

      type R = { rating: number; sentiment: string | null; topics: string[] | null; comment: string | null; ai_summary: string | null; created_at: string }
      const rows = (reviews ?? []) as R[]
      const total = rows.length
      if (total === 0) return { range: { start, end }, total: 0, message: 'Sin reseñas en el rango' }

      const avg_rating = Number((rows.reduce((s, r) => s + r.rating, 0) / total).toFixed(2))
      const sentiment = {
        positive: rows.filter(r => r.sentiment === 'positive').length,
        neutral:  rows.filter(r => r.sentiment === 'neutral').length,
        negative: rows.filter(r => r.sentiment === 'negative').length,
      }

      const topicCounts = new Map<string, number>()
      for (const r of rows) {
        for (const t of r.topics ?? []) {
          topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1)
        }
      }
      const top_topics = Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }))

      const highlights = rows
        .filter(r => r.comment || r.ai_summary)
        .slice(0, 3)
        .map(r => ({
          rating:     r.rating,
          sentiment:  r.sentiment,
          comment:    r.comment,
          ai_summary: r.ai_summary,
        }))

      return { range: { start, end }, total, avg_rating, sentiment, top_topics, highlights }
    }

    case 'get_low_stock': {
      const { data } = await supabase
        .from('stock_items')
        .select('name, current_qty, min_qty, unit, category, cost_per_unit')
        .eq('restaurant_id', restaurantId)
        .order('current_qty', { ascending: true })

      type S = { name: string; current_qty: number; min_qty: number; unit: string | null; category: string | null; cost_per_unit: number | null }
      const all = (data ?? []) as S[]
      const low = all.filter(s => s.current_qty <= s.min_qty)
      return {
        total_items: all.length,
        low_count:   low.length,
        low_items:   low.map(s => ({
          name:        s.name,
          current_qty: s.current_qty,
          min_qty:     s.min_qty,
          unit:        s.unit,
          category:    s.category,
        })),
      }
    }

    case 'get_cash_reconciliation': {
      const date = String(input.date ?? ymd(new Date()))
      const { data: sessions } = await supabase
        .from('cash_register_sessions')
        .select('id, opened_at, closed_at, opening_amount, actual_cash, total_cash, total_digital, total_orders, total_expenses, difference, status, notes')
        .eq('restaurant_id', restaurantId)
        .gte('opened_at', startOf(date))
        .lte('opened_at', endOf(date))
        .order('opened_at', { ascending: false })

      if (!sessions || sessions.length === 0) {
        return { date, message: 'No hay sesiones de caja registradas en esa fecha' }
      }
      return { date, sessions }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ── POST /api/insights/chat ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  try {
    const body = ChatRequestSchema.parse(await req.json())
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chapi Insights no está configurado (falta ANTHROPIC_API_KEY)' },
        { status: 503 }
      )
    }

    // Verify the caller belongs to the restaurant
    const supabase = createAdminClient()
    const { data: member } = await supabase
      .from('team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('restaurant_id', body.restaurant_id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'Sin acceso al restaurante' }, { status: 403 })
    }

    const today = ymd(new Date())
    const client = new Anthropic({ apiKey })

    // Seed the Anthropic message list from the client conversation
    const messages: Anthropic.Messages.MessageParam[] = body.messages.map(m => ({
      role:    m.role,
      content: m.content,
    }))

    const systemPrompt = `Eres Chapi Insights, el asistente de analítica para el admin de un restaurante chileno.
Respondes en español chileno claro y directo. Tu trabajo es responder preguntas de negocio usando las herramientas disponibles.

REGLAS:
- Siempre usa herramientas para obtener datos reales. NUNCA inventes números.
- Cuando la pregunta implica "hoy", usa ${today} como rango.
- Cuando dicen "esta semana", usa los últimos 7 días desde ${today}.
- Cuando dicen "este mes", usa desde el día 1 del mes actual hasta ${today}.
- Formatea montos en pesos chilenos con el símbolo $ y separadores (ej: $54.200).
- Sé conciso: 2-4 oraciones cuando sea posible. Usa bullets para listas.
- Cuando los datos muestren algo notable (crecimiento, caída, anomalía), destácalo en una línea extra.
- Si una herramienta devuelve cero datos, dilo claramente en vez de inventar.

Hoy es ${today}.`

    const toolLog: Array<{ tool: string; input: unknown }> = []

    // Tool-use loop
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.messages.create({
        model:       MODEL,
        max_tokens:  2048,
        system:      systemPrompt,
        tools:       TOOLS,
        messages,
      })

      // If the model stopped with text, we're done
      if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
        const text = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n')
        return NextResponse.json({ reply: text, tools_used: toolLog })
      }

      // Otherwise expect tool_use blocks
      if (response.stop_reason !== 'tool_use') {
        // Unknown stop reason — return whatever text we have
        const text = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n')
        return NextResponse.json({ reply: text || '…', tools_used: toolLog })
      }

      // Append assistant turn verbatim
      messages.push({ role: 'assistant', content: response.content })

      // Run every tool_use block in this turn and build the user tool_result turn
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        toolLog.push({ tool: block.name, input: block.input })
        try {
          const result = await runTool(
            block.name,
            (block.input as Record<string, unknown>) ?? {},
            body.restaurant_id,
            supabase,
          )
          toolResults.push({
            type:        'tool_result',
            tool_use_id: block.id,
            content:     JSON.stringify(result),
          })
        } catch (err) {
          toolResults.push({
            type:        'tool_result',
            tool_use_id: block.id,
            content:     JSON.stringify({ error: (err as Error).message ?? 'tool failed' }),
            is_error:    true,
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })
    }

    return NextResponse.json({
      reply: 'Llegué al límite de herramientas consultando esto. Intenta una pregunta más específica.',
      tools_used: toolLog,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('insights/chat error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
