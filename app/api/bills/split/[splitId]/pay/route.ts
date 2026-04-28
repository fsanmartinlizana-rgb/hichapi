import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { runEmission } from '@/lib/dte/engine'
import { sendBoletaEmail, sendFacturaEmail } from '@/lib/email/sender'

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
    const { split_index, amount, tip_amount, payment_method, cash_amount, digital_amount, dte } = body
    // dteAmount = monto sin propina (lo que va en la boleta)
    const dteAmount = Math.max(1, amount - (tip_amount || 0))

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

    // 2. Actualizar bill_split
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

    // 3. Si completado, marcar órdenes y mesa ANTES de emitir DTE
    //    (el engine requiere que la orden esté en estado 'paid')
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

    // 4. Emitir DTE — llamada directa a runEmission (sin fetch HTTP interno)
    //    El fetch interno fallaba con 401 porque no tenía las cookies de sesión del usuario.
    //    runEmission es la función que hace el trabajo real, la llamamos directamente.
    let dteResult: { folio?: number; xml?: string; status?: string } = {}
    try {
      // Obtener el RUT del restaurante emisor (requerido por la tabla dte_emissions)
      const { data: restaurant } = await adminSupabase
        .from('restaurants')
        .select('rut, razon_social')
        .eq('id', billSplit.restaurant_id)
        .single()

      if (!restaurant?.rut) {
        console.error('[pay] Restaurant RUT not found for DTE emission, skipping')
        throw new Error('Restaurante sin RUT configurado')
      }

      // Calcular net/iva desde el monto del split SIN propina (dteAmount)
      const IVA_RATE = 0.19
      const net = Math.round(dteAmount / (1 + IVA_RATE))
      const iva = dteAmount - net

      // Insertar fila en dte_emissions antes de llamar al engine
      const { data: emission, error: emissionInsertErr } = await adminSupabase
        .from('dte_emissions')
        .insert({
          restaurant_id:      billSplit.restaurant_id,
          order_id:           billSplit.order_ids[0],
          document_type:      dte.document_type,
          rut_emisor:         restaurant.rut,
          rut_receptor:       dte.rut_receptor ?? null,
          razon_receptor:     dte.razon_receptor ?? null,
          giro_receptor:      dte.giro_receptor ?? null,
          direccion_receptor: dte.direccion_receptor ?? null,
          comuna_receptor:    dte.comuna_receptor ?? null,
          fma_pago:           dte.fma_pago ?? (payment_method === 'cash' ? 1 : 2),
          email_receptor:     dte.email_receptor ?? null,
          status:             'pending',
          emitted_by:         user.id,
          net_amount:         net,
          iva_amount:         iva,
          total_amount:       dteAmount,  // sin propina
        })
        .select('id')
        .single()

      if (emissionInsertErr || !emission) {
        console.error('[pay] Error inserting dte_emission:', emissionInsertErr)
        throw new Error('No se pudo crear la emisión DTE')
      }

      // Para by_items: enriquecer items con tax_exempt desde order_items de la orden
      let taxExemptByName: Record<string, boolean> = {}
      if (billSplit.split_type === 'by_items' && billSplit.num_splits > 1) {
        const { data: orderItemsForTax } = await adminSupabase
          .from('order_items')
          .select('name, menu_item_id, menu_items(tax_exempt)')
          .eq('order_id', billSplit.order_ids[0])
        ;(orderItemsForTax ?? []).forEach((oi: any) => {
          if (oi.menu_items?.tax_exempt === true) {
            taxExemptByName[oi.name] = true
          }
        })
      }

      const emitResult = await runEmission(
        emission.id,
        billSplit.restaurant_id,
        billSplit.order_ids[0],
        dte.document_type as 33 | 39 | 41 | 56 | 61,
        dte.rut_receptor,
        dte.razon_receptor,
        dte.giro_receptor,
        dte.direccion_receptor,
        dte.comuna_receptor,
        dte.fma_pago ?? (payment_method === 'cash' ? 1 : 2),
        // Determinar items para el DTE:
        // - Pago completo (1 persona): cargar order_items reales (engine los carga)
        // - by_items: usar los items asignados a esta persona, enriquecidos con ind_exe
        // - equal/custom: ítem genérico "Consumo"
        (() => {
          if (billSplit.num_splits === 1) return undefined
          if (billSplit.split_type === 'by_items') {
            const itemsPerSplit = billSplit.split_config?.items_per_split as Array<Array<{ name: string; quantity: number; unit_price: number }>> | undefined
            const personItems = itemsPerSplit?.[split_index]
            if (personItems && personItems.length > 0) {
              return personItems.map(i => ({
                ...i,
                ...(taxExemptByName[i.name] ? { ind_exe: 1 as const } : {}),
              }))
            }
          }
          return [{ name: 'Consumo', quantity: 1, unit_price: dteAmount }]
        })(),
        undefined, // descuentoGlobal
        undefined, // tipoDocRef
        undefined, // folioRef
        undefined, // fchRef
        undefined, // codRef
        undefined, // razonRef
        true,      // skipDuplicateCheck — múltiples boletas por orden en split
      )

      if (emitResult.ok) {
        dteResult = { folio: emitResult.folio, xml: emitResult.signed_xml, status: 'accepted' }
        await adminSupabase
          .from('bill_split_payments')
          .update({ dte_folio: emitResult.folio, dte_xml: emitResult.signed_xml, dte_status: 'accepted' })
          .eq('id', payment.id)

        // Enviar email si hay email_receptor y el DTE se emitió correctamente
        if (dte.email_receptor && emitResult.folio) {
          // Para pago completo (1 persona): cargar order_items reales
          // Para by_items: usar los items asignados a esta persona
          // Para equal/custom: ítem genérico con el monto SIN propina
          let mappedItems: Array<{ name: string; quantity: number; unit_price: number }>
          if (billSplit.num_splits === 1) {
            const { data: orderItems } = await adminSupabase
              .from('order_items')
              .select('name, quantity, unit_price')
              .eq('order_id', billSplit.order_ids[0])
              .neq('status', 'cancelled')
            mappedItems = (orderItems ?? []).map((i: { name: string; quantity: number; unit_price: number }) => ({
              name: i.name, quantity: i.quantity, unit_price: i.unit_price,
            }))
            if (mappedItems.length === 0) {
              mappedItems = [{ name: 'Consumo', quantity: 1, unit_price: dteAmount }]
            }
          } else if (billSplit.split_type === 'by_items') {
            const itemsPerSplit = billSplit.split_config?.items_per_split as Array<Array<{ name: string; quantity: number; unit_price: number }>> | undefined
            const personItems = itemsPerSplit?.[split_index]
            mappedItems = (personItems && personItems.length > 0)
              ? personItems
              : [{ name: 'Consumo', quantity: 1, unit_price: dteAmount }]
          } else {
            mappedItems = [{ name: 'Consumo', quantity: 1, unit_price: dteAmount }]
          }

          const emailArgs = {
            to:             dte.email_receptor,
            orderId:        billSplit.order_ids[0],
            folio:          emitResult.folio,
            restaurantName: restaurant.razon_social ?? restaurant.rut,
            totalAmount:    dteAmount,
            emittedAt:      new Date().toISOString(),
            items:          mappedItems,
            xmlBase64: emitResult.signed_xml
              ? Buffer.from(emitResult.signed_xml).toString('base64')
              : undefined,
          }

          // Email sending is now handled by batch status check to avoid duplicates
          // and ensure the DTE is accepted by SII before sending
          if (dte.document_type === 39 || dte.document_type === 41) {
            // Only send boletas immediately (they don't need SII acceptance)
            void sendBoletaEmail(emailArgs)
              .catch(err => console.error('[pay] sendBoletaEmail error:', err))
          }
          // Facturas will be sent by batch when status changes to 'accepted'
        }

        // Guardar receptor en directorio para autocompletado futuro (solo facturas)
        if (dte.document_type === 33 && dte.rut_receptor && dte.razon_receptor) {
          void adminSupabase
            .from('dte_receptores')
            .upsert(
              {
                restaurant_id:  billSplit.restaurant_id,
                rut:            dte.rut_receptor,
                razon_social:   dte.razon_receptor,
                giro:           dte.giro_receptor ?? null,
                direccion:      dte.direccion_receptor ?? null,
                comuna:         dte.comuna_receptor ?? null,
                email:          dte.email_receptor ?? null,
                ultima_emision: new Date().toISOString(),
              },
              { onConflict: 'restaurant_id,rut', ignoreDuplicates: false }
            )
            .then(() => {
              // Incrementar contador de facturas emitidas
              return adminSupabase.rpc('increment_receptor_facturas', {
                p_restaurant_id: billSplit.restaurant_id,
                p_rut:           dte.rut_receptor,
              }).maybeSingle()
            })
            .catch(() => { /* non-critical */ })
        }
      } else {
        console.error('[pay] DTE runEmission failed:', emitResult.error)
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
