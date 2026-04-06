import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'chapi-admin-2024'

function isAuthorized(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret') ?? req.nextUrl.searchParams.get('secret')
  return secret === ADMIN_SECRET
}

// ── GET: listar submissions ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'

  const { data, error } = await supabase
    .from('restaurant_submissions')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── PATCH: aprobar o rechazar ────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, action, notes } = body  // action: 'approve' | 'reject'

  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  // Actualizar estado de la solicitud
  const { data: submission, error: updateError } = await supabase
    .from('restaurant_submissions')
    .update({ status: newStatus, notes: notes ?? null })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Si se aprueba → crear restaurante en la tabla restaurants
  if (action === 'approve' && submission) {
    const { error: insertError } = await supabase.from('restaurants').insert({
      name:         submission.name,
      slug:         submission.slug_proposed ?? submission.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      address:      submission.address,
      neighborhood: submission.neighborhood,
      cuisine_type: submission.cuisine_type,
      price_range:  submission.price_range,
      rating:       4.0,
      review_count: 0,
      active:       true,
      plan:         'free',
      // lat/lng vacíos por ahora — el equipo los completa después
    })

    if (insertError) {
      // No revertir el status change, pero avisar
      return NextResponse.json({
        warning: 'Submission aprobada pero falló al crear restaurante: ' + insertError.message,
        submission,
      }, { status: 207 })
    }
  }

  return NextResponse.json({ success: true, submission })
}
