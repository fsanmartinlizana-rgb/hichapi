import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// Routes that require restaurant auth
const PROTECTED = ['/dashboard', '/comandas', '/mesas', '/carta', '/reporte', '/analytics', '/insights', '/restaurante', '/tono', '/garzon']
// Routes only for unauthenticated users
const AUTH_ONLY  = ['/login', '/register', '/recuperar']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  let res = NextResponse.next({ request: req })

  // Dev bypass — skip auth in development for UI iteration
  if (process.env.NODE_ENV === 'development') return res

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

  // Refresh session — required on every request
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  const isAuthOnly  = AUTH_ONLY.some(p => pathname.startsWith(p))

  // Not logged in → redirect to login
  if (isProtected && !user) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Already logged in → redirect away from auth pages
  // Exception: /update-password is accessible while logged in (needed for password reset flow)
  if (isAuthOnly && user) {
    const dashUrl = req.nextUrl.clone()
    dashUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/).*)',
  ],
}
