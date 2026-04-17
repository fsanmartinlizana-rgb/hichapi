import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { chatCompletion, AiUnavailableError, aiProviderStatus } from '@/lib/ai/chat'

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
    name: 'get_expiring_stock',
    description:
      'Lista insumos por vencer (expiry_date) ordenados por proximidad. Usa cuando '
      + 'preguntan qué cocinar hoy, qué usar primero, qué está por vencer, o cuando '
      + 'sugieres priorizar platos para evitar mermas.',
    input_schema: {
      type: 'object',
      properties: {
        within_days: { type: 'number', description: 'Ventana en días (default 5).' },
      },
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
  {
    name: 'get_dte_folios',
    description:
      'Folios disponibles por tipo de documento DTE (boleta 39, boleta exenta 41, factura 33, '
      + 'nota de débito 56, nota de crédito 61). Muestra cuántos folios quedan en cada CAF activo. '
      + 'Usa cuando preguntan por folios, CAF, cuántas boletas/facturas puedo emitir, '
      + '"¿me quedan folios?", "¿cuándo se acaban los folios?".',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_dte_summary',
    description:
      'Resumen de emisiones DTE en un rango de fechas: total emitido, desglose por tipo '
      + '(boleta/factura), estados (aceptadas, rechazadas, pendientes), monto total facturado. '
      + 'Usa cuando preguntan por facturación electrónica, boletas emitidas, facturas, '
      + '"¿cuánto he facturado?", "¿me rechazaron algo?", "estado del SII".',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Fecha inicial YYYY-MM-DD.' },
        end_date:   { type: 'string', description: 'Fecha final inclusive YYYY-MM-DD.' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_dte_rejections',
    description:
      'Lista las emisiones DTE rechazadas o con error por el SII, con el detalle del rechazo. '
      + 'Usa cuando preguntan "¿me rechazaron algo?", "¿hay errores en el SII?", '
      + '"¿qué documentos tienen problema?", "¿por qué me rechazaron?".',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Máximo de registros a devolver (default 10).' },
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

    case 'get_expiring_stock': {
      const days = Number(input.within_days ?? 5)
      const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('stock_items')
        .select('name, current_qty, unit, category, expiry_date, cost_per_unit')
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', cutoff)
        .order('expiry_date', { ascending: true })

      type E = { name: string; current_qty: number; unit: string | null; category: string | null; expiry_date: string; cost_per_unit: number | null }
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const items = ((data ?? []) as E[]).map(s => {
        const exp = new Date(s.expiry_date)
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000)
        return {
          name:         s.name,
          current_qty:  s.current_qty,
          unit:         s.unit,
          category:     s.category,
          expiry_date:  s.expiry_date,
          days_left:    daysLeft,
          status:       daysLeft < 0 ? 'vencido' : daysLeft === 0 ? 'vence_hoy' : daysLeft <= 3 ? 'crítico' : 'por_vencer',
          value_risk:   Math.round(s.current_qty * (s.cost_per_unit ?? 0)),
        }
      })
      return { within_days: days, total: items.length, items }
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

    case 'get_dte_folios': {
      const { data: cafs } = await supabase
        .from('dte_cafs')
        .select('document_type, folio_desde, folio_hasta, folio_actual, expires_at, status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')

      const DOC_NAMES: Record<number, string> = {
        33: 'Factura electrónica',
        39: 'Boleta electrónica',
        41: 'Boleta exenta',
        56: 'Nota de débito',
        61: 'Nota de crédito',
      }

      const now = new Date()
      const byType: Record<number, { available: number; cafs: unknown[] }> = {}

      for (const caf of (cafs ?? []) as Array<{ document_type: number; folio_desde: number; folio_hasta: number; folio_actual: number; expires_at: string | null; status: string }>) {
        const expired = caf.expires_at ? new Date(caf.expires_at) <= now : false
        const available = expired ? 0 : Math.max(0, caf.folio_hasta - caf.folio_actual + 1)
        if (!byType[caf.document_type]) byType[caf.document_type] = { available: 0, cafs: [] }
        byType[caf.document_type].available += available
        byType[caf.document_type].cafs.push({
          folio_desde:  caf.folio_desde,
          folio_hasta:  caf.folio_hasta,
          folio_actual: caf.folio_actual,
          available,
          expires_at:   caf.expires_at,
          expired,
        })
      }

      const summary = Object.entries(byType).map(([type, data]) => ({
        document_type: Number(type),
        document_name: DOC_NAMES[Number(type)] ?? `Tipo ${type}`,
        available_folios: data.available,
        alert: data.available < 9 ? 'crítico' : data.available < 50 ? 'bajo' : 'ok',
        cafs: data.cafs,
      }))

      return {
        folios_by_type: summary,
        total_types_configured: summary.length,
        has_critical: summary.some(s => s.alert === 'crítico'),
      }
    }

    case 'get_dte_summary': {
      const start = String(input.start_date ?? ymd(new Date()))
      const end   = String(input.end_date   ?? ymd(new Date()))

      const { data: emissions } = await supabase
        .from('dte_emissions')
        .select('document_type, folio, status, total_amount, emitted_at, error_detail')
        .eq('restaurant_id', restaurantId)
        .gte('emitted_at', startOf(start))
        .lte('emitted_at', endOf(end))
        .order('emitted_at', { ascending: false })

      type E = { document_type: number; folio: number; status: string; total_amount: number; emitted_at: string; error_detail: string | null }
      const rows = (emissions ?? []) as E[]

      const DOC_NAMES: Record<number, string> = {
        33: 'Factura', 39: 'Boleta', 41: 'Boleta exenta', 56: 'Nota débito', 61: 'Nota crédito',
      }

      const total_emitted   = rows.length
      const total_amount    = rows.reduce((s, e) => s + (e.total_amount ?? 0), 0)
      const accepted        = rows.filter(e => e.status === 'accepted').length
      const rejected        = rows.filter(e => e.status === 'rejected').length
      const pending         = rows.filter(e => ['pending', 'signed', 'sent', 'draft'].includes(e.status)).length
      const cancelled       = rows.filter(e => e.status === 'cancelled').length

      const by_type = Object.entries(
        rows.reduce<Record<number, { count: number; amount: number }>>((acc, e) => {
          if (!acc[e.document_type]) acc[e.document_type] = { count: 0, amount: 0 }
          acc[e.document_type].count++
          acc[e.document_type].amount += e.total_amount ?? 0
          return acc
        }, {})
      ).map(([type, data]) => ({
        document_type: Number(type),
        document_name: DOC_NAMES[Number(type)] ?? `Tipo ${type}`,
        count:  data.count,
        amount: data.amount,
      }))

      return {
        range: { start, end },
        total_emitted,
        total_amount,
        currency: 'CLP',
        by_status: { accepted, rejected, pending, cancelled },
        by_type,
        has_rejections: rejected > 0,
      }
    }

    case 'get_dte_rejections': {
      const limit = Number(input.limit ?? 10)

      const { data: emissions } = await supabase
        .from('dte_emissions')
        .select('document_type, folio, status, total_amount, emitted_at, error_detail, sii_response')
        .eq('restaurant_id', restaurantId)
        .in('status', ['rejected', 'cancelled'])
        .order('emitted_at', { ascending: false })
        .limit(limit)

      type E = { document_type: number; folio: number; status: string; total_amount: number; emitted_at: string; error_detail: string | null; sii_response: unknown }
      const rows = (emissions ?? []) as E[]

      const DOC_NAMES: Record<number, string> = {
        33: 'Factura', 39: 'Boleta', 41: 'Boleta exenta', 56: 'Nota débito', 61: 'Nota crédito',
      }

      if (rows.length === 0) {
        return { message: 'No hay documentos rechazados o cancelados. ¡Todo en orden con el SII! ✅', rejections: [] }
      }

      return {
        total_rejections: rows.length,
        rejections: rows.map(e => ({
          document_type: e.document_type,
          document_name: DOC_NAMES[e.document_type] ?? `Tipo ${e.document_type}`,
          folio:         e.folio,
          status:        e.status,
          total_amount:  e.total_amount,
          emitted_at:    e.emitted_at,
          error_detail:  e.error_detail ?? 'Sin detalle disponible',
        })),
      }
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

    // Si ningún provider está configurado, devolvé error claro
    const providers = aiProviderStatus()
    const anyConfigured = providers.some(p => p.configured)
    if (!anyConfigured) {
      return NextResponse.json(
        {
          error: 'Chapi no está disponible temporalmente.',
          hint:  'Configurá ANTHROPIC_API_KEY, OPENAI_API_KEY o GOOGLE_AI_API_KEY en Vercel.',
          providers,
        },
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
    const client = apiKey ? new Anthropic({ apiKey }) : null

    // Seed the Anthropic message list from the client conversation
    const messages: Anthropic.Messages.MessageParam[] = body.messages.map(m => ({
      role:    m.role,
      content: m.content,
    }))

    const systemPrompt = `Eres Chapi, el asistente nativo del panel de HiChapi para restaurantes chilenos.
Respondes en español chileno claro y directo. Tienes dos modos de trabajo y eliges el correcto según la pregunta:

MODO 1 — DATOS DEL NEGOCIO (usa herramientas)
Cuando te pregunten sobre ventas, platos, reseñas, stock o caja, SIEMPRE usa las herramientas disponibles para traer datos reales.
- Cuando la pregunta implica "hoy", usa ${today} como rango.
- Cuando dicen "esta semana", usa los últimos 7 días desde ${today}.
- Cuando dicen "este mes", usa desde el día 1 del mes actual hasta ${today}.
- Formatea montos en pesos chilenos con el símbolo $ y separadores (ej: $54.200).
- Si una herramienta devuelve cero datos, dilo claramente en vez de inventar.
- NUNCA inventes números.

MODO 2 — AYUDA CON EL PANEL (responde directo, sin herramientas)
Cuando te pregunten "cómo hago X" o "dónde está Y" en el panel, responde directamente con instrucciones paso a paso.
Conoces estas secciones del panel:

OPERACIÓN
- Dashboard: métricas en vivo (ventas, pedidos, top platos).
- Garzón (/garzon): vista compacta para móvil con todas las mesas y sus estados.
- Comandas (/comandas): kitchen display tipo Kanban (Recibida → En cocina → Lista → Entregada).
- Mesas (/mesas): grid de mesas con QR. Permite agregar, dividir (⋮ → Dividir), unir y eliminar.
- Carta digital (/carta): platos con categoría, precio, tags, destino (cocina/barra/sin prep). Importación masiva por foto/PDF/Excel.

INVENTARIO
- Stock (/stock): insumos con stock actual, mínimo, costo y fecha de vencimiento. Alertas de bajo stock e insumos por vencer.
- Mermas (/mermas): registro de pérdidas.
- Si tienes insumos próximos a vencer, sugiere proactivamente platos de la carta cuyos ingredientes prioricen esos insumos (usa get_expiring_stock + menu_items).
- Turnos (/turnos): planificación de horarios.
- Caja (/caja): apertura/cierre de sesión, total cash + digital, diferencia.
- DTE Chile (/dte): boletas y facturas electrónicas SII. Puedes consultar folios disponibles, emisiones y rechazos con las herramientas get_dte_folios, get_dte_summary y get_dte_rejections.
- Impresoras (/impresoras): configuración de impresoras térmicas.

INTELIGENCIA
- Reporte del día (/reporte): resumen diario.
- Analytics (/analytics): tendencias y comparativos.
- Chapi Insights (/insights): chat completo conmigo en pantalla grande.

CONFIGURACIÓN
- Equipo (/equipo): invitar miembros con roles (admin/supervisor/garzón/cocina/anfitrión). Multi-rol soportado.
- Mi restaurante (/restaurante): perfil público, foto, descripción, tags Airbnb-style, horarios.
- Módulos y Plan (/modulos): plan Free/Starter/Pro/Enterprise.
- Integraciones (/integraciones): PedidosYa, Rappi, Uber Eats, Justo, DiDi Food, Cornershop. Pegar Store/Merchant ID + API key.
- Tono de Chapi (/tono): personalizar la voz del asistente público.

REGLAS GENERALES
- Sé conciso: 2-4 oraciones cuando sea posible. Usa bullets para listas o pasos.
- Cuando expliques "cómo hacer algo", da los pasos numerados con la ruta del menú.
- Cuando los datos muestren algo notable (crecimiento, caída, anomalía), destácalo en una línea extra.
- Si la pregunta es ambigua entre datos y ayuda, pregúntale al usuario qué prefiere.

Hoy es ${today}.`

    const toolLog: Array<{ tool: string; input: unknown }> = []

    // ── Fallback path: si Claude no está configurado, degradamos a plain chat ──
    // (sin acceso a tools, pero el usuario igual puede conversar)
    if (!client) {
      try {
        const result = await chatCompletion({
          system:
            systemPrompt +
            '\n\nNOTA: estás corriendo en modo fallback sin acceso a datos en vivo. ' +
            'Cuando el usuario pida métricas (ventas, stock, caja, reseñas), avisá ' +
            'amablemente que el servicio principal de IA está temporalmente no disponible ' +
            'y sugerí reintentar en unos minutos, o revisar los datos directamente en el panel.',
          messages: body.messages.map(m => ({ role: m.role, content: m.content })),
          maxTokens: 800,
        })
        return NextResponse.json({
          reply:      result.text,
          tools_used: [],
          ai_provider: result.provider,
          ai_fallback: result.fallback,
        })
      } catch (fallbackErr) {
        if (fallbackErr instanceof AiUnavailableError) {
          return NextResponse.json(
            {
              error: 'Todos los proveedores de IA están temporalmente no disponibles.',
              hint:  'Reintentá en unos minutos. Si persiste, contactá soporte@hichapi.com',
              attempts: fallbackErr.attempts,
            },
            { status: 503 }
          )
        }
        throw fallbackErr
      }
    }

    // Tool-use loop
    for (let round = 0; round < MAX_ROUNDS; round++) {
      let response: Anthropic.Messages.Message
      try {
        response = await client.messages.create({
          model:       MODEL,
          max_tokens:  2048,
          system:      systemPrompt,
          tools:       TOOLS,
          messages,
        })
      } catch (claudeErr) {
        // Claude falló mitad de loop — si es el primer round, caemos a fallback
        console.error(`[ai] Claude tool-use call failed on round ${round}:`, claudeErr)
        if (round === 0) {
          try {
            const result = await chatCompletion({
              system:
                systemPrompt +
                '\n\nNOTA: el servicio principal falló; respondés sin acceso a tools. ' +
                'Si el usuario pide métricas, invítalo a revisarlas en el panel y reintentar en minutos.',
              messages: body.messages.map(m => ({ role: m.role, content: m.content })),
              maxTokens: 800,
            })
            return NextResponse.json({
              reply:       result.text,
              tools_used:  [],
              ai_provider: result.provider,
              ai_fallback: true,
              warning:     'Modo degradado: el proveedor principal falló, respuesta sin acceso a datos en vivo.',
            })
          } catch (fbErr) {
            if (fbErr instanceof AiUnavailableError) {
              return NextResponse.json(
                {
                  error: 'No podemos responder ahora. Todos los proveedores de IA fallaron.',
                  hint:  'Reintentá en 1-2 minutos.',
                  attempts: fbErr.attempts,
                },
                { status: 503 }
              )
            }
            throw fbErr
          }
        }
        // En rounds intermedios con tools ya ejecutadas: devolvemos lo que hay
        return NextResponse.json({
          reply:   'Tuvimos un problema procesando tu pregunta. Por favor reintentá.',
          tools_used: toolLog,
          warning: 'Interrupción mid-loop',
        })
      }

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
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json(
      {
        error: 'Chapi tuvo un problema respondiendo. Reintentá en un momento.',
        detail: msg,
      },
      { status: 500 }
    )
  }
}
