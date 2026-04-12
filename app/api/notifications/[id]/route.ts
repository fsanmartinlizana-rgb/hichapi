/**
 * /api/notifications/[id]
 *   PATCH  — mark read / resolved
 *   DELETE — dismiss permanently (rare; expiry will purge automatically)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'

const PatchSchema = z.object({
  is_read:  z.boolean().optional(),
  resolved: z.boolean().optional(),
})

async function loadAndAuthorize(notificationId: string, userId: string) {
  const supabase = createAdminClient()
  const { data: notif } = await supabase
    .from('notifications')
    .select('id, restaurant_id')
    .eq('id', notificationId)
    .maybeSingle()
  if (!notif) return { ok: false as const, status: 404, error: 'No encontrada' }

  const { data: member } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', userId)
    .eq('restaurant_id', notif.restaurant_id)
    .eq('active', true)
    .maybeSingle()
  if (member) return { ok: true as const, supabase, notif }

  const { data: superMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .eq('active', true)
    .maybeSingle()
  if (superMember) return { ok: true as const, supabase, notif }

  return { ok: false as const, status: 403, error: 'Acceso denegado' }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await requireUser()
    if (authError || !user) return authError ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const data = PatchSchema.parse(body)

    const auth = await loadAndAuthorize(id, user.id)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const update: Record<string, unknown> = {}
    if (data.is_read !== undefined) {
      update.is_read = data.is_read
      update.read_at = data.is_read ? new Date().toISOString() : null
    }
    if (data.resolved !== undefined) {
      update.resolved_at = data.resolved ? new Date().toISOString() : null
      // Auto-mark read when resolving
      if (data.resolved && data.is_read === undefined) {
        update.is_read = true
        update.read_at = new Date().toISOString()
      }
    }

    const { data: updated, error: dbErr } = await auth.supabase
      .from('notifications')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()

    if (dbErr) {
      console.error('[notifications PATCH] db error', dbErr)
      return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 })
    }

    return NextResponse.json({ notification: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('[notifications PATCH] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await requireUser()
    if (authError || !user) return authError ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await ctx.params
    const auth = await loadAndAuthorize(id, user.id)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { error: dbErr } = await auth.supabase.from('notifications').delete().eq('id', id)
    if (dbErr) {
      console.error('[notifications DELETE] db error', dbErr)
      return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications DELETE] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
