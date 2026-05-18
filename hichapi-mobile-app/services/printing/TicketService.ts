/**
 * TicketService
 *
 * Handles grouping order items by destination and sending tickets to the Notifier.
 * Mirrors the logic from the web app.
 */

import { supabase } from '../../config/supabase';
import type { TicketGroup, Printer, Order, OrderItem } from '../../types/models';

const NOTIFIER_URL = process.env.EXPO_PUBLIC_NOTIFIER_URL?.replace(/\/$/, '') || 'https://api.notifier.realdev.cl';

export interface TicketContext {
  restaurantId: string;
  tableLabel: string;
  orderId: string;
  waiterName?: string;
  clientName?: string;
  address?: string;
  neighborhood?: string;
}

export class TicketService {
  /**
   * Fetches all active printers for a restaurant.
   */
  static async getPrinters(restaurantId: string): Promise<Printer[]> {
    const { data, error } = await supabase
      .from('printers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('active', true);

    if (error) {
      console.error('[TicketService] Error fetching printers:', error);
      return [];
    }
    return data || [];
  }

  /**
   * Sends a single ticket to the notifier.
   */
  static async postTicket(
    printerName: string,
    ctx: TicketContext,
    items: { name: string; quantity: number; notes: string }[]
  ): Promise<boolean> {
    const endpoint = `${NOTIFIER_URL}/api/solicita_ticket`;

    const payload = {
      comercio: ctx.restaurantId,
      impresora: printerName,
      mesa: ctx.tableLabel,
      movimiento: ctx.orderId,
      mesero: ctx.waiterName || '',
      nombrecli: ctx.clientName || '',
      detalle: items.map((i) => ({
        nombre: i.name,
        cantidad: i.quantity,
        observacion: i.notes || '',
      })),
    };

    console.log(`[TicketService] Sending to ${printerName}:`, JSON.stringify(payload));

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      console.error(`[TicketService] Network error sending to ${printerName}:`, err);
      return false;
    }
  }

  /**
   * Sends a pre-check (precuenta) ticket.
   */
  static async requestPrecuenta(
    printerName: string,
    ctx: TicketContext,
    order: Order,
    items: OrderItem[]
  ): Promise<boolean> {
    const endpoint = `${NOTIFIER_URL}/api/pre_cuenta`;

    const payload = {
      comercio: ctx.restaurantId,
      impresora: printerName || 'CAJA',
      comuna: ctx.neighborhood || '',
      direccion: ctx.address || '',
      movimiento: order.id,
      nombrecli: order.client_name || '',
      detalle: items.map((i) => ({
        nombre: i.name,
        cantidad: i.quantity,
        precio: i.unit_price,
        subtotal: i.quantity * i.unit_price,
      })),
      totales: [{ total: order.total }],
    };

    console.log(`[TicketService] Requesting Precuenta to ${endpoint}`);
    console.log(`[TicketService] Payload:`, JSON.stringify(payload, null, 2));

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': '*/*',
        },
        body: JSON.stringify(payload),
      });
      console.log(`[TicketService] Response status: ${res.status}`);
      return res.ok;
    } catch (err) {
      console.error(`[TicketService] Error requesting precuenta:`, err);
      return false;
    }
  }

  /**
   * Groups items by destination and returns groups that need manual printer selection.
   * Auto-sends groups with exactly one printer.
   */
  static async prepareAndSendTickets(
    items: { name: string; quantity: number; notes: string; destination: string }[],
    ctx: TicketContext,
    printers: Printer[]
  ): Promise<TicketGroup[]> {
    const byKind = new Map<string, typeof items>();
    for (const item of items) {
      const kind = this.destToKind(item.destination);
      if (!kind) continue;
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind)!.push(item);
    }

    const needsSelection: TicketGroup[] = [];

    for (const [kind, kindItems] of byKind.entries()) {
      const kindPrinters = printers.filter((p) => p.kind === kind);

      if (kindPrinters.length === 0) continue;

      if (kindPrinters.length === 1) {
        // Auto-send
        await this.postTicket(
          kindPrinters[0].name,
          ctx,
          kindItems.map((i) => ({ name: i.name, quantity: i.quantity, notes: i.notes }))
        );
      } else {
        // Requires selection
        needsSelection.push({
          kind,
          items: kindItems.map((i) => ({ nombre: i.name, cantidad: i.quantity, observacion: i.notes })),
          printers: kindPrinters.map((p) => ({ id: p.id, name: p.name })),
        });
      }
    }

    return needsSelection;
  }

  private static destToKind(destination: string): 'cocina' | 'barra' | null {
    if (destination === 'cocina') return 'cocina';
    if (destination === 'barra') return 'barra';
    return null;
  }
}
