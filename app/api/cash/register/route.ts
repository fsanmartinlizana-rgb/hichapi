import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const OpenSchema = z.object({
  restaurant_id:  z.string().uuid(),
  opening_amount: z.number().int().min(0),
})

const CloseSchema = z.object({
  session_id:  z.string().uuid(),
  actual_cash: z.number().int().min(0),
  notes:       z.string().optional(),
})

// GET /api/cash/register?restaurant_id=xxx — get open session + today summary
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const restaurant_id = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  const supabase = createAdminClient()

  // Get open session
  const { data: session } = await supabase
    .from('cash_register_sessions')
    .select('*')
    .eq('restaurant_id', restaurant_id)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Get today's payment summary
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: todaySummary } = await supabase
    .from('orders')
    .select('payment_method, total, cash_amount, digital_amount, hichapi_commission')
    .eq('restaurant_id', restaurant_id)
    .eq('status', 'paid')
    .gte('updated_at', today.toISOString())

  type SummaryRow = { payment_method: string; total: number; cash_amount: number | null; digital_amount: number | null; hichapi_commission: number | null }
  const summary = {
    total_cash:        (todaySummary ?? [] as SummaryRow[]).reduce((s: number, o: SummaryRow) => s + (o.cash_amount ?? 0), 0),
    total_digital:     (todaySummary ?? [] as SummaryRow[]).reduce((s: number, o: SummaryRow) => s + (o.digital_amount ?? 0), 0),
    total_orders:      (todaySummary ?? []).length,
    total_revenue:     (todaySummary ?? [] as SummaryRow[]).reduce((s: number, o: SummaryRow) => s + o.total, 0),
    hichapi_commission:(todaySummary ?? [] as SummaryRow[]).reduce((s: number, o: SummaryRow) => s + (o.hichapi_commission ?? 0), 0),
  }

  // Expenses (only for the currently open session — zero if none)
  let expenses: Array<{ id: string; amount: number; category: string; description: string; created_at: string }> = []
  let total_expenses = 0
  let session_orders: Array<{
    id: string; total: number; payment_method: string | null; cash_amount: number | null;
    digital_amount: number | null; updated_at: string; client_name: string | null;
    hichapi_commission: number | null; table_id: string | null; table_label?: string | null;
    items: Array<{ name: string; quantity: number }>;
  }> = []
  if (session) {
    const { data: expRows } = await supabase
      .from('cash_session_expenses')
      .select('id, amount, category, description, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false })
    expenses = expRows ?? []
    total_expenses = expenses.reduce((s, e) => s + e.amount, 0)

    // Orders paid during this session — expose as list for Caja screen
    const { data: sessOrders } = await supabase
      .from('orders')
      .select('id, total, payment_method, cash_amount, digital_amount, updated_at, client_name, hichapi_commission, table_id, tables(label), order_items(name, quantity)')
      .eq('restaurant_id', restaurant_id)
      .eq('status', 'paid')
      .gte('updated_at', session.opened_at)
      .order('updated_at', { ascending: false })
    session_orders = (sessOrders ?? []).map((o: {
      id: string; total: number; payment_method: string | null;
      cash_amount: number | null; digital_amount: number | null;
      updated_at: string; client_name: string | null;
      hichapi_commission: number | null; table_id: string | null;
      tables?: { label: string } | { label: string }[] | null;
      order_items?: Array<{ name: string; quantity: number }> | null;
    }) => ({
      id: o.id,
      total: o.total,
      payment_method: o.payment_method,
      cash_amount: o.cash_amount,
      digital_amount: o.digital_amount,
      updated_at: o.updated_at,
      client_name: o.client_name,
      hichapi_commission: o.hichapi_commission,
      table_id: o.table_id,
      table_label: Array.isArray(o.tables) ? o.tables[0]?.label ?? null : o.tables?.label ?? null,
      items: o.order_items ?? [],
    }))
  }

  return NextResponse.json({ session, summary, expenses, total_expenses, session_orders })
}

// POST /api/cash/register — open new session
export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  try {
    const body = OpenSchema.parse(await req.json())
    const supabase = createAdminClient()

    // Close any existing open session first
    await supabase
      .from('cash_register_sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user.id })
      .eq('restaurant_id', body.restaurant_id)
      .eq('status', 'open')

    const { data, error } = await supabase
      .from('cash_register_sessions')
      .insert({
        restaurant_id:  body.restaurant_id,
        opened_by:      user.id,
        opening_amount: body.opening_amount,
        status:         'open',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ session: data })
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
}

// PATCH /api/cash/register — close session
export async function PATCH(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  try {
    const body = CloseSchema.parse(await req.json())
    const supabase = createAdminClient()

    // Get session totals
    const { data: session } = await supabase
      .from('cash_register_sessions')
      .select('*')
      .eq('id', body.session_id)
      .single()

    if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

    // Calculate totals for this session period
    const { data: orders } = await supabase
      .from('orders')
      .select('cash_amount, digital_amount, total')
      .eq('restaurant_id', session.restaurant_id)
      .eq('status', 'paid')
      .gte('updated_at', session.opened_at)

    type OrderRow = { cash_amount: number | null; digital_amount: number | null; total: number }
    const total_cash    = (orders ?? [] as OrderRow[]).reduce((s: number, o: OrderRow) => s + (o.cash_amount ?? 0), 0)
    const total_digital = (orders ?? [] as OrderRow[]).reduce((s: number, o: OrderRow) => s + (o.digital_amount ?? 0), 0)
    const total_orders  = (orders ?? []).length

    // Sum of gastos (expenses) during this session — subtracts from expected cash
    const { data: expRows } = await supabase
      .from('cash_session_expenses')
      .select('amount')
      .eq('session_id', body.session_id)
    const total_expenses = (expRows ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0)

    const expected_cash = session.opening_amount + total_cash - total_expenses
    const difference    = body.actual_cash - expected_cash

    const { data, error } = await supabase
      .from('cash_register_sessions')
      .update({
        status:         'closed',
        closed_at:      new Date().toISOString(),
        closed_by:      user.id,
        actual_cash:    body.actual_cash,
        total_cash,
        total_digital,
        total_orders,
        total_expenses,
        difference,
        notes:          body.notes ?? null,
      })
      .eq('id', body.session_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ session: data, difference, expected_cash, total_expenses })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
