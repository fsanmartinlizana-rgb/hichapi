import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'

// ══════════════════════════════════════════════════════════════════════════════
//  Print agent endpoints — authenticated by bearer token (sha256 hash matched
//  against print_servers.token_hash). These are called by the local print
//  agent, not the admin app.
//
//  GET  /api/print/agent          → return server config + restaurant info
//  GET  /api/print/agent/jobs     → fetch pending jobs (polling fallback)
//  PATCH/api/print/agent/jobs     → mark a job's status
// ══════════════════════════════════════════════════════════════════════════════

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function authenticateAgent(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('print_servers')
    .select('id, restaurant_id, name, printer_kind, printer_addr, paper_width, active')
    .eq('token_hash', hashToken(token))
    .eq('active', true)
    .maybeSingle()

  return data
}

// Heartbeat + config
export async function GET(req: NextRequest) {
  const server = await authenticateAgent(req)
  if (!server) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Update heartbeat
  const supabase = createAdminClient()
  await supabase
    .from('print_servers')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', server.id)

  return NextResponse.json({ server })
}

const PatchSchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(['printing', 'completed', 'failed']),
  error_message: z.string().max(500).nullable().optional(),
})

export async function PATCH(req: NextRequest) {
  const server = await authenticateAgent(req)
  if (!server) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const update: Record<string, unknown> = { status: body.status }
  if (body.status === 'completed') update.printed_at = new Date().toISOString()
  if (body.status === 'failed')    update.error_message = body.error_message ?? 'unknown'
  if (body.status === 'printing' || body.status === 'failed') {
    // increment attempts via RPC-less update
    const { data: existing } = await supabase
      .from('print_jobs')
      .select('attempts')
      .eq('id', body.job_id)
      .single()
    update.attempts = (existing?.attempts ?? 0) + 1
  }

  const { error } = await supabase
    .from('print_jobs')
    .update(update)
    .eq('id', body.job_id)
    .eq('server_id', server.id) // ensure ownership

  if (error) {
    return NextResponse.json({ error: 'No se pudo actualizar el job' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
