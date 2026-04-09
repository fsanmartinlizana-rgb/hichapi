import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const BodySchema = z.object({
  email:         z.string().email(),
  role:          z.enum(['admin','supervisor','garzon','waiter','cocina','anfitrion']),
  restaurant_id: z.string().uuid(),
})

const ROLE_HOME: Record<string, string> = {
  cocina:     '/comandas',
  anfitrion:  '/mesas',
  garzon:     '/garzon',
  waiter:     '/garzon',
  supervisor: '/dashboard',
  admin:      '/dashboard',
}

// POST /api/team/invite
export async function POST(req: NextRequest) {
  try {
    // Auth: require logged-in user with admin/owner role
    const { requireRestaurantRole } = await import('@/lib/supabase/auth-guard')
    const body = BodySchema.parse(await req.json())
    const { email, role, restaurant_id } = body

    const { error: authError } = await requireRestaurantRole(restaurant_id, ['owner', 'admin', 'super_admin'])
    if (authError) return authError

    const supabase = createAdminClient()

    // 2. Invite user via Supabase Auth (creates account + sends email)
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${origin}/auth/invite-callback`,
        data: { restaurant_id, role },
      }
    )

    if (inviteError) {
      // If user already exists, find them and add to team directly
      if (inviteError.message?.includes('already been registered')) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find((u: { email?: string; id: string }) => u.email === email)

        if (existingUser) {
          const { error: teamErr } = await supabase
            .from('team_members')
            .upsert({
              restaurant_id,
              user_id:       existingUser.id,
              invited_email: email,
              role,
              status:        'active',
              active:        true,
            }, { onConflict: 'restaurant_id,user_id', ignoreDuplicates: false })

          if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 400 })
          return NextResponse.json({ ok: true, existing_user: true })
        }
      }
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }

    // 3. Pre-create team_members with pending status
    const userId = inviteData?.user?.id
    const { error: teamErr } = await supabase
      .from('team_members')
      .upsert({
        restaurant_id,
        user_id:       userId ?? null,
        invited_email: email,
        role,
        status:        userId ? 'active' : 'pending',
        active:        true,
      }, { onConflict: 'restaurant_id,invited_email', ignoreDuplicates: false })

    if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, redirect_hint: ROLE_HOME[role] ?? '/dashboard' })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('invite error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
