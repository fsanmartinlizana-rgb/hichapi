import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/support/tickets/[id]/context
//
// Carga el contexto completo del restaurante que abrió un ticket, para que
// el founder no tenga que andar buscando datos en otras pestañas.
//
// Devuelve:
//   • restaurant: nombre, plan, days_since_signup, last_login, active
//   • activity:   orders_total, orders_last_7d, menu_items_count
//   • previous_tickets: array de tickets cerrados de ese restaurant (top 10)
//
// Auth: solo super_admin (mismo patrón que /api/admin/support/tickets).
// Sprint 1.7. La respuesta sugerida con LLM vive en /suggest-reply.
// ─────────────────────────────────────────────────────────────────────────────

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

/**
 * Auth dual:
 *  • header `x-admin-secret` válido → founder dashboard (/admin/dashboard)
 *  • cookie supabase + role super_admin → panel /plataforma/*
 */
async function authorize(req: NextRequest): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const adminSecret = process.env.ADMIN_SECRET
  if (adminSecret && adminSecret.length >= 20 && req.headers.get('x-admin-secret') === adminSecret) {
    return { ok: true }
  }
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) {
    return { ok: false, res: authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  if (!(await ensureSuperAdmin(user.id))) {
    return { ok: false, res: NextResponse.json({ error: 'Solo super admin' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(req)
  if (!auth.ok) return auth.res

  const { id: ticketId } = await params

  // 1. Cargar el ticket para extraer el restaurant_id y el creador
  const { data: ticket, error: tErr } = await supabase
    .from('support_tickets')
    .select('id, restaurant_id, created_by, created_at')
    .eq('id', ticketId)
    .maybeSingle()

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
  if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

  if (!ticket.restaurant_id) {
    return NextResponse.json({
      ticket_id:   ticketId,
      restaurant:  null,
      activity:    null,
      previous_tickets: [],
      note:        'Ticket sin restaurant_id asociado.',
    })
  }

  // 2. Restaurant info
  const { data: rest } = await supabase
    .from('restaurants')
    .select('id, name, slug, plan, active, created_at, neighborhood')
    .eq('id', ticket.restaurant_id)
    .maybeSingle()

  // 3. Last login del creador del ticket (auth.users.last_sign_in_at)
  let lastLoginIso: string | null = null
  if (ticket.created_by) {
    try {
      const { data } = await supabase.auth.admin.getUserById(ticket.created_by)
      lastLoginIso = data?.user?.last_sign_in_at ?? null
    } catch {
      // best-effort
    }
  }

  // 4. Activity: órdenes total, últimos 7 días, menu items
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString()

  const [ordersTotalRes, ordersWeekRes, menuRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', ticket.restaurant_id),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', ticket.restaurant_id)
      .gte('created_at', since7d),
    supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', ticket.restaurant_id),
  ])

  const ordersTotal = ordersTotalRes.count ?? 0
  const ordersWeek  = ordersWeekRes.count ?? 0
  const menuCount   = menuRes.count ?? 0

  // 5. Tickets previos (no este, mismos restaurant_id, top 10 más recientes)
  const { data: previous } = await supabase
    .from('support_tickets')
    .select('id, subject, status, severity, priority, created_at')
    .eq('restaurant_id', ticket.restaurant_id)
    .neq('id', ticketId)
    .order('created_at', { ascending: false })
    .limit(10)

  // 6. Computed: días desde signup
  const daysSinceSignup = rest?.created_at
    ? Math.floor((Date.now() - new Date(rest.created_at).getTime()) / 86400000)
    : null

  const daysSinceLastLogin = lastLoginIso
    ? Math.floor((Date.now() - new Date(lastLoginIso).getTime()) / 86400000)
    : null

  return NextResponse.json({
    ticket_id: ticketId,
    restaurant: rest ? {
      id:                  rest.id,
      name:                rest.name,
      slug:                rest.slug,
      plan:                rest.plan,
      active:              rest.active,
      neighborhood:        rest.neighborhood,
      created_at:          rest.created_at,
      days_since_signup:   daysSinceSignup,
      last_login_at:       lastLoginIso,
      days_since_login:    daysSinceLastLogin,
    } : null,
    activity: {
      orders_total:     ordersTotal,
      orders_last_7d:   ordersWeek,
      menu_items_count: menuCount,
    },
    previous_tickets: (previous ?? []).map(t => ({
      id:         t.id,
      subject:    t.subject,
      status:     t.status,
      severity:   t.severity,
      priority:   t.priority,
      created_at: t.created_at,
    })),
  })
}
