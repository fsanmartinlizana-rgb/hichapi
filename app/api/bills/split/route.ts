import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { restaurant_id, table_id, order_ids, split_type, total_amount, num_splits, split_config } = body

    if (!restaurant_id || !table_id || !order_ids || !split_type || !total_amount || !num_splits) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }
    if (!['full', 'equal', 'by_items', 'custom'].includes(split_type)) {
      return NextResponse.json({ error: 'Tipo de división inválido' }, { status: 400 })
    }
    if (num_splits < 1) {
      return NextResponse.json({ error: 'Número de divisiones debe ser mayor a 0' }, { status: 400 })
    }
    if (total_amount <= 0) {
      return NextResponse.json({ error: 'Monto total debe ser mayor a 0' }, { status: 400 })
    }

    // Verificar membership
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurant_id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No autorizado para este restaurant' }, { status: 403 })
    }

    // Verificar órdenes (admin para evitar RLS)
    const { data: orders, error: ordersError } = await adminSupabase
      .from('orders')
      .select('id, table_id, total, status')
      .in('id', order_ids)
      .eq('restaurant_id', restaurant_id)

    if (ordersError || !orders || orders.length !== order_ids.length) {
      return NextResponse.json({ error: 'Una o más órdenes no encontradas' }, { status: 404 })
    }

    const allFromTable = orders.every((o: { table_id: string }) => o.table_id === table_id)
    if (!allFromTable) {
      return NextResponse.json({ error: 'Las órdenes no pertenecen a la mesa especificada' }, { status: 400 })
    }

    const allDelivered = orders.every((o: { status: string }) => ['delivered', 'paying'].includes(o.status))
    if (!allDelivered) {
      return NextResponse.json({ error: 'Algunas órdenes no están listas para cobrar' }, { status: 400 })
    }

    const ordersTotal = orders.reduce((sum: number, o: { total: number }) => sum + (o.total || 0), 0)
    if (Math.abs(ordersTotal - total_amount) > 100) {
      console.warn('[POST /api/bills/split] Total mismatch:', { ordersTotal, total_amount })
      return NextResponse.json(
        { error: `El total no coincide. Esperado: ${ordersTotal}, Recibido: ${total_amount}` },
        { status: 400 }
      )
    }

    // Crear bill_split (admin para evitar RLS en INSERT)
    const { data: billSplit, error: insertError } = await adminSupabase
      .from('bill_splits')
      .insert({
        restaurant_id,
        table_id,
        order_ids,
        split_type,
        total_amount,
        num_splits,
        split_config: split_config || {},
        status: 'pending',
        num_paid: 0
      })
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/bills/split] Error creating bill_split:', insertError)
      return NextResponse.json({ error: 'Error al crear división de cuenta' }, { status: 500 })
    }

    // Actualizar órdenes a 'paying'
    await adminSupabase
      .from('orders')
      .update({ status: 'paying' })
      .in('id', order_ids)
      .neq('status', 'paying')

    return NextResponse.json({
      bill_split_id: billSplit.id,
      status: 'created',
      num_splits
    })

  } catch (error) {
    console.error('[POST /api/bills/split] Unexpected error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
