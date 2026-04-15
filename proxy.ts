import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// ── Route access config ───────────────────────────────────────────────────────

const PROTECTED  = [
  '/dashboard','/comandas','/mesas','/carta','/garzon',
  '/reporte','/analytics','/insights','/restaurante',
  '/tono','/mermas','/stock','/turnos','/equipo',
]
const AUTH_ONLY  = ['/login','/register','/recuperar']
const ADMIN_ONLY = ['/carta','/reporte','/analytics','/restaurante','/tono','/mermas','/stock','/turnos','/equipo']
const ADMIN_ROLES = new Set(['owner','admin','super_admin'])

// Where each role lands after login
const ROLE_HOME: Record<string, string> = {
  cocina:     '/comandas',
  anfitrion:  '/mesas',
  garzon:     '/garzon',
  waiter:     '/garzon',
  supervisor: '/dashboard',
  admin:      '/dashboard',
  owner:      '/dashboard',
  super_admin: '/dashboard',
}

// What each restricted role is allowed to visit
const ROLE_ALLOWED: Record<string, string[]> = {
  cocina:    ['/comandas'],
  anfitrion: ['/mesas', '/garzon', '/dashboard'],
}

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

  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  const isAuthOnly  = AUTH_ONLY.some(p => pathname.startsWith(p))
  const isAdminOnly = ADMIN_ONLY.some(p => pathname.startsWith(p))

  // Not authenticated → redirect to login
  if (isProtected && !user) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Logged in → redirect away from auth pages
  if (isAuthOnly && user) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Fetch role + restaurant from team_members.
  // IMPORTANTE: un usuario puede ser miembro de varios restaurantes (super
  // admin, owner con multi-local, etc.). Nunca usar .single() aquí: falla con
  // >1 fila y deja membership=null, lo que redirige a todos como si fueran
  // garzones. Traemos todas las memberships activas y elegimos el rol más
  // privilegiado como rol efectivo para gating de rutas.
  if (user && isProtected) {
    const { data: memberships } = await supabase
      .from('team_members')
      .select('role, restaurant_id')
      .eq('user_id', user.id)
      .eq('active', true)

    const list = memberships ?? []
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

    // Admin-only routes → redirect non-admins to their home
    if (isAdminOnly && !isAdminLevel && !isSuperAdmin) {
      const url = req.nextUrl.clone()
      url.pathname = ROLE_HOME[role ?? ''] ?? '/garzon'
      return NextResponse.redirect(url)
    }

    // Role-restricted routes (cocina, anfitrion)
    if (role && ROLE_ALLOWED[role]) {
      const allowed = ROLE_ALLOWED[role]
      const canAccess = allowed.some(p => pathname.startsWith(p))
      if (!canAccess) {
        const url = req.nextUrl.clone()
        url.pathname = ROLE_HOME[role]
        return NextResponse.redirect(url)
      }
    }

    // Propagate context headers to Server Components
    res = NextResponse.next({ request: req })
    res.headers.set('x-user-role',       role ?? '')
    res.headers.set('x-restaurant-id',   restaurantId ?? '')
    res.headers.set('x-user-id',         user.id)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|auth/).*)',],
}
