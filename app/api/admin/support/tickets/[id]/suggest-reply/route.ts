import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireUser } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/support/tickets/[id]/suggest-reply
//
// Genera con Claude una respuesta sugerida al ticket, usando como contexto:
//   • Ticket (asunto + descripción + status + plan)
//   • Restaurant del cliente (plan, antigüedad, last_login)
//   • Activity (orders total/7d, menu_items count)
//   • Tickets previos cerrados del mismo restaurant (para tono coherente)
//
// Devuelve:
//   • reply: string (texto listo para copiar)
//   • category: 'resolvable_now' | 'needs_code_change' | 'needs_call'
//   • reasoning: 1-2 frases explicando por qué clasificó así
//
// Auth: super_admin only.
// Sprint 4.4. Usa Claude Haiku 4.5 (rápido + barato para este uso).
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function ensureSuperAdmin(userId: string) {
  const sb = createAdminClient()
  const { data } = await sb
    .from('team_members')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .eq('active', true)
    .limit(1)
  return (data ?? []).length > 0
}

const SYSTEM_PROMPT = `Eres Chapi, el asistente IA de soporte interno de HiChapi (plataforma SaaS para restaurantes en Chile).

Tu trabajo: el founder revisa un ticket de soporte y vos le sugerís UNA respuesta lista para enviar al dueño del restaurant que abrió el ticket.

REGLAS:
- Tono: cercano, chileno (usá "tú" o "usted" según el caso, sin chilenismos forzados), directo, empático.
- Largo: 2-4 oraciones máximo. Ningún cliente quiere leer tres párrafos.
- Si el ticket pide algo que requiere código nuevo o cambio profundo, dilo honesto: "Lo agregamos a roadmap, te avisamos cuando salga." NO prometas plazos.
- Si el ticket es algo configurable por el cliente (ej: cambiar precio, agregar usuario), guíalo en pasos: "Vas a → tocá X → guardás."
- Si el cliente está enojado, primero validá el problema, después la solución.
- Firmá como "El equipo de HiChapi" (no "Chapi" — confunde).

ADICIONAL: clasificá el ticket en una de 3 categorías:
- "resolvable_now": el founder puede responder/solucionar ya, sin código nuevo (config, explicación, datos).
- "needs_code_change": requiere desarrollo (bug, feature, fix de código).
- "needs_call": requiere llamada (frustración alta, problema complejo, riesgo de churn).

Devolvé SOLO un JSON válido sin markdown ni texto extra:
{"reply": "...", "category": "...", "reasoning": "..."}`

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!(await ensureSuperAdmin(user.id))) {
    return NextResponse.json({ error: 'Solo super admin' }, { status: 403 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY no configurada' },
      { status: 500 },
    )
  }

  const { id: ticketId } = await params

  // 1. Cargar ticket
  const { data: ticket, error: tErr } = await supabase
    .from('support_tickets')
    .select('id, subject, description, status, severity, priority, restaurant_id, plan_at_open')
    .eq('id', ticketId)
    .maybeSingle()

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
  if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

  // 2. Cargar contexto del restaurant (si tiene restaurant_id)
  let restaurantContext = ''
  let activityContext = ''
  if (ticket.restaurant_id) {
    const [restRes, ordersTotalRes, ordersWeekRes, menuRes] = await Promise.all([
      supabase
        .from('restaurants')
        .select('name, plan, active, created_at, neighborhood')
        .eq('id', ticket.restaurant_id)
        .maybeSingle(),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', ticket.restaurant_id),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', ticket.restaurant_id)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabase
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', ticket.restaurant_id),
    ])

    if (restRes.data) {
      const r = restRes.data
      const days = r.created_at
        ? Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)
        : null
      restaurantContext = `Restaurant: ${r.name} (${r.neighborhood ?? '—'}). Plan ${r.plan ?? 'free'}, ${r.active ? 'activo' : 'inactivo'}. Cliente hace ${days ?? '?'} días.`
    }
    activityContext = `Pedidos totales: ${ordersTotalRes.count ?? 0}. Últimos 7d: ${ordersWeekRes.count ?? 0}. Menu items cargados: ${menuRes.count ?? 0}.`
  }

  // 3. Tickets previos cerrados (para tono y patrones)
  const { data: previous } = await supabase
    .from('support_tickets')
    .select('subject, status, created_at')
    .eq('restaurant_id', ticket.restaurant_id ?? '00000000-0000-0000-0000-000000000000')
    .neq('id', ticketId)
    .order('created_at', { ascending: false })
    .limit(3)

  const previousContext = previous && previous.length > 0
    ? `Tickets previos del cliente: ${previous.map(p => `"${p.subject}" (${p.status})`).join(', ')}.`
    : 'Cliente sin tickets previos.'

  // 4. Llamar a Claude
  const userMessage = `TICKET ACTUAL:
Asunto: ${ticket.subject}
Descripción: ${ticket.description ?? '(sin descripción)'}
Severidad: ${ticket.severity ?? '—'} | Prioridad: ${ticket.priority ?? '—'} | Plan al abrir: ${ticket.plan_at_open ?? '—'}

CONTEXTO:
${restaurantContext}
${activityContext}
${previousContext}

Generá la respuesta sugerida.`

  try {
    const response = await anthropic.messages.create({
      model:       'claude-haiku-4-5-20251001',
      max_tokens:  500,
      system:      SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    const raw = textBlock && 'text' in textBlock ? textBlock.text : ''

    // Parsear JSON (tolerante a backticks o prefijos)
    const cleaned = raw.replace(/```(?:json)?/g, '').trim()
    let parsed: { reply?: string; category?: string; reasoning?: string }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Si Claude devolvió texto plano, lo usamos como reply y clasificamos default
      return NextResponse.json({
        reply:     raw.trim(),
        category:  'resolvable_now',
        reasoning: 'Respuesta no estructurada — clasificación por defecto.',
      })
    }

    return NextResponse.json({
      reply:     parsed.reply ?? raw,
      category:  parsed.category ?? 'resolvable_now',
      reasoning: parsed.reasoning ?? '',
    })
  } catch (err) {
    console.error('[suggest-reply] error:', err)
    return NextResponse.json(
      { error: 'No se pudo generar la respuesta sugerida' },
      { status: 500 },
    )
  }
}
