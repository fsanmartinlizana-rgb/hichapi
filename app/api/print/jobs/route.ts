import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  Print jobs — enqueue from the admin app
//
//  Inserting a row triggers a Supabase Realtime event that the local print
//  agent is subscribed to. The agent then PATCHes status as it processes.
// ══════════════════════════════════════════════════════════════════════════════

const PrintLineSchema = z.object({
  text:    z.string().max(80).default(''),
  align:   z.enum(['left', 'center', 'right']).default('left'),
  bold:    z.boolean().default(false),
  size:    z.enum(['normal', 'large']).default('normal'),
  cut:     z.boolean().default(false),
  feed:    z.number().int().min(0).max(10).default(0),
  divider: z.boolean().default(false),
})

const CreateJobSchema = z.object({
  restaurant_id: z.string().uuid(),
  server_id:     z.string().uuid(),
  job_type:      z.enum(['receipt', 'kitchen_ticket', 'bar_ticket', 'cash_close', 'test']),
  payload: z.object({
    header:  z.string().max(80).optional(),
    footer:  z.string().max(80).optional(),
    copies:  z.number().int().min(1).max(5).default(1),
    lines:   z.array(PrintLineSchema).max(200),
  }),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  const limit        = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200)
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('print_jobs')
    .select(`
      id, server_id, job_type, status, attempts, error_message,
      created_at, printed_at,
      print_servers ( name )
    `)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return NextResponse.json({ jobs: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CreateJobSchema>
  try {
    body = CreateJobSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { user, error: authErr } = await requireRestaurantRole(
    body.restaurant_id,
    ['owner', 'admin', 'supervisor', 'cajero', 'garzon', 'waiter', 'cocina'],
  )
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  const supabase = createAdminClient()

  // Verify the print server belongs to this restaurant
  const { data: srv } = await supabase
    .from('print_servers')
    .select('id, active')
    .eq('id', body.server_id)
    .eq('restaurant_id', body.restaurant_id)
    .maybeSingle()

  if (!srv) {
    return NextResponse.json({ error: 'Print server no encontrado' }, { status: 404 })
  }
  if (!srv.active) {
    return NextResponse.json({ error: 'Print server inactivo' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('print_jobs')
    .insert({
      restaurant_id: body.restaurant_id,
      server_id:     body.server_id,
      job_type:      body.job_type,
      payload:       body.payload,
      created_by:    user.id,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('print/jobs insert error:', error)
    return NextResponse.json({ error: 'No se pudo crear el job' }, { status: 500 })
  }

  return NextResponse.json({ job: data })
}
