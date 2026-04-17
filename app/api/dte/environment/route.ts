export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  GET/PATCH /api/dte/environment
//
//  Allows restaurant owners to view and change the DTE environment between
//  certification and production.
//
//  GET  — returns current dte_environment value
//  PATCH — updates dte_environment (owner only)
// ══════════════════════════════════════════════════════════════════════════════

const PatchSchema = z.object({
  restaurant_id:   z.string().uuid(),
  dte_environment: z.enum(['certification', 'production']),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data: rest } = await supabase
    .from('restaurants')
    .select('dte_environment')
    .eq('id', restaurantId)
    .maybeSingle()

  if (!rest) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ dte_environment: rest.dte_environment })
}

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  const { error: updateErr } = await supabase
    .from('restaurants')
    .update({ dte_environment: body.dte_environment })
    .eq('id', body.restaurant_id)

  if (updateErr) {
    console.error('dte/environment update error:', updateErr)
    return NextResponse.json({ error: 'No se pudo actualizar el ambiente' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, dte_environment: body.dte_environment })
}
