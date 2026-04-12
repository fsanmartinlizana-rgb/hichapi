import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── Schemas ──────────────────────────────────────────────────────────────────

const Platform = z.enum(['pedidosya', 'rappi', 'uber_eats', 'justo', 'didi_food', 'cornershop'])

const UpsertSchema = z.object({
  restaurant_id: z.string().uuid(),
  platform:      Platform,
  external_id:   z.string().nullish(),
  api_key:       z.string().nullish(),
  auto_sync_menu: z.boolean().optional(),
  status:        z.enum(['disconnected', 'pending', 'connected', 'error']).optional(),
})

// ── GET /api/delivery-integrations?restaurant_id=… ──────────────────────────

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('delivery_integrations')
    .select('id, platform, status, external_id, api_key_hint, auto_sync_menu, last_sync_at, updated_at')
    .eq('restaurant_id', restaurantId)
    .order('platform')

  if (error) {
    // Fallback: if the table doesn't exist yet (migration pending), return empty list
    // so the UI still works. Any other error is a real problem.
    const msg = (error.message ?? '').toLowerCase()
    const code = (error as { code?: string }).code ?? ''
    if (
      code === '42P01' ||
      code === 'PGRST205' ||
      msg.includes('does not exist') ||
      msg.includes('could not find the table')
    ) {
      return NextResponse.json({ integrations: [], migration_pending: true })
    }
    console.error('delivery-integrations GET:', error)
    return NextResponse.json({ error: 'Error al consultar' }, { status: 500 })
  }

  return NextResponse.json({ integrations: data ?? [] })
}

// ── POST /api/delivery-integrations — upsert ────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = UpsertSchema.parse(await req.json())

    const { error: authError } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin', 'super_admin'])
    if (authError) return authError

    const supabase = createAdminClient()

    // Never store the full API key. Keep only the last 4 chars for UI hints.
    const hint = body.api_key ? `••••${body.api_key.slice(-4)}` : null
    const status = body.status
      ?? (body.api_key ? 'connected' : body.external_id ? 'pending' : 'disconnected')

    // Upsert
    const { data: existing } = await supabase
      .from('delivery_integrations')
      .select('id')
      .eq('restaurant_id', body.restaurant_id)
      .eq('platform', body.platform)
      .maybeSingle()

    if (existing) {
      const { data, error } = await supabase
        .from('delivery_integrations')
        .update({
          external_id:    body.external_id ?? null,
          api_key_hint:   hint,
          auto_sync_menu: body.auto_sync_menu ?? false,
          status,
          updated_at:     new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ integration: data })
    }

    const { data, error } = await supabase
      .from('delivery_integrations')
      .insert({
        restaurant_id:  body.restaurant_id,
        platform:       body.platform,
        external_id:    body.external_id ?? null,
        api_key_hint:   hint,
        auto_sync_menu: body.auto_sync_menu ?? false,
        status,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ integration: data }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('delivery-integrations POST:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE /api/delivery-integrations — disconnect ──────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { restaurant_id, platform } = z.object({
      restaurant_id: z.string().uuid(),
      platform:      Platform,
    }).parse(await req.json())

    const { error: authError } = await requireRestaurantRole(restaurant_id, ['owner', 'admin', 'super_admin'])
    if (authError) return authError

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('delivery_integrations')
      .delete()
      .eq('restaurant_id', restaurant_id)
      .eq('platform', platform)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
