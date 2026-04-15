import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  CRUD de custom_roles — S30.9
//  GET    /api/restaurants/custom-roles?restaurant_id=xxx
//  POST   /api/restaurants/custom-roles
//  PATCH  /api/restaurants/custom-roles
//  DELETE /api/restaurants/custom-roles?id=xxx&restaurant_id=xxx
// ══════════════════════════════════════════════════════════════════════════════

const CreateSchema = z.object({
  restaurant_id: z.string().uuid(),
  name:          z.string().trim().min(1).max(40),
  description:   z.string().max(200).optional(),
  permissions:   z.array(z.string().regex(/^[a-z_]+\.[a-z_]+$/)).max(60),
  base_role:     z.enum(['owner','admin','supervisor','garzon','cocina','anfitrion']).optional(),
  color:         z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

const UpdateSchema = z.object({
  id:            z.string().uuid(),
  restaurant_id: z.string().uuid(),
  name:          z.string().trim().min(1).max(40).optional(),
  description:   z.string().max(200).optional(),
  permissions:   z.array(z.string().regex(/^[a-z_]+\.[a-z_]+$/)).max(60).optional(),
  base_role:     z.enum(['owner','admin','supervisor','garzon','cocina','anfitrion']).optional(),
  color:         z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export async function GET(req: NextRequest) {
  const restId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restId) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  const { error: authErr } = await requireRestaurantRole(restId, ['owner','admin','supervisor','super_admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('custom_roles')
    .select('id, name, description, permissions, base_role, color')
    .eq('restaurant_id', restId)
    .order('name')

  if (error) return NextResponse.json({ error: 'No se pudo cargar roles' }, { status: 500 })
  return NextResponse.json({ roles: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CreateSchema>
  try { body = CreateSchema.parse(await req.json()) }
  catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }) }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner','admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('custom_roles')
    .insert({
      restaurant_id: body.restaurant_id,
      name:          body.name,
      description:   body.description ?? null,
      permissions:   body.permissions,
      base_role:     body.base_role ?? null,
      color:         body.color ?? '#6B7280',
    })
    .select('id, name, description, permissions, base_role, color')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya existe un rol con ese nombre' }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo crear rol' }, { status: 500 })
  }
  return NextResponse.json({ role: data })
}

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof UpdateSchema>
  try { body = UpdateSchema.parse(await req.json()) }
  catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }) }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner','admin'])
  if (authErr) return authErr

  const update: Record<string, unknown> = {}
  if (body.name !== undefined)        update.name = body.name
  if (body.description !== undefined) update.description = body.description
  if (body.permissions !== undefined) update.permissions = body.permissions
  if (body.base_role !== undefined)   update.base_role = body.base_role
  if (body.color !== undefined)       update.color = body.color

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('custom_roles')
    .update(update)
    .eq('id', body.id)
    .eq('restaurant_id', body.restaurant_id)
    .select('id, name, description, permissions, base_role, color')
    .single()

  if (error || !data) return NextResponse.json({ error: 'No se pudo actualizar rol' }, { status: 500 })
  return NextResponse.json({ role: data })
}

export async function DELETE(req: NextRequest) {
  const id     = req.nextUrl.searchParams.get('id')
  const restId = req.nextUrl.searchParams.get('restaurant_id')
  if (!id || !restId) return NextResponse.json({ error: 'id y restaurant_id requeridos' }, { status: 400 })

  const { error: authErr } = await requireRestaurantRole(restId, ['owner','admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  // Desasignar miembros que usan este rol antes de borrar
  await supabase
    .from('team_members')
    .update({ custom_role_id: null })
    .eq('restaurant_id', restId)
    .eq('custom_role_id', id)

  const { error } = await supabase
    .from('custom_roles')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restId)

  if (error) return NextResponse.json({ error: 'No se pudo eliminar rol' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
