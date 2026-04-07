import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const DEMO_RESTAURANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (newCookies) => {
          newCookies.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    return NextResponse.redirect(new URL('/login?redirect=/api/admin/demo-setup', req.url))
  }

  // Use service role for writes
  const { createClient } = await import('@supabase/supabase-js')
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Set owner_id on demo restaurant
  await adminClient
    .from('restaurants')
    .update({ owner_id: user.id })
    .eq('id', DEMO_RESTAURANT_ID)

  // 2. Upsert team_member as owner
  await adminClient
    .from('team_members')
    .upsert({
      restaurant_id: DEMO_RESTAURANT_ID,
      user_id: user.id,
      role: 'owner',
    }, { onConflict: 'restaurant_id,user_id' })

  // 3. Redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', req.url))
}
