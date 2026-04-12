/**
 * /api/notifications
 *   GET   — list notifications for the active restaurant (last 10 days)
 *   POST  — create a notification (server-side helpers usually preferred)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { createNotification } from '@/lib/notifications/server'

const ListQuerySchema = z.object({
  restaurant_id: z.string().uuid(),
  unread_only:   z.coerce.boolean().optional(),
  limit:         z.coerce.number().int().min(1).max(200).optional().default(50),
})

const CreateSchema = z.object({
  restaurant_id: z.string().uuid(),
  type:          z.string().min(1),
  title:         z.string().min(1).max(200),
  message:       z.string().max(1000).optional(),
  severity:      z.enum(['info','success','warning','critical']).optional(),
  category:      z.enum(['operacion','inventario','caja','dte','equipo','sistema']).optional(),
  action_url:    z.string().max(500).optional(),
  action_label:  z.string().max(80).optional(),
  dedupe_key:    z.string().max(200).optional(),
  metadata:      z.record(z.string(), z.unknown()).optional(),
})

// ── helpers ──────────────────────────────────────────────────────────────────

async function ensureMember(userId: string, restaurantId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data: member } = await supabase
    .from('team_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .maybeSingle()
  if (member) return true

  const { data: superMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .eq('active', true)
    .maybeSingle()
  return !!superMember
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await requireUser()
    if (authError || !user) return authError ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url)
    const params = ListQuerySchema.parse({
      restaurant_id: url.searchParams.get('restaurant_id') ?? '',
      unread_only:   url.searchParams.get('unread_only') ?? undefined,
      limit:         url.searchParams.get('limit') ?? undefined,
    })

    const allowed = await ensureMember(user.id, params.restaurant_id)
    if (!allowed) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const supabase = createAdminClient()

    // Opportunistic purge: cleanup expired rows on every list call (very cheap
    // because of the partial index on expires_at).
    try { await supabase.rpc('purge_expired_notifications') } catch { /* RPC may not exist yet */ }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('restaurant_id', params.restaurant_id)
      .order('created_at', { ascending: false })
      .limit(params.limit)

    if (params.unread_only) query = query.eq('is_read', false)

    const { data: notifications, error: dbErr } = await query
    if (dbErr) {
      console.error('[notifications GET] db error', dbErr)
      return NextResponse.json({ error: 'Error al cargar notificaciones' }, { status: 500 })
    }

    // Unread count for the bell badge
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', params.restaurant_id)
      .eq('is_read', false)

    return NextResponse.json({
      notifications: notifications ?? [],
      unread_count:  unreadCount ?? 0,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: err.issues }, { status: 400 })
    }
    console.error('[notifications GET] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireUser()
    if (authError || !user) return authError ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const data = CreateSchema.parse(body)

    const allowed = await ensureMember(user.id, data.restaurant_id)
    if (!allowed) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const row = await createNotification(data)
    if (!row) return NextResponse.json({ error: 'No se pudo crear la notificación' }, { status: 500 })

    return NextResponse.json({ notification: row }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('[notifications POST] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
