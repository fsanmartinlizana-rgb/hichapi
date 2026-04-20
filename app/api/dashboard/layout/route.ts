import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── /api/dashboard/layout ────────────────────────────────────────────────────
// GET    ?restaurant_id=X  → devuelve el layout del user para ese restaurant
// PUT    body: { restaurant_id, widgets: [...] } → upsert

const WidgetSchema = z.object({
  id:     z.string(),
  type:   z.string(),
  x:      z.number().int().min(0),
  y:      z.number().int().min(0),
  w:      z.number().int().min(1).max(12),
  h:      z.number().int().min(1).max(12),
  config: z.record(z.string(), z.unknown()).optional(),
})

const PutSchema = z.object({
  restaurant_id: z.string().uuid(),
  widgets:       z.array(WidgetSchema).max(50),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { user, error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('dashboard_layouts')
    .select('widgets, updated_at')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ widgets: (data?.widgets as unknown[]) ?? [], updated_at: data?.updated_at ?? null })
}

export async function PUT(req: NextRequest) {
  let body: z.infer<typeof PutSchema>
  try {
    body = PutSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { user, error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin', 'supervisor'])
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('dashboard_layouts')
    .upsert({
      restaurant_id: body.restaurant_id,
      user_id:       user.id,
      widgets:       body.widgets,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'restaurant_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
