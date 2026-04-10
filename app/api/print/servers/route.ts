import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  Print servers — register, list, rotate token
//
//  POST creates a new print server and returns a one-time bearer token. The
//  token is stored only as sha256 hash; the plaintext is shown ONCE in the
//  response so the operator can paste it into the agent's .env.
// ══════════════════════════════════════════════════════════════════════════════

const CreateSchema = z.object({
  restaurant_id: z.string().uuid(),
  name:          z.string().min(1).max(80),
  printer_kind:  z.enum(['network', 'usb', 'serial']).default('network'),
  printer_addr:  z.string().max(200).nullable().optional(),
  paper_width:   z.number().int().min(20).max(80).default(32),
})

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('print_servers')
    .select('id, name, printer_kind, printer_addr, paper_width, active, last_seen_at, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ servers: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CreateSchema>
  try {
    body = CreateSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  // Generate a one-time bearer token
  const token     = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('print_servers')
    .insert({
      restaurant_id: body.restaurant_id,
      name:          body.name,
      token_hash:    tokenHash,
      printer_kind:  body.printer_kind,
      printer_addr:  body.printer_addr ?? null,
      paper_width:   body.paper_width,
    })
    .select('id, name, printer_kind, printer_addr, paper_width, active, created_at')
    .single()

  if (error || !data) {
    console.error('print/servers insert error:', error)
    return NextResponse.json({ error: 'No se pudo crear el servidor' }, { status: 500 })
  }

  return NextResponse.json({
    server: data,
    token,                 // shown ONCE
    note: 'Guarda este token en el archivo .env del print-server. No volverá a aparecer.',
  })
}
