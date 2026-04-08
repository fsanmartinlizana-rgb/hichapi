import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// ── Route access by role ──────────────────────────────────────────────────────
// Routes requiring authentication (any role)
const PROTECTED = [
  '/dashboard', '/comandas', '/mesas', '/carta',
  '/reporte', '/analytics', '/insights', '/restaurante',
  '/tono', '/garzon', '/mermas', '/stock', '/turnos',
]

// Routes only accessible to admin/owner/super_admin
const ADMIN_ONLY = ['/carta', '/reporte', '/analytics', '/restaurante', '/tono', '/mermas', '/stock', '/turnos']

// Routes only for unauthenticated users
const AUTH_ONLY = ['/login', '/register', '/recuperar']

// Roles that count as "admin level"
const ADMIN_ROLES = new Set(['owner', 'admin', 'super_admin'])

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh and validate session JWT
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  const isAuthOnly  = AUTH_ONLY.some(p => pathname.startsWith(p))
  const isAdminOnly = ADMIN_ONLY.some(p => pathname.startsWith(p))

  // Not authenticated → redirect to login
  if (isProtected && !user) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Already logged in → redirect away from auth pages
  if (isAuthOnly && user) {
    const dashUrl = req.nextUrl.clone()
    dashUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashUrl)
  }

  // Fetch role + restaurant_id from team_members for authenticated users
  if (user && isProtected) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('role, restaurant_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    const role           = membership?.role ?? null
    const restaurantId   = membership?.restaurant_id ?? null
    const isSuperAdmin   = role === 'super_admin'
    const isAdminLevel   = role ? ADMIN_ROLES.has(role) : false

    // Admin-only routes: redirect garzon/waiter/supervisor to /garzon
    if (isAdminOnly && !isAdminLevel && !isSuperAdmin) {
      const fallback = req.nextUrl.clone()
      fallback.pathname = '/garzon'
      return NextResponse.redirect(fallback)
    }

    // Propagate role and restaurant context downstream via headers
    // Server components can read these via headers()
    res = NextResponse.next({ request: req })
    res.headers.set('x-user-role', role ?? '')
    res.headers.set('x-restaurant-id', restaurantId ?? '')
    res.headers.set('x-user-id', user.id)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/).*)',
  ],
}
