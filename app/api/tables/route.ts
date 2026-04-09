import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CreateSchema = z.object({
  label:         z.string().min(1),
  seats:         z.number().int().min(1).max(30),
  zone:          z.string().default('interior'),
  smoking:       z.boolean().default(false),
  restaurant_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = await req.json()
    const { label, seats, zone, smoking, restaurant_id } = CreateSchema.parse(body)

    const fullLabel = /^Mesa\s+/i.test(label) ? label : `Mesa ${label}`
    const qr_token  = `qr-${fullLabel.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 10)}`

    // Resolve restaurant_id if not provided
    let restId = restaurant_id
    if (!restId) {
      const { data: rest } = await supabase.from('restaurants').select('id').limit(1).single()
      restId = rest?.id
    }

    const { data, error } = await supabase
      .from('tables')
      .insert({ label: fullLabel, seats, zone, smoking, status: 'libre', qr_token, restaurant_id: restId })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, table: data })
  } catch (err) {
    console.error('POST /api/tables error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
