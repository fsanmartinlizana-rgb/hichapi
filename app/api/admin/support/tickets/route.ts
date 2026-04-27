import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'

// ── /api/admin/support/tickets ──────────────────────────────────────────────
// Panel de bandeja de tickets para super_admin. Solo super_admin puede leer
// (usamos la policy support_super_admin_all de migration 052) pero además
// acá chequeamos defensivamente que el user sea super_admin antes de operar.
//
// GET  ?status=all|open|investigating|resolved  → listado con paginación
// PATCH body: { id, status?, priority?, assigned_to?, resolution? } → update

const UpdateSchema = z.object({
  id:          z.string().uuid(),
  status:      z.enum(['open', 'investigating', 'resolved', 'wont_fix']).optional(),
  priority:    z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  resolution:  z.string().max(2000).nullable().optional(),
})

async function ensureSuperAdmin(userId: string) {
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

/**
 * Auth dual: x-admin-secret header (founder dashboard) o cookie super_admin.
 */
async function authorize(req: NextRequest): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const adminSecret = process.env.ADMIN_SECRET
  if (adminSecret && adminSecret.length >= 20 && req.headers.get('x-admin-secret') === adminSecret) {
    return { ok: true }
  }
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) return { ok: false, res: authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  if (!(await ensureSuperAdmin(user.id))) return { ok: false, res: NextResponse.json({ error: 'Solo super admin' }, { status: 403 }) }
  return { ok: true }
}

export async function GET(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!(await ensureSuperAdmin(user.id))) {
    return NextResponse.json({ error: 'Solo super admin' }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'open'
  const supabase = createAdminClient()

  let q = supabase
    .from('support_tickets')
    .select('id, subject, description, severity, priority, status, assigned_to, ai_analysis, restaurant_id, user_id, page_url, plan_at_open, created_at, updated_at, resolved_at, restaurants(name, slug)')
    .order('priority', { ascending: false })  // urgent primero
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') q = q.eq('status', status)

  const { data } = await q
  return NextResponse.json({ tickets: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const auth = await authorize(req)
  if (!auth.ok) return auth.res

  let body: z.infer<typeof UpdateSchema>
  try {
    body = UpdateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { id, ...patch } = body
  const updates: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }
  if (patch.status === 'resolved' || patch.status === 'wont_fix') {
    updates.resolved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ticket: data })
}
