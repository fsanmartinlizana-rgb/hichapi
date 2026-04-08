import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const ROLE_HOME: Record<string, string> = {
  cocina:     '/comandas',
  anfitrion:  '/mesas',
  garzon:     '/garzon',
  waiter:     '/garzon',
  supervisor: '/dashboard',
  admin:      '/dashboard',
  owner:      '/dashboard',
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')

  if (!code) return NextResponse.redirect(`${origin}/login?error=no_code`)

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

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !session) {
    return NextResponse.redirect(`${origin}/login?error=invite_failed`)
  }

  const user          = session.user
  const restaurantId  = user.user_metadata?.restaurant_id as string | undefined
  const role          = user.user_metadata?.role as string | undefined

  // Link user_id to their pending team_members record
  if (restaurantId && user.email) {
    const admin = createAdminClient()
    await admin
      .from('team_members')
      .update({ user_id: user.id, status: 'active', active: true })
      .eq('restaurant_id', restaurantId)
      .eq('invited_email', user.email)
      .eq('status', 'pending')
  }

  const destination = ROLE_HOME[role ?? ''] ?? '/dashboard'
  return NextResponse.redirect(`${origin}${destination}`)
}
