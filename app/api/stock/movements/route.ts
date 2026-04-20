import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET /api/stock/movements?restaurant_id=&stock_item_id=&type=&from_date=&to_date=&logged_by=
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const params = req.nextUrl.searchParams
  const restaurant_id = params.get('restaurant_id')
  if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  const stock_item_id = params.get('stock_item_id')
  const type         = params.get('type')
  const from_date    = params.get('from_date')
  const to_date      = params.get('to_date')
  const logged_by    = params.get('logged_by')

  let query = supabase
    .from('stock_movements')
    .select(`
      *,
      stock_items ( cost_per_unit )
    `)
    .eq('restaurant_id', restaurant_id)
    .order('logged_at', { ascending: false })

  if (stock_item_id) query = query.eq('stock_item_id', stock_item_id)
  if (type)          query = query.eq('reason', type)
  if (from_date)     query = query.gte('logged_at', from_date)
  if (to_date)       query = query.lte('logged_at', to_date)
  if (logged_by)     query = query.eq('logged_by', logged_by)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const movements = (data ?? []).map((m) => {
    const cost_per_unit = (m.stock_items as { cost_per_unit: number } | null)?.cost_per_unit ?? 0
    const valor_monetario = Math.abs(m.delta) * cost_per_unit
    const { stock_items: _, ...rest } = m
    return { ...rest, valor_monetario }
  })

  return NextResponse.json({ movements })
}
