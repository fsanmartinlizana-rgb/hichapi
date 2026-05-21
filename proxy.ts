import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// ── Route access config ───────────────────────────────────────────────────────

// Routes that don't require authentication
const PUBLIC_PREFIXES = [
  '/', '/login', '/register', '/recuperar', '/update-password', '/unete', '/r/', '/espera/',
  '/buscar', '/reservar', '/reclamar', '/auth/', '/api/chat', '/api/waitlist', '/api/orders',
  '/api/tables', '/api/menu-features', '/api/stripe', '/api/search-ondemand', '/api/customer/tracking/',
  '/_next/', '/favicon'
]

// Routes that require a customer_profiles record
const CUSTOMER_PREFIXES = ['/cuenta']

// Routes that require a team_members record (restaurant staff)
const PROTECTED = [
  '/dashboard', '/comandas', '/mesas', '/carta', '/garzon',
  '/reporte', '/analytics', '/insights', '/restaurante',
  '/tono', '/mermas', '/stock', '/turnos', '/equipo',
  '/delivery', '/configuracion', '/clientes', '/agregar-sucursal',
  '/caja', '/reservas', '/admin'
]

const AUTH_ONLY  = ['/login', '/register', '/recuperar']
const ADMIN_ONLY = ['/carta', '/reporte', '/analytics', '/restaurante', '/tono', '/mermas', '/stock', '/turnos', '/equipo', '/configuracion', '/agregar-sucursal', '/admin']
const ADMIN_ROLES = new Set(['owner', 'admin', 'super_admin'])

// Where each role lands after login
const ROLE_HOME: Record<string, string> = {
  cocina:      '/comandas',
  anfitrion:   '/mesas',
  garzon:      '/garzon',
  waiter:      '/garzon',
  supervisor:  '/dashboard',
  admin:       '/dashboard',
  owner:       '/dashboard',
  super_admin: '/dashboard',
}

// What each restricted role is allowed to visit
const ROLE_ALLOWED: Record<string, string[]> = {
  cocina:    ['/comandas'],
  anfitrion: ['/mesas', '/garzon', '/dashboard'],
}

function isPublic(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 2 && !PROTECTED.some(p => pathname.startsWith(p)) && !CUSTOMER_PREFIXES.some(p => pathname.startsWith(p))) {
    return true
  }
  return PUBLIC_PREFIXES.some(prefix =>
    prefix === '/' ? pathname === '/' : pathname.startsWith(prefix)
  )
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) {
    return NextResponse.next()
  }

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
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  const isCustomerRoute = CUSTOMER_PREFIXES.some(p => pathname.startsWith(p))
  const isAuthOnly  = AUTH_ONLY.some(p => pathname.startsWith(p))

  if (!user && (isProtected || isCustomerRoute)) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthOnly && user) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── Customer route protection (/cuenta/*) ──────────────────────────────────
  if (isCustomerRoute && user) {
    const { createClient: createAdminSupabase } = await import('@supabase/supabase-js')
    const admin = createAdminSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: customerProfile } = await admin
      .from('customer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!customerProfile) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    res.headers.set('x-user-id', user.id)
    res.headers.set('x-user-role', 'customer')
    return res
  }

  // ── Restaurant staff / Rider route protection ──────────────────────────────────────
  if (isProtected && user) {
    const { createClient: createAdminSupabase } = await import('@supabase/supabase-js')
    const admin = createAdminSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: memberships } = await admin
      .from('team_members')
      .select('role, restaurant_id')
      .eq('user_id', user.id)
      .eq('active', true)

    const list = memberships ?? []
    
    if (list.length === 0) {
      // Check if rider
      const { data: riderProfile } = await admin
        .from('rider_profiles')
        .select('id, status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (riderProfile) {
        res.headers.set('x-user-role', 'rider')
        res.headers.set('x-rider-id', riderProfile.id)
        res.headers.set('x-user-id', user.id)
        return res
      }

      // Check if customer
      const { data: customerProfile } = await admin
        .from('customer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (customerProfile) {
        return NextResponse.redirect(new URL('/cuenta', req.url))
      }

      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const ROLE_PRIORITY = ['super_admin', 'owner', 'admin', 'supervisor', 'cocina', 'anfitrion', 'garzon', 'waiter']
    const pickBest = (arr: { role: string | null }[]) =>
      arr
        .map(m => m.role)
        .filter((r): r is string => !!r)
        .sort((a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b))[0] ?? null

    const role         = pickBest(list)
    const restaurantId = list[0]?.restaurant_id ?? null
    const isSuperAdmin = role === 'super_admin'
    const isAdminLevel = role ? ADMIN_ROLES.has(role) : false
    const isAdminOnly = ADMIN_ONLY.some(p => pathname.startsWith(p))

    if (isAdminOnly && !isAdminLevel && !isSuperAdmin) {
      const url = req.nextUrl.clone()
      url.pathname = ROLE_HOME[role ?? ''] ?? '/garzon'
      return NextResponse.redirect(url)
    }

    if (role && ROLE_ALLOWED[role]) {
      const allowed = ROLE_ALLOWED[role]
      const canAccess = allowed.some(p => pathname.startsWith(p))
      if (!canAccess) {
        const url = req.nextUrl.clone()
        url.pathname = ROLE_HOME[role]
        return NextResponse.redirect(url)
      }
    }

    res.headers.set('x-user-role',     role ?? '')
    res.headers.set('x-restaurant-id', restaurantId ?? '')
    res.headers.set('x-user-id',       user.id)
  }

  // Handle API routes under /api/customer/ that might need res passing through
  if (pathname.startsWith('/api/customer/')) {
    return res
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot|css|js)$).*)',
  ],
}
