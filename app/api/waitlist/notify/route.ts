import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NotifySchema = z.object({
  entry_id: z.string().uuid(),
  table_id: z.string().uuid().optional(),
  action: z.enum(['notify', 'seat', 'cancel']),
})

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = await req.json()
    const { entry_id, table_id, action } = NotifySchema.parse(body)

    const updates: Record<string, unknown> = {}

    if (action === 'notify') {
      updates.status = 'notified'
      updates.notified_at = new Date().toISOString()
      if (table_id) updates.table_id = table_id
    } else if (action === 'seat') {
      updates.status = 'seated'
      updates.seated_at = new Date().toISOString()
      if (table_id) updates.table_id = table_id
    } else if (action === 'cancel') {
      updates.status = 'cancelled'
    }

    const { error } = await supabase
      .from('waitlist_entries')
      .update(updates)
      .eq('id', entry_id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('waitlist/notify error:', err)
    return NextResponse.json({ error: 'Error al actualizar entrada' }, { status: 500 })
  }
}
