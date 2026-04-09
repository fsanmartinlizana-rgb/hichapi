/**
 * Auth guard helpers for API routes.
 * Usage:
 *   const { user, error } = await requireUser(req)
 *   if (error) return error
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/** Returns the authenticated user or an error response. */
export async function requireUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    }
  }
  return { user, error: null }
}

/** Returns user + their role for a given restaurant, or an error response. */
export async function requireRestaurantRole(
  restaurantId: string,
  allowedRoles: string[] = ['owner', 'admin', 'supervisor', 'super_admin'],
) {
  const { user, error } = await requireUser()
  if (error || !user) return { user: null, role: null, error: error ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )

  const { data: member } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .maybeSingle()

  // super_admin via ANY restaurant membership
  const { data: superMember } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'super_admin')
    .eq('active', true)
    .maybeSingle()

  const role = member?.role ?? superMember?.role ?? null

  if (!role || !allowedRoles.includes(role)) {
    return {
      user: null, role: null,
      error: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }),
    }
  }

  return { user, role, error: null }
}
