import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendBrandedEmail } from '@/lib/email/sender'
import { teamInviteEmail } from '@/lib/email/templates'

const RoleEnum = z.enum(['admin','supervisor','garzon','waiter','cocina','anfitrion'])

const BodySchema = z.object({
  email:         z.string().email(),
  // Either a single role or a list of roles (multi-rol). We keep `role`
  // as the "primary" role for compatibility.
  role:          RoleEnum.optional(),
  roles:         z.array(RoleEnum).min(1).optional(),
  restaurant_id: z.string().uuid(),
  full_name:     z.string().min(1).max(120).optional(),
  phone:         z.string().max(40).optional(),
}).refine(d => d.role || (d.roles && d.roles.length > 0), {
  message: 'Debes especificar al menos un rol',
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
    const { email, restaurant_id, full_name, phone } = body
    const rolesArr = body.roles ?? (body.role ? [body.role] : [])
    const role = (body.role ?? rolesArr[0]) as z.infer<typeof RoleEnum>

    const { error: authError } = await requireRestaurantRole(restaurant_id, ['owner', 'admin', 'super_admin'])
    if (authError) return authError

    const supabase = createAdminClient()

    // ── Helper: manual upsert (the unique index is partial, so PostgREST upsert
    //    can't match it via onConflict — emulate with select-then-insert/update)
    async function upsertTeamMember(args: {
      user_id: string | null
      status: 'pending' | 'active'
    }) {
      // Look for an existing non-revoked row for this email at this restaurant
      const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('restaurant_id', restaurant_id)
        .eq('invited_email', email)
        .neq('status', 'revoked')
        .maybeSingle()

      if (existing) {
        // Try to write roles[] + full_name + phone — falls back progressively
        const { error: err } = await supabase
          .from('team_members')
          .update({
            user_id:   args.user_id,
            role,
            roles:     rolesArr,
            full_name: full_name ?? undefined,
            phone:     phone ?? undefined,
            status:    args.status,
            active:    true,
          })
          .eq('id', existing.id)
        if (err) {
          // Fallback 1: try without full_name/phone
          const { error: err2 } = await supabase
            .from('team_members')
            .update({
              user_id: args.user_id,
              role,
              roles:   rolesArr,
              status:  args.status,
              active:  true,
            })
            .eq('id', existing.id)
          if (err2) {
            // Fallback 2: without roles[] (oldest schemas)
            return supabase
              .from('team_members')
              .update({
                user_id: args.user_id,
                role,
                status:  args.status,
                active:  true,
              })
              .eq('id', existing.id)
          }
        }
        return { error: null }
      }

      const payload = {
        restaurant_id,
        user_id:       args.user_id,
        invited_email: email,
        role,
        roles:         rolesArr,
        full_name:     full_name ?? null,
        phone:         phone ?? null,
        status:        args.status,
        active:        true,
      }
      const { error: err } = await supabase.from('team_members').insert(payload)
      if (err) {
        // Fallback 1: retry without full_name/phone
        const { full_name: _fn, phone: _ph, ...withoutNamePhone } = payload
        const { error: err2 } = await supabase.from('team_members').insert(withoutNamePhone)
        if (err2) {
          // Fallback 2: without roles[] column
          const { roles: _omit, ...withoutRoles } = withoutNamePhone
          return supabase.from('team_members').insert(withoutRoles)
        }
      }
      return { error: null }
    }

    // 2. Invite user via Supabase Auth
    //    Si Resend está configurado: usamos generateLink (no envía correo) y mandamos
    //    nuestro template branded. Si no, usamos inviteUserByEmail (Supabase manda
    //    su template default — el admin debería personalizarlo en el dashboard).
    const origin       = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
    const useBranded   = !!process.env.RESEND_API_KEY
    const redirectTo   = `${origin}/invite-callback`

    let inviteData: { user?: { id?: string } } | null = null
    let inviteError: { message?: string } | null = null
    let actionLink: string | null = null

    if (useBranded) {
      const { data, error } = await supabase.auth.admin.generateLink({
        type:  'invite',
        email,
        options: {
          redirectTo,
          data: { restaurant_id, role },
        },
      })
      inviteData  = data ? { user: data.user ?? undefined } : null
      inviteError = error
      actionLink  = data?.properties?.action_link ?? null
    } else {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { restaurant_id, role },
      })
      inviteData  = data ? { user: data.user ?? undefined } : null
      inviteError = error
    }

    if (inviteError) {
      // If user already exists, find them and add to team directly
      if (inviteError.message?.includes('already been registered')) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(
          (u: { email?: string; id: string }) => u.email === email
        )

        if (existingUser) {
          const { error: teamErr } = await upsertTeamMember({
            user_id: existingUser.id,
            status:  'active',
          })
          if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 400 })
          return NextResponse.json({ ok: true, existing_user: true })
        }
      }
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }

    // 3. Pre-create team_members with pending status
    const userId = inviteData?.user?.id ?? null
    const { error: teamErr } = await upsertTeamMember({
      user_id: userId,
      status:  userId ? 'active' : 'pending',
    })

    if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 400 })

    // 4. Si tenemos action_link y Resend, mandamos el correo branded
    let emailStatus: { sent: boolean; skipped?: boolean; error?: string } = { sent: false }
    if (useBranded && actionLink) {
      const { data: rest } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', restaurant_id)
        .maybeSingle()

      const { subject, html, text } = teamInviteEmail({
        restaurantName: rest?.name ?? 'tu restaurante',
        role,
        actionUrl:      actionLink,
        invitedByName:  full_name ? undefined : undefined, // not exposing inviter identity yet
      })

      const res = await sendBrandedEmail({ to: email, subject, html, text })
      emailStatus = {
        sent:    res.ok,
        skipped: res.skipped,
        error:   res.error,
      }
    } else if (!useBranded) {
      // Supabase default flow — confiamos en que su SMTP esté configurado
      emailStatus = { sent: true }
    }

    return NextResponse.json({
      ok: true,
      redirect_hint: ROLE_HOME[role] ?? '/dashboard',
      email: emailStatus,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('invite error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
