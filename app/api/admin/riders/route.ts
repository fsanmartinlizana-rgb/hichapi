import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { setDocumentStatus } from '@/lib/delivery/rider.service'
import type { DocumentStatus } from '@/lib/delivery/types'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isAuthorized(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || adminSecret.length < 10) return false
  const secret = req.headers.get('x-admin-secret')
  return secret === adminSecret
}

// ── GET: listar riders por document_status ──────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status') ?? 'documents_submitted'

  // Fetch all user_ids of team members (restaurant staff/admin) to exclude them from the list of riders
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('user_id')

  const teamMemberUserIds = (teamMembers ?? [])
    .map(tm => tm.user_id)
    .filter(Boolean)

  let query = supabase
    .from('rider_profiles')
    .select('*')
    .eq('document_status', status)

  if (teamMemberUserIds.length > 0) {
    query = query.not('user_id', 'in', `(${teamMemberUserIds.join(',')})`)
  }

  const { data, error } = await query.order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── PATCH: aprobar o rechazar documentos del rider ───────────────────────────
export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, action } = body // action: 'approve' | 'reject'

  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const newStatus: DocumentStatus = action === 'approve' ? 'approved' : 'rejected'

  try {
    await setDocumentStatus(id, newStatus)
    return NextResponse.json({ success: true, newStatus })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
