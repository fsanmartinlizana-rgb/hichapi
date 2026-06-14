import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── POST /api/me/memberships/leave ───────────────────────────────────────────
// El usuario sale voluntariamente de un restaurante en el que tenía membership.
// Hace soft-delete (active=false) para preservar historial; no borra el row.
//
// Regla crítica: si el usuario es el ÚNICO owner activo del restaurante, NO
// puede salir — quedaría sin propietario y sin nadie que pueda eliminar
// futuras memberships. Tiene que transferir ownership antes o el restaurante
// debe darse de baja.

const BodySchema = z.object({
  restaurant_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) {
    return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { restaurant_id } = BodySchema.parse(await req.json())
    const supabase = createAdminClient()

    // 1. Buscar la membership del usuario en este restaurante
    const { data: mine, error: mineErr } = await supabase
      .from('team_members')
      .select('id, role, active')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurant_id)
      .eq('active', true)
      .maybeSingle()

    if (mineErr) {
      return NextResponse.json({ error: 'Error consultando tu membresía' }, { status: 500 })
    }
    if (!mine) {
      return NextResponse.json({ error: 'No tenés membresía activa en este restaurante' }, { status: 404 })
    }

    // 2. Si soy owner, verificar que NO sea el único owner activo. Si lo soy,
    //    bloqueo la salida: el restaurante quedaría huérfano. El usuario debe
    //    transferir ownership o dar de baja el restaurante por otro flujo.
    if ((mine as { role: string }).role === 'owner') {
      const { count } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant_id)
        .eq('role', 'owner')
        .eq('active', true)

      if ((count ?? 0) <= 1) {
        return NextResponse.json({
          error: 'Sos el único propietario activo. Antes de salir necesitás transferir la propiedad a otro miembro o dar de baja el restaurante.',
          code:  'last_owner',
        }, { status: 409 })
      }
    }

    // 3. Soft-delete: dejamos el row para auditoría/historial.
    const { error: updErr } = await supabase
      .from('team_members')
      .update({ active: false, status: 'left' })
      .eq('id', (mine as { id: string }).id)

    if (updErr) {
      console.error('[me/memberships/leave] update error:', updErr.code, updErr.message)
      return NextResponse.json({ error: 'No pudimos actualizar tu membresía' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('[me/memberships/leave] error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
