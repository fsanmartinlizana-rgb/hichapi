import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { chatCompletion, AiUnavailableError } from '@/lib/ai/chat'

// ── /api/admin/support/analyze ──────────────────────────────────────────────
// Agente IA que asiste al super admin a resolver tickets.
//
// Sprint 4 (2026-04-19): el super admin recibe un ticket en la bandeja, le
// pone click, y este endpoint recibe el ticket_id + pregunta opcional. El
// agente responde con:
//   • Diagnóstico probable (categorización + posibles causas)
//   • Pasos sugeridos para resolver
//   • Borrador de respuesta al cliente (empático + accionable)
//
// Cada llamada persiste el turno en support_tickets.conversation[]
// para que el super admin pueda revisar el hilo después.

const BodySchema = z.object({
  ticket_id: z.string().uuid(),
  question:  z.string().max(500).optional(),
})

interface ConversationTurn {
  role: 'agent' | 'admin' | 'system'
  text: string
  ts:   string
}

async function ensureSuperAdmin(userId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .eq('active', true)
    .limit(1)
  return (data ?? []).length > 0
}

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!(await ensureSuperAdmin(user.id))) {
    return NextResponse.json({ error: 'Solo super admin' }, { status: 403 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Cargar ticket + conversation previa + contexto mínimo del restaurant
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, subject, description, severity, priority, page_url, ai_analysis, conversation, plan_at_open, restaurant_id, restaurants(name, slug, plan)')
    .eq('id', body.ticket_id)
    .maybeSingle()

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
  }

  const restaurant = (ticket.restaurants as unknown as { name: string; slug: string; plan: string } | null)
  const conversation: ConversationTurn[] = Array.isArray(ticket.conversation)
    ? (ticket.conversation as ConversationTurn[])
    : []

  // Mensaje "admin pregunta" si vino uno, si no analisis inicial
  const adminQuestion = body.question?.trim()

  // ── Construir prompt para el agente ─────────────────────────────────────
  const system = `Sos un agente de soporte técnico experto para HiChapi (SaaS de restaurantes).
Tu trabajo es ayudar al super admin (una sola persona) a resolver tickets rápido y con empatía.

Para cada ticket te pasan:
- Subject y description del cliente
- ai_analysis.category ('orders', 'inventory', 'tables', 'payments', 'menu', 'auth', 'analytics', 'general')
- ai_analysis.matched_keywords
- priority ('urgent', 'high', 'normal', 'low')
- plan del restaurant (free, starter, pro, enterprise)

Respondé SIEMPRE en este formato estructurado (en Markdown, en español de Chile):

## Diagnóstico probable
1-2 frases identificando qué le pasa al cliente, en lenguaje técnico.

## Causa más probable
1-2 frases de la causa técnica (ej. "bug conocido en migration X", "config faltante", "error del usuario que no entendió flow Y").

## Pasos para resolver
Lista numerada, 3-6 pasos concretos que el super admin puede ejecutar. Si involucra SQL, incluí la query. Si involucra cambio de código, decí qué archivo.

## Borrador de respuesta al cliente
Texto directo, empático, sin tecnicismos. Máximo 4 oraciones. Firmá "— Equipo HiChapi".

Sos conciso, no das rodeos. No inventes soluciones si no estás seguro: en ese caso decí "No tengo info suficiente, pedile al cliente [tal dato]".`

  const userPrompt = `TICKET #${ticket.id.slice(0, 8)}
Subject: ${ticket.subject}
Prioridad: ${ticket.priority}
Severidad: ${ticket.severity}
Plan del cliente: ${restaurant?.plan ?? ticket.plan_at_open ?? 'sin info'}
Restaurant: ${restaurant?.name ?? 'N/A'}${restaurant?.slug ? ` (${restaurant.slug})` : ''}
URL donde ocurrió: ${ticket.page_url ?? 'no reportada'}

Categoría AI: ${(ticket.ai_analysis as { category?: string })?.category ?? 'general'}
Keywords detectadas: ${JSON.stringify((ticket.ai_analysis as { matched_keywords?: string[] })?.matched_keywords ?? [])}

=== DESCRIPCIÓN DEL CLIENTE ===
${ticket.description}
=== FIN DESCRIPCIÓN ===

${adminQuestion ? `Pregunta adicional del super admin: ${adminQuestion}` : 'Analizá el ticket y respondé siguiendo el formato.'}`

  try {
    const { text, provider } = await chatCompletion({
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1500,
      temperature: 0.4,
    })

    const now = new Date().toISOString()
    const newTurns: ConversationTurn[] = []
    if (adminQuestion) {
      newTurns.push({ role: 'admin', text: adminQuestion, ts: now })
    }
    newTurns.push({ role: 'agent', text, ts: now })

    // Persistir la respuesta para referencia futura
    await supabase
      .from('support_tickets')
      .update({
        conversation: [...conversation, ...newTurns],
        updated_at:   now,
      })
      .eq('id', body.ticket_id)

    return NextResponse.json({ answer: text, provider, conversation: [...conversation, ...newTurns] })
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json(
        { error: 'IA no disponible', details: err.attempts },
        { status: 503 },
      )
    }
    console.error('support/analyze error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
