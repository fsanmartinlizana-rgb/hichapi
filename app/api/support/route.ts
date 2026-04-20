import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const TicketSchema = z.object({
  subject:       z.string().min(3).max(200),
  description:   z.string().min(10).max(2000),
  severity:      z.enum(['critical', 'medium', 'low']).default('low'),
  restaurant_id: z.string().uuid().optional(),
  user_id:       z.string().uuid().optional(),
  page_url:      z.string().max(500).optional(),
  screenshot_url: z.string().url().optional(),
})

// ── POST /api/support ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = TicketSchema.parse(body)

    const supabase = createAdminClient()

    // AI triage: basic keyword analysis for severity suggestion
    const aiAnalysis = analyzeTicket(data.subject, data.description)

    // Override severity if AI detects it's more critical than reported
    const finalSeverity = aiAnalysis.suggested_severity === 'critical' && data.severity !== 'critical'
      ? 'critical'
      : data.severity

    // Derivar priority desde el plan del restaurant (enterprise=urgent, etc.)
    // Sprint 4: tickets de enterprise aparecen al tope de la cola del admin.
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
    let plan_at_open: string | null = null
    if (data.restaurant_id) {
      const restRes = await supabase
        .from('restaurants')
        .select('plan')
        .eq('id', data.restaurant_id)
        .maybeSingle()
      const rest = restRes.data as { plan: string | null } | null
      plan_at_open = rest?.plan ?? null
      priority = planToPriority(plan_at_open, finalSeverity)
    } else {
      priority = planToPriority(null, finalSeverity)
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        subject:        data.subject,
        description:    data.description,
        severity:       finalSeverity,
        priority,
        plan_at_open,
        restaurant_id:  data.restaurant_id || null,
        user_id:        data.user_id || null,
        page_url:       data.page_url || null,
        screenshot_url: data.screenshot_url || null,
        ai_analysis:    aiAnalysis,
        status:         'open',
      })
      .select('id, severity, priority')
      .single()

    if (error) {
      console.error('Support ticket error:', error)
      return NextResponse.json({ error: 'No se pudo crear el ticket' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ticket_id: ticket.id,
      severity: ticket.severity,
      message: finalSeverity === 'critical'
        ? 'Ticket crítico creado. Priorizaremos su resolución.'
        : 'Ticket creado. Te contactaremos pronto.',
    }, { status: 201 })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.issues },
        { status: 400 }
      )
    }
    console.error('Support route error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── Priority derivation from plan + severity ───────────────────────────────
// Sprint 4: matriz simple para que tickets de clientes pagos suban en la
// cola. Severidad "critical" del bug analyzer siempre sube la prioridad
// al menos un nivel.

function planToPriority(
  plan: string | null,
  severity: 'critical' | 'medium' | 'low',
): 'low' | 'normal' | 'high' | 'urgent' {
  // Plan → baseline priority
  let base: 'low' | 'normal' | 'high' | 'urgent'
  switch (plan) {
    case 'enterprise': base = 'high';   break
    case 'pro':        base = 'normal'; break
    case 'starter':    base = 'normal'; break
    default:           base = 'low'
  }
  // Severity boost
  if (severity === 'critical') {
    if (base === 'high')   return 'urgent'
    if (base === 'normal') return 'high'
    return 'normal'
  }
  if (severity === 'medium' && base === 'low') return 'normal'
  return base
}

// ── AI Triage (keyword-based, can be replaced with LLM later) ───────────────

function analyzeTicket(subject: string, description: string) {
  const text = `${subject} ${description}`.toLowerCase()

  // Critical keywords: blocking, can't operate, total outage
  const criticalKeywords = [
    'no funciona', 'no puedo', 'caído', 'error 500', 'no carga',
    'bloqueado', 'no abre', 'perdí datos', 'se borraron', 'no se guarda',
    'pantalla blanca', 'no responde', 'todos los restaurantes',
  ]

  // Medium keywords: partial issues
  const mediumKeywords = [
    'lento', 'tarda', 'a veces', 'intermitente', 'error',
    'no actualiza', 'desfasado', 'incorrecto', 'mal cálculo',
  ]

  const hasCritical = criticalKeywords.some(k => text.includes(k))
  const hasMedium = mediumKeywords.some(k => text.includes(k))

  const matchedKeywords = [
    ...criticalKeywords.filter(k => text.includes(k)),
    ...mediumKeywords.filter(k => text.includes(k)),
  ]

  return {
    suggested_severity: hasCritical ? 'critical' : hasMedium ? 'medium' : 'low',
    matched_keywords: matchedKeywords,
    is_potential_bug: hasCritical || hasMedium,
    category: categorizeTicket(text),
    analyzed_at: new Date().toISOString(),
  }
}

function categorizeTicket(text: string): string {
  if (text.match(/comanda|pedido|orden/)) return 'orders'
  if (text.match(/stock|inventario|ingredient/)) return 'inventory'
  if (text.match(/mesa|table/)) return 'tables'
  if (text.match(/pago|caja|cobr/)) return 'payments'
  if (text.match(/carta|menu|plato/)) return 'menu'
  if (text.match(/login|sesión|contraseña|password/)) return 'auth'
  if (text.match(/reporte|analytics|estadística/)) return 'analytics'
  return 'general'
}
