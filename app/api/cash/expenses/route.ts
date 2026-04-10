import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── Schemas ──────────────────────────────────────────────────────────────────

const CategoryEnum = z.enum(['proveedor', 'propina', 'insumos', 'servicios', 'otros'])

const CreateSchema = z.object({
  session_id:    z.string().uuid(),
  restaurant_id: z.string().uuid(),
  amount:        z.number().int().min(1),
  category:      CategoryEnum.default('otros'),
  description:   z.string().min(1).max(200),
})

const DeleteSchema = z.object({
  id:            z.string().uuid(),
  restaurant_id: z.string().uuid(),
})

// ── GET /api/cash/expenses?session_id=… ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const session_id = req.nextUrl.searchParams.get('session_id')
  if (!session_id) {
    return NextResponse.json({ error: 'session_id requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cash_session_expenses')
    .select('id, amount, category, description, created_at, created_by')
    .eq('session_id', session_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type ExpRow = { amount: number }
  const total = (data ?? []).reduce((s: number, e: ExpRow) => s + e.amount, 0)
  return NextResponse.json({ expenses: data ?? [], total })
}

// ── POST /api/cash/expenses — add a gasto ────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  try {
    const body = CreateSchema.parse(await req.json())
    const supabase = createAdminClient()

    // Verify the session is open — can't add expenses to a closed shift
    const { data: session } = await supabase
      .from('cash_register_sessions')
      .select('id, status, restaurant_id')
      .eq('id', body.session_id)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    }
    if (session.status !== 'open') {
      return NextResponse.json({ error: 'La caja está cerrada' }, { status: 400 })
    }
    if (session.restaurant_id !== body.restaurant_id) {
      return NextResponse.json({ error: 'Sesión no pertenece al restaurante' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('cash_session_expenses')
      .insert({
        session_id:    body.session_id,
        restaurant_id: body.restaurant_id,
        amount:        body.amount,
        category:      body.category,
        description:   body.description,
        created_by:    user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ expense: data }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE /api/cash/expenses — revert a gasto ───────────────────────────────

export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  try {
    const body = DeleteSchema.parse(await req.json())
    const supabase = createAdminClient()

    // Only allow delete while session is still open
    const { data: expense } = await supabase
      .from('cash_session_expenses')
      .select('session_id')
      .eq('id', body.id)
      .eq('restaurant_id', body.restaurant_id)
      .single()

    if (!expense) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
    }

    const { data: session } = await supabase
      .from('cash_register_sessions')
      .select('status')
      .eq('id', expense.session_id)
      .single()

    if (session?.status !== 'open') {
      return NextResponse.json({ error: 'No se puede eliminar gastos de una caja cerrada' }, { status: 400 })
    }

    const { error } = await supabase
      .from('cash_session_expenses')
      .delete()
      .eq('id', body.id)
      .eq('restaurant_id', body.restaurant_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
