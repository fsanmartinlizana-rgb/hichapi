import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── POST /api/auth/add-restaurant ─────────────────────────────────────────────
// Agrega un restaurante NUEVO a la cuenta del usuario ya autenticado.
//
// Diferencias con /api/auth/register-restaurant:
//   - NO crea un usuario en auth.users (usa el del session).
//   - Permite que un mismo email administre múltiples restaurantes (caso del
//     dueño que tiene 2-3 locales independientes con el mismo correo, sin
//     compartir brand_id).
//
// Para "sucursales" del MISMO brand (Enterprise), seguí usando
// /api/auth/add-sucursal (que asocia brand_id).
// ─────────────────────────────────────────────────────────────────────────────

const PlanSchema = z.enum(['free', 'piloto', 'starter', 'pro', 'enterprise'])
type PlanId = z.infer<typeof PlanSchema>

const BodySchema = z.object({
  restName:    z.string().min(2).max(100),
  restAddress: z.string().min(2).max(200),
  restBarrio:  z.string().min(2).max(80),
  restCocina:  z.string().min(2).max(60),
  plan:        PlanSchema.optional().default('free'),
})

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function trialEnd(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString()
}

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) {
    return authErr ?? NextResponse.json({ error: 'Debés iniciar sesión' }, { status: 401 })
  }

  try {
    const body = BodySchema.parse(await req.json())
    const supabase = createAdminClient()
    const requestedPlan: PlanId = body.plan

    // Trial 30d para starter/pro; Piloto es $0 permanente sin trial.
    const plan: PlanId =
      requestedPlan === 'starter' || requestedPlan === 'pro' || requestedPlan === 'piloto'
        ? requestedPlan
        : 'free'
    const isOnTrial = plan === 'starter' || plan === 'pro'

    const baseSlug = toSlug(body.restName)
    const slug     = `${baseSlug}-${Date.now().toString(36).slice(-4)}`

    const featureFlags: Record<string, unknown> = {
      desired_plan: requestedPlan,
      added_to_existing_account: true,
    }
    if (isOnTrial) {
      featureFlags.on_trial = true
      featureFlags.trial_plan = plan
      featureFlags.trial_ends_at = trialEnd()
      featureFlags.trial_started_at = new Date().toISOString()
    }

    const { data: restData, error: restErr } = await supabase
      .from('restaurants')
      .insert({
        name:          body.restName.trim(),
        slug,
        address:       body.restAddress.trim(),
        neighborhood:  body.restBarrio.trim(),
        cuisine_type:  body.restCocina.trim(),
        owner_id:      user.id,
        active:        true,
        plan,
        claimed:       true,
        feature_flags: featureFlags,
      })
      .select('id, slug')
      .single()

    if (restErr || !restData) {
      console.error('add-restaurant create restaurant error:', restErr)
      return NextResponse.json({ error: 'No pudimos crear el restaurante.' }, { status: 500 })
    }

    // team_members: owner del nuevo restaurante. La cuenta del usuario ya
    // existe en auth.users desde el primer registro.
    const { error: teamErr } = await supabase.from('team_members').insert({
      restaurant_id: restData.id,
      user_id:       user.id,
      invited_email: user.email?.toLowerCase().trim() ?? null,
      role:          'owner',
      status:        'active',
      active:        true,
    })

    if (teamErr) {
      console.error('add-restaurant team_member error:', teamErr)
      return NextResponse.json(
        { error: 'Restaurante creado pero no pudimos asignar tu rol. Contacta soporte.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok:            true,
      restaurant_id: restData.id,
      slug:          restData.slug,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.issues },
        { status: 400 },
      )
    }
    console.error('add-restaurant error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
