import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── PATCH /api/orders/station ────────────────────────────────────────────────
// Marks all items of a destination ready for an order.
// If all non-'ninguno' items are ready, order advances to 'ready'.
// Otherwise it sits at 'partial_ready'.

const StationReadySchema = z.object({
  order_id:    z.string().uuid(),
  destination: z.enum(['cocina', 'barra']),
})

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = await req.json()
    const { order_id, destination } = StationReadySchema.parse(body)

    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc('mark_station_ready', {
      p_order_id:    order_id,
      p_destination: destination,
    })

    if (error) {
      console.error('mark_station_ready error:', error)
      return NextResponse.json({ error: 'No se pudo marcar listo' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ...data })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('station route error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
