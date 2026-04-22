import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/tables/[tableId]/bill
 * 
 * Obtiene todas las comandas activas de una mesa y calcula el total
 * para preparar el cobro o división de cuenta.
 * 
 * @returns {
 *   orders: Order[],
 *   totalAmount: number,
 *   numOrders: number,
 *   tableLabel: string,
 *   pax: number
 * }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener información de la mesa
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, label, status, restaurant_id')
      .eq('id', tableId)
      .single()

    if (tableError || !table) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })
    }

    // Verificar que el usuario pertenece al restaurant
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', table.restaurant_id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No autorizado para esta mesa' }, { status: 403 })
    }

    // Obtener todas las comandas activas de la mesa
    // Incluimos 'delivered' y 'paying' ya que son las que se pueden cobrar
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        table_id,
        status,
        total,
        pax,
        client_name,
        notes,
        created_at,
        updated_at,
        order_items (
          id,
          name,
          quantity,
          unit_price,
          notes,
          status,
          destination
        )
      `)
      .eq('table_id', tableId)
      .in('status', ['delivered', 'paying'])
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('[GET /api/tables/[tableId]/bill] Error fetching orders:', ordersError)
      return NextResponse.json({ error: 'Error al obtener comandas' }, { status: 500 })
    }

    // Calcular total y obtener pax
    const totalAmount = orders.reduce((sum, order) => sum + (order.total || 0), 0)
    const pax = orders.reduce((max, order) => Math.max(max, order.pax || 0), 0)

    return NextResponse.json({
      orders,
      totalAmount,
      numOrders: orders.length,
      tableLabel: table.label,
      tableId: table.id,
      pax,
      tableStatus: table.status
    })

  } catch (error) {
    console.error('[GET /api/tables/[tableId]/bill] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
