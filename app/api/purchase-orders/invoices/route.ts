import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const CreateInvoiceSchema = z.object({
  restaurant_id:     z.string().uuid(),
  purchase_order_id: z.string().uuid(),
  invoice_number:    z.string().optional(),
  issued_at:         z.string().optional(),
  due_at:            z.string().optional(),
  notes:             z.string().optional(),
})

// GET /api/purchase-orders/invoices?restaurant_id=&supplier=&from_date=&to_date=&payment_status=
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const { searchParams } = req.nextUrl
  const restaurant_id = searchParams.get('restaurant_id')
  if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  let query = supabase
    .from('purchase_invoices')
    .select('*, purchase_orders(supplier)')
    .eq('restaurant_id', restaurant_id)
    .order('created_at', { ascending: false })

  const payment_status = searchParams.get('payment_status')
  if (payment_status) query = query.eq('payment_status', payment_status)

  const from_date = searchParams.get('from_date')
  if (from_date) query = query.gte('created_at', from_date)

  const to_date = searchParams.get('to_date')
  if (to_date) query = query.lte('created_at', to_date)

  const supplier = searchParams.get('supplier')

  const { data: invoices, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Filter by supplier via joined purchase_orders
  const filtered = supplier
    ? (invoices ?? []).filter((inv: any) =>
        inv.purchase_orders?.supplier?.toLowerCase().includes(supplier.toLowerCase()),
      )
    : (invoices ?? [])

  // KPI: sum of total_amount for pending invoices
  const { data: pendingData, error: pendingErr } = await supabase
    .from('purchase_invoices')
    .select('total_amount')
    .eq('restaurant_id', restaurant_id)
    .eq('payment_status', 'pendiente')

  if (pendingErr) return NextResponse.json({ error: pendingErr.message }, { status: 400 })

  const total_pendiente = (pendingData ?? []).reduce(
    (sum: number, inv: any) => sum + (inv.total_amount ?? 0),
    0,
  )

  return NextResponse.json({ invoices: filtered, total_pendiente })
}

// POST /api/purchase-orders/invoices
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  try {
    const body = CreateInvoiceSchema.parse(await req.json())

    // Verify the purchase order exists and has status = 'recibida'
    const { data: order, error: orderErr } = await supabase
      .from('purchase_orders')
      .select('id, status')
      .eq('id', body.purchase_order_id)
      .eq('restaurant_id', body.restaurant_id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 })
    }

    if (order.status !== 'recibida') {
      return NextResponse.json(
        { error: 'Solo se pueden generar facturas de órdenes en estado recibida' },
        { status: 422 },
      )
    }

    // Calculate total_amount = sum of qty_ordered × cost_per_unit
    const { data: items, error: itemsErr } = await supabase
      .from('purchase_order_items')
      .select('qty_ordered, cost_per_unit')
      .eq('purchase_order_id', body.purchase_order_id)

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 })

    const total_amount = (items ?? []).reduce(
      (sum: number, item: any) => sum + item.qty_ordered * item.cost_per_unit,
      0,
    )

    const { data: invoice, error: invoiceErr } = await supabase
      .from('purchase_invoices')
      .insert({
        restaurant_id:     body.restaurant_id,
        purchase_order_id: body.purchase_order_id,
        invoice_number:    body.invoice_number ?? null,
        issued_at:         body.issued_at ?? null,
        due_at:            body.due_at ?? null,
        notes:             body.notes ?? null,
        total_amount:      Math.round(total_amount),
        payment_status:    'pendiente',
      })
      .select()
      .single()

    if (invoiceErr) return NextResponse.json({ error: invoiceErr.message }, { status: 400 })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
