import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const type = searchParams.get('type') // 'recovery' for password reset links

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Password reset flow → send to update-password page
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/update-password`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
