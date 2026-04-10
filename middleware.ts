import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // ── 1. Auth protection for restaurant panel ────────────────────────────
  const panelPaths = [
    '/dashboard', '/garzon', '/comandas', '/mesas', '/carta',
    '/stock', '/mermas', '/turnos', '/caja', '/equipo',
    '/restaurante', '/tono', '/insights', '/analytics',
    '/reporte', '/modulos',
  ]

  const isPanel = panelPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isPanel) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
          setAll: (cookies) => {
            for (const { name, value, options } of cookies) {
              res.cookies.set(name, value, options)
            }
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── 2. Security headers ────────────────────────────────────────────────
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return res
}

export const config = {
  matcher: [
    // Panel pages
    '/dashboard/:path*',
    '/garzon/:path*',
    '/comandas/:path*',
    '/mesas/:path*',
    '/carta/:path*',
    '/stock/:path*',
    '/mermas/:path*',
    '/turnos/:path*',
    '/caja/:path*',
    '/equipo/:path*',
    '/restaurante/:path*',
    '/tono/:path*',
    '/insights/:path*',
    '/analytics/:path*',
    '/reporte/:path*',
    '/modulos/:path*',
    '/admin/:path*',
  ],
}
