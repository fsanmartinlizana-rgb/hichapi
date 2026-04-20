import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendBrandedEmail } from '@/lib/email/sender'
import { teamInviteEmail } from '@/lib/email/templates'
import { resolveAppUrl } from '@/lib/app-url'
import { createInviteToken } from '@/lib/invite-token'

// Roles base del sistema. Los custom_roles (creados desde
// RolesManagerModal) llegan como UUID, por eso la validación es laxa.
const BASE_ROLES = ['admin','supervisor','garzon','waiter','cocina','anfitrion'] as const
type BaseRole = typeof BASE_ROLES[number]
const isBaseRole = (v: string): v is BaseRole => (BASE_ROLES as readonly string[]).includes(v)

const BodySchema = z.object({
  email:         z.string().email(),
  // Permitimos cualquier string: puede ser un rol base (admin, garzon, etc.)
  // o un UUID de custom_role creado por el restaurant. El server valida después.
  role:          z.string().min(1).max(80).optional(),
  roles:         z.array(z.string().min(1).max(80)).min(1).optional(),
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

    // El "role" primario determina a dónde cae el user post-login (ROLE_HOME).
    // Si vino un rol base en la lista, lo priorizamos. Si todos son UUIDs de
    // custom roles, marcamos el primario como 'admin' (fallback seguro).
    const baseInList = rolesArr.find(isBaseRole) as BaseRole | undefined
    const role: BaseRole = (body.role && isBaseRole(body.role) ? body.role as BaseRole : baseInList) ?? 'admin'

    // Valida que cada rol no-base sea un custom_role que pertenezca al restaurant.
    // Bloquea inyección de UUIDs arbitrarios con permisos que no deberían tener.
    const customIds = rolesArr.filter(r => !isBaseRole(r))
    if (customIds.length > 0) {
      const adminSupabase = createAdminClient()
      const { data: validCustom } = await adminSupabase
        .from('custom_roles')
        .select('id')
        .eq('restaurant_id', restaurant_id)
        .in('id', customIds)
      const validIds = new Set(((validCustom ?? []) as { id: string }[]).map(r => r.id))
      const invalid = customIds.filter(c => !validIds.has(c))
      if (invalid.length > 0) {
        return NextResponse.json({
          error: `Roles custom inválidos: ${invalid.join(', ')}. Creá el rol primero en Equipo → Gestionar roles.`,
        }, { status: 400 })
      }
    }

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

    // 2. Pre-create team_members con status pending (sin user_id por ahora)
    //    El user_id real se setea cuando el invitado acepta el link.
    const origin     = resolveAppUrl(req)
    const useBranded = !!process.env.RESEND_API_KEY

    // ¿Ya existe un user con ese email? (para activarlo directo si es así)
    let existingUserId: string | null = null
    try {
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 200 })
      const found = list?.users?.find(
        (u: { email?: string | null; id: string }) => u.email?.toLowerCase() === email.toLowerCase()
      )
      if (found) existingUserId = found.id
    } catch { /* non-fatal */ }

    const { error: teamErr } = await upsertTeamMember({
      user_id: existingUserId,
      status:  existingUserId ? 'active' : 'pending',
    })
    if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 400 })

    // 3. Generar nuestro token firmado (bypass del Site URL de Supabase)
    //    Vigencia 7 días; el link siempre apunta a NUESTRO dominio funcional.
    const inviteToken = createInviteToken({
      email,
      restaurant_id,
      role,
      full_name,
      phone,
    })
    const actionLink = `${origin}/aceptar-invitacion?t=${encodeURIComponent(inviteToken)}`

    // 4. Mandar email branded vía Resend (preferido) o vía Supabase como fallback
    let emailStatus: { sent: boolean; skipped?: boolean; error?: string; carrier?: string } = { sent: false }
    const { data: rest } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurant_id)
      .maybeSingle()

    const { subject, html, text } = teamInviteEmail({
      restaurantName: rest?.name ?? 'tu restaurante',
      role,
      actionUrl:      actionLink,
    })

    if (useBranded) {
      const mail = await sendBrandedEmail({ to: email, subject, html, text })
      emailStatus = {
        sent:    mail.ok,
        skipped: mail.skipped,
        error:   mail.error,
        carrier: 'resend',
      }
    }

    // Fallback: si Resend no está configurado o falló, igual usamos
    // auth.admin.inviteUserByEmail SOLO como carrier de email — el link en el
    // email default de Supabase puede caer mal, pero al menos llega "algo".
    // El usuario puede pedir un nuevo invite desde /invite-callback.
    if (!emailStatus.sent && !existingUserId) {
      try {
        await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${origin}/invite-callback`,
          data: { restaurant_id, role },
        })
        emailStatus = { sent: true, carrier: 'supabase_fallback' }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      ok: true,
      existing_user: !!existingUserId,
      redirect_hint: ROLE_HOME[role] ?? '/dashboard',
      action_link:   actionLink,  // el admin puede copiarlo y compartir manualmente si el email no llega
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
