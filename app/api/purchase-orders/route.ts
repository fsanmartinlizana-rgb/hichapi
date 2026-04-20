import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const OrderItemSchema = z.object({
  stock_item_id: z.string().uuid(),
  qty_ordered:   z.number().positive(),
  cost_per_unit: z.number().int().min(0),
})

const CreateOrderSchema = z.object({
  restaurant_id: z.string().uuid(),
  supplier:      z.string().min(1),
  notes:         z.string().optional(),
  items:         z.array(OrderItemSchema).min(1),
})

// GET /api/purchase-orders?restaurant_id=&status=&supplier=
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const { searchParams } = req.nextUrl
  const restaurant_id = searchParams.get('restaurant_id')
  if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  let query = supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .eq('restaurant_id', restaurant_id)
    .order('created_at', { ascending: false })

  const status = searchParams.get('status')
  if (status) query = query.eq('status', status)

  const supplier = searchParams.get('supplier')
  if (supplier) query = query.ilike('supplier', `%${supplier}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ orders: data })
}

// POST /api/purchase-orders
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  try {
    const body = CreateOrderSchema.parse(await req.json())

    const { data: order, error: orderErr } = await supabase
      .from('purchase_orders')
      .insert({
        restaurant_id: body.restaurant_id,
        supplier:      body.supplier,
        notes:         body.notes ?? null,
        status:        'borrador',
      })
      .select()
      .single()

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 })

    const itemsToInsert = body.items.map((item) => ({
      purchase_order_id: order.id,
      stock_item_id:     item.stock_item_id,
      qty_ordered:       item.qty_ordered,
      cost_per_unit:     item.cost_per_unit,
    }))

    const { data: items, error: itemsErr } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert)
      .select()

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 })

    return NextResponse.json({ order: { ...order, items } }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
