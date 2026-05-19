/**
 * Auth guard helpers for API routes.
 * Supports both cookie-based auth (web) and Bearer token auth (mobile app).
 */
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { canAccessModule } from '@/lib/plans'
import type { RiderProfile } from '@/lib/delivery/types'
import { createAdminClient } from './server'

/** Returns the authenticated user or an error response.
 *  Supports both cookie-based auth (web) and Bearer token auth (mobile app).
 */
export async function requireUser() {
  // 1. Try Bearer token from Authorization header (mobile app)
  const headerStore = await headers()
  const authHeader = headerStore.get('authorization') ?? headerStore.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (user && !error) {
      return { user, error: null }
    }
  }

  // 2. Fall back to cookie-based auth (web)
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

  // Use admin client to bypass RLS for role check (trusted server operation)
  const supabase = createAdminClient()

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

/**
 * Gate an API route by the restaurant's subscription plan.
 */
export async function requirePlan(
  restaurantId: string,
  requiredPlan: 'free' | 'starter' | 'pro' | 'enterprise',
) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )

  const { data: rest } = await supabase
    .from('restaurants')
    .select('plan')
    .eq('id', restaurantId)
    .maybeSingle<{ plan: string | null }>()

  const currentPlan = rest?.plan ?? 'free'
  if (!canAccessModule(currentPlan, requiredPlan)) {
    return {
      plan: currentPlan,
      error: NextResponse.json(
        { error: `Esta funcionalidad requiere plan ${requiredPlan} o superior`, currentPlan, requiredPlan },
        { status: 402 },
      ),
    }
  }
  return { plan: currentPlan, error: null }
}

/** Returns the authenticated rider profile, or an error response.
 *  Requires a valid authenticated user with an associated rider_profiles row.
 *  Requirement: 8.5
 */
export async function requireRider(): Promise<
  { rider: RiderProfile; error: null } | { rider: null; error: NextResponse }
> {
  const { user, error } = await requireUser()
  if (error || !user) {
    return {
      rider: null,
      error: error ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    }
  }

  const supabase = createAdminClient()

  const { data: rider } = await supabase
    .from('rider_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!rider) {
    return {
      rider: null,
      error: NextResponse.json({ error: 'Perfil de rider no encontrado' }, { status: 403 }),
    }
  }

  return { rider: rider as RiderProfile, error: null }
}
