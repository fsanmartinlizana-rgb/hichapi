/**
 * sendStationTickets
 *
 * Groups order items by destination (cocina/barra), matches each group
 * to the configured printers, and POSTs to the notifier.
 *
 * Returns the groups that need manual printer selection (multiple printers).
 * Groups with a single printer are sent immediately.
 */

import type { TicketGroup } from '@/components/manual-print/TicketPrinterModal'

const NOTIFIER_URL =
  (typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_NOTIFIER_PRINT_URL
    : process.env.NOTIFIER_PRINT_URL ?? process.env.NEXT_PUBLIC_NOTIFIER_PRINT_URL
  )?.replace(/\/$/, '') ?? 'https://api.notifier.realdev.cl'

export interface OrderItemForTicket {
  name:        string
  quantity:    number
  notes:       string | null
  destination: string | null   // 'cocina' | 'barra' | 'ninguno'
}

export interface TicketContext {
  restaurantId: string
  tableLabel:   string
  orderId:      string
  waiterName?:  string
  clientName?:  string
}

interface PrinterRow {
  id:   string
  name: string
  kind: string
}

/**
 * Map destination → printer kind
 * 'cocina' items → cocina printers
 * 'barra'  items → barra printers
 */
function destToKind(destination: string): 'cocina' | 'barra' | null {
  if (destination === 'cocina') return 'cocina'
  if (destination === 'barra')  return 'barra'
  return null
}

/**
 * Send a single ticket to the notifier.
 */
async function postTicket(
  printerName: string,
  ctx:         TicketContext,
  items:       OrderItemForTicket[]
): Promise<void> {
  const endpoint = `${NOTIFIER_URL}/api/solicita_ticket`

  const payload = {
    comercio:  ctx.restaurantId,
    impresora: printerName,
    mesa:      ctx.tableLabel,
    movimiento: ctx.orderId,
    mesero:    ctx.waiterName || '',
    nombrecli: ctx.clientName || '',
    detalle:   items.map(i => ({
      nombre:      i.name,
      cantidad:    i.quantity,
      observacion: i.notes || '',
    })),
  }

  // ── DEBUG LOG ─────────────────────────────────────────────────────────────
  console.group(`%c[🖨️ TICKET] → ${printerName}`, 'color:#FF6B35;font-weight:bold')
  console.log('URL:', endpoint)
  console.log('Payload:', JSON.stringify(payload, null, 2))
  console.groupEnd()
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(`%c[🖨️ TICKET] ❌ ${printerName} → HTTP ${res.status}: ${text}`, 'color:#F87171')
    } else {
      const responseText = await res.text().catch(() => '')
      console.log(`%c[🖨️ TICKET] ✅ ${printerName} → OK`, 'color:#34D399', responseText || '')
    }
  } catch (err: any) {
    console.error(`%c[🖨️ TICKET] 💥 ${printerName} → Error de red:`, 'color:#F87171', err?.message ?? err)
  }
}

/**
 * Main function.
 *
 * 1. Groups items by destination kind (cocina/barra).
 * 2. For each group, finds matching printers from the restaurant's printer list.
 * 3. If 1 printer → sends immediately.
 * 4. If >1 printers → returns the group for manual selection.
 * 5. If 0 printers → skips.
 *
 * Returns groups that need manual printer selection.
 */
export async function prepareAndSendTickets(
  items:    OrderItemForTicket[],
  ctx:      TicketContext,
  printers: PrinterRow[]
): Promise<TicketGroup[]> {
  // Group items by destination kind
  const byKind = new Map<string, OrderItemForTicket[]>()
  for (const item of items) {
    const kind = destToKind(item.destination ?? 'ninguno')
    if (!kind) continue  // skip 'ninguno'
    if (!byKind.has(kind)) byKind.set(kind, [])
    byKind.get(kind)!.push(item)
  }

  // ── DEBUG LOG ─────────────────────────────────────────────────────────────
  console.group('%c[🖨️ TICKETS] Preparando envío de tickets', 'color:#FF6B35;font-weight:bold')
  console.log('Impresoras disponibles:', printers.map(p => `${p.name} (${p.kind})`))
  console.log('Items agrupados por destino:')
  byKind.forEach((kindItems, kind) => {
    console.log(`  ${kind}:`, kindItems.map(i => `${i.quantity}× ${i.name}`))
  })
  // ─────────────────────────────────────────────────────────────────────────

  const needsSelection: TicketGroup[] = []

  for (const [kind, kindItems] of byKind.entries()) {
    const kindPrinters = printers.filter(p => p.kind === kind && kindItems.length > 0)

    if (kindPrinters.length === 0) {
      console.log(`%c[🖨️ TICKETS] ⚠️ Sin impresoras para "${kind}" — ticket omitido`, 'color:#FBBF24')
      continue
    }

    if (kindPrinters.length === 1) {
      console.log(`%c[🖨️ TICKETS] Auto-enviando a ${kindPrinters[0].name} (${kind})`, 'color:#60A5FA')
      await postTicket(kindPrinters[0].name, ctx, kindItems)
    } else {
      console.log(`%c[🖨️ TICKETS] Múltiples impresoras para "${kind}" — requiere selección:`, 'color:#A78BFA', kindPrinters.map(p => p.name))
      needsSelection.push({
        kind,
        items: kindItems.map(i => ({
          nombre:      i.name,
          cantidad:    i.quantity,
          observacion: i.notes || '',
        })),
        printers: kindPrinters.map(p => ({ id: p.id, name: p.name })),
      })
    }
  }

  if (needsSelection.length === 0) {
    console.log('%c[🖨️ TICKETS] ✅ Todos los tickets enviados automáticamente', 'color:#34D399')
  } else {
    console.log(`%c[🖨️ TICKETS] ⏳ ${needsSelection.length} grupo(s) esperan selección del garzón`, 'color:#FBBF24')
  }
  console.groupEnd()

  return needsSelection
}

/**
 * Send tickets for groups where the waiter has already selected a printer.
 */
export async function sendSelectedTickets(
  groups:     TicketGroup[],
  selections: Record<string, string>,   // kind → printerName
  ctx:        TicketContext
): Promise<void> {
  const sends: Promise<void>[] = []
  for (const group of groups) {
    const printerName = selections[group.kind]
    if (!printerName) continue
    sends.push(postTicket(printerName, ctx, group.items.map(i => ({
      name:        i.nombre,
      quantity:    i.cantidad,
      notes:       i.observacion || null,
      destination: group.kind,
    }))))
  }
  await Promise.allSettled(sends)
}
