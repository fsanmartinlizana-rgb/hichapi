import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ splitId: string }> }
) {
  try {
    const { splitId } = await params
    const supabase = await createClient()
    const adminSupabase = createAdminClient() // bypass RLS para operaciones internas

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { split_index, amount, payment_method, cash_amount, digital_amount, dte } = body

    // Validaciones básicas
    if (split_index === undefined || !amount || !payment_method || !dte) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }
    if (!['cash', 'digital', 'mixed'].includes(payment_method)) {
      return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })
    }
    if (amount <= 0) {
      return NextResponse.json({ error: 'Monto debe ser mayor a 0' }, { status: 400 })
    }
    const totalPaid = (cash_amount || 0) + (digital_amount || 0)
    if (Math.abs(totalPaid - amount) > 1) {
      return NextResponse.json(
        { error: 'La suma de efectivo y digital no coincide con el monto total' },
        { status: 400 }
      )
    }

    // Obtener el bill_split (admin client para evitar RLS)
    const { data: billSplit, error: splitError } = await adminSupabase
      .from('bill_splits')
      .select('*')
      .eq('id', splitId)
      .single()

    if (splitError || !billSplit) {
      console.error('[pay] bill_split not found:', { splitId, splitError })
      return NextResponse.json({ error: 'División de cuenta no encontrada' }, { status: 404 })
    }

    // Verificar que el usuario pertenece al restaurant
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', billSplit.restaurant_id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No autorizado para este restaurant' }, { status: 403 })
    }

    // Verificar que el split_index es válido
    if (split_index < 0 || split_index >= billSplit.num_splits) {
      return NextResponse.json(
        { error: `Índice de división inválido. Debe estar entre 0 y ${billSplit.num_splits - 1}` },
        { status: 400 }
      )
    }

    // Verificar que esta división no ha sido pagada ya
    const { data: existingPayment } = await adminSupabase
      .from('bill_split_payments')
      .select('id')
      .eq('bill_split_id', splitId)
      .eq('split_index', split_index)
      .single()

    if (existingPayment) {
      return NextResponse.json({ error: 'Esta división ya ha sido pagada' }, { status: 400 })
    }

    // 1. Registrar el pago
    const { data: payment, error: paymentError } = await adminSupabase
      .from('bill_split_payments')
      .insert({
        bill_split_id: splitId,
        split_index,
        amount,
        payment_method,
        cash_amount: cash_amount || 0,
        digital_amount: digital_amount || 0,
        dte_type: dte.document_type,
        dte_status: 'pending',
        dte_receptor: dte.document_type === 33 ? {
          rut: dte.rut_receptor,
          razon_social: dte.razon_receptor,
          giro: dte.giro_receptor,
          direccion: dte.direccion_receptor,
          comuna: dte.comuna_receptor,
          email: dte.email_receptor
        } : null
      })
      .select()
      .single()

    if (paymentError) {
      console.error('[pay] Error creating payment:', paymentError)
      return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
    }

    // 2. Emitir DTE (fire and forget)
    let dteResult: { folio?: number; xml?: string; status?: string } = {}
    try {
      const origin = new URL(request.url).origin
      const dteResponse = await fetch(`${origin}/api/dte/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: billSplit.restaurant_id,
          order_id: billSplit.order_ids[0], // Usar el primer order_id (el DTE se emite por el monto total)
          amount,
          document_type: dte.document_type,
          rut_receptor: dte.rut_receptor,
          razon_receptor: dte.razon_receptor,
          giro_receptor: dte.giro_receptor,
          direccion_receptor: dte.direccion_receptor,
          comuna_receptor: dte.comuna_receptor,
          fma_pago: dte.fma_pago || (payment_method === 'cash' ? 1 : 2),
          email_receptor: dte.email_receptor
        })
      })
      if (dteResponse.ok) {
        const dteData = await dteResponse.json()
        dteResult = { folio: dteData.folio, xml: dteData.xml, status: 'accepted' }
        await adminSupabase
          .from('bill_split_payments')
          .update({ dte_folio: dteResult.folio, dte_xml: dteResult.xml, dte_status: 'accepted' })
          .eq('id', payment.id)
      } else {
        const errorText = await dteResponse.text()
        console.error('[pay] DTE emit failed:', dteResponse.status, errorText)
        await adminSupabase
          .from('bill_split_payments')
          .update({ dte_status: 'error' })
          .eq('id', payment.id)
      }
    } catch (dteError) {
      console.error('[pay] DTE error:', dteError)
      await adminSupabase
        .from('bill_split_payments')
        .update({ dte_status: 'error' })
        .eq('id', payment.id)
    }

    // 3. Actualizar bill_split
    const newNumPaid = billSplit.num_paid + 1
    const isCompleted = newNumPaid === billSplit.num_splits
    const newStatus = isCompleted ? 'completed' : 'partial'

    await adminSupabase
      .from('bill_splits')
      .update({
        num_paid: newNumPaid,
        status: newStatus,
        completed_at: isCompleted ? new Date().toISOString() : null
      })
      .eq('id', splitId)

    // 4. Si completado, marcar órdenes y mesa
    if (isCompleted) {
      // Usar adminSupabase para las actualizaciones (bypassa RLS)
      await adminSupabase
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .in('id', billSplit.order_ids)

      // Actualizar la mesa a 'libre' con adminSupabase primero (garantiza que se actualice)
      await adminSupabase
        .from('tables')
        .update({ status: 'libre' })
        .eq('id', billSplit.table_id)

      // IMPORTANTE: Disparar evento de Realtime con el cliente autenticado
      // adminSupabase NO dispara eventos de Realtime, así que hacemos un UPDATE
      // adicional con el cliente autenticado para que los clientes QR reciban el evento
      console.log('[pay] Triggering realtime event for table:', billSplit.table_id)
      try {
        // Primero verificar el status actual
        const { data: currentTable } = await supabase
          .from('tables')
          .select('status')
          .eq('id', billSplit.table_id)
          .single()
        
        if (currentTable) {
          // Hacer UPDATE con el mismo valor para forzar el evento de Realtime
          const { error: realtimeError } = await supabase
            .from('tables')
            .update({ status: currentTable.status })
            .eq('id', billSplit.table_id)
          
          if (realtimeError) {
            console.error('[pay] Failed to trigger realtime event:', realtimeError)
          } else {
            console.log('[pay] Realtime event triggered successfully')
          }
        }
      } catch (realtimeError) {
        console.warn('[pay] Exception triggering realtime event:', realtimeError)
      }
    }

    return NextResponse.json({
      success: true,
      payment_id: payment.id,
      dte_folio: dteResult.folio,
      dte_status: dteResult.status || 'error',
      completed: isCompleted,
      num_paid: newNumPaid,
      num_splits: billSplit.num_splits
    })

  } catch (error) {
    console.error('[pay] Unexpected error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
