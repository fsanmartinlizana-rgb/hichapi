/**
 * POST /api/notifications/mark-all-read
 * Marks every unread notification of a restaurant as read.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'

const Schema = z.object({ restaurant_id: z.string().uuid() })

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireUser()
    if (authError || !user) return authError ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { restaurant_id } = Schema.parse(body)

    const supabase = createAdminClient()

    // Membership check
    const { data: member } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurant_id)
      .eq('active', true)
      .maybeSingle()
    const { data: superMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .eq('active', true)
      .maybeSingle()
    if (!member && !superMember) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { error: dbErr } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('restaurant_id', restaurant_id)
      .eq('is_read', false)

    if (dbErr) {
      console.error('[notifications mark-all-read] db error', dbErr)
      return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('[notifications mark-all-read] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
