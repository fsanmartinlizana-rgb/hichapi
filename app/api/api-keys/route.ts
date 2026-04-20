import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole, requirePlan } from '@/lib/supabase/auth-guard'
import { generateKey } from '@/lib/api-keys'

// ── /api/api-keys ───────────────────────────────────────────────────────────
// Gestión interna de API keys del restaurant. NO es la API pública que usan
// los devs externos; es el panel de administración de sus propias keys.
//
// GET     ?restaurant_id=X  → listado (sin secret)
// POST    body: { restaurant_id, name, scopes[], expires_at? } → crea + devuelve secret UNA vez
// DELETE  ?id=...&restaurant_id=X → revoca (soft delete, set revoked_at)

const VALID_SCOPES = [
  'menu:read', 'menu:write',
  'orders:read', 'orders:write',
  'reservations:read', 'reservations:write',
  'stock:read', 'stock:write',
] as const

const CreateSchema = z.object({
  restaurant_id: z.string().uuid(),
  name:          z.string().min(1).max(80),
  scopes:        z.array(z.enum(VALID_SCOPES)).min(1),
  expires_at:    z.string().datetime().optional(),
  rate_limit:    z.number().int().min(60).max(10000).default(1000),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('api_keys')
    .select('id, name, prefix, scopes, rate_limit, last_used_at, expires_at, revoked_at, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ keys: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CreateSchema>
  try {
    body = CreateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { user, error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Feature enterprise
  const { error: planErr } = await requirePlan(body.restaurant_id, 'enterprise')
  if (planErr) return planErr

  const { secret, prefix, secretHash } = generateKey()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      restaurant_id: body.restaurant_id,
      created_by:    user.id,
      name:          body.name,
      prefix,
      secret_hash:   secretHash,
      scopes:        body.scopes,
      rate_limit:    body.rate_limit,
      expires_at:    body.expires_at ?? null,
    })
    .select('id, name, prefix, scopes, rate_limit, expires_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Devolver secret SOLO UNA VEZ. El cliente debe copiarlo ahora.
  return NextResponse.json({ key: data, secret })
}

export async function DELETE(req: NextRequest) {
  const id            = req.nextUrl.searchParams.get('id')
  const restaurantId  = req.nextUrl.searchParams.get('restaurant_id')
  if (!id || !restaurantId) {
    return NextResponse.json({ error: 'id y restaurant_id requeridos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
