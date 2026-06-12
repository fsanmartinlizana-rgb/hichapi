/**
 * Construye la fila de waste_log para un ítem de comanda que se desecha
 * (cancelación de pedido preparado o eliminación de un producto).
 *
 * Unifica la lógica de merma de los flujos:
 *   - /api/orders/cancel        (cancelar comanda)
 *   - /api/orders/items DELETE  (quitar producto de comanda)
 *   - /api/mermas/from-devolucion (devolución) usa el mismo resolver
 *
 * Por qué existe: un plato preparado que se desecha debe quedar en mermas con
 * item_type='plato' + menu_item_id. El bug histórico era loguear solo contra
 * stock_item_id (null para platos sin receta) → violaba el CHECK
 * waste_log_item_presence → el insert fallaba en silencio.
 */

import { resolveWasteItem, type MenuCandidate, type StockCandidate } from './resolve'

export interface OrderItemForWaste {
  name:          string
  menu_item_id?: string | null
  quantity:      number
  unit_price?:   number | null
}

export interface WasteRowOpts {
  restaurant_id:    string
  reason:           string   // debe ser válido para waste_log_reason_check
  already_deducted: boolean  // true si el stock ya se descontó al preparar
  logged_by:        string | null
  note:             string
}

/**
 * Devuelve la fila lista para insertar en waste_log, o null si no se pudo
 * resolver el ítem (ni plato ni insumo). El caller decide qué hacer con null
 * (saltar / avisar).
 */
export function buildOrderItemWasteRow(
  item: OrderItemForWaste,
  menu: MenuCandidate[],
  stock: StockCandidate[],
  opts: WasteRowOpts,
): Record<string, unknown> | null {
  let menu_item_id: string | null = item.menu_item_id ?? null
  let stock_item_id: string | null = null
  let item_type: 'plato' | 'stock' = 'plato'
  let unitCost = item.unit_price ?? 0

  if (menu_item_id) {
    // Ya sabemos el plato; usamos su costo de receta si está disponible.
    const m = menu.find(x => x.id === menu_item_id)
    if (m?.cost_price && m.cost_price > 0) unitCost = m.cost_price
  } else {
    // Resolver por nombre (plato primero, luego insumo).
    const match = resolveWasteItem(item.name, menu, stock)
    if (!match) return null
    menu_item_id  = match.menu_item_id
    stock_item_id = match.stock_item_id
    item_type     = match.item_type
    if (match.cost_lost > 0) unitCost = match.cost_lost
  }

  return {
    restaurant_id:    opts.restaurant_id,
    item_type,
    menu_item_id,
    stock_item_id,
    qty_lost:         item.quantity,
    reason:           opts.reason,
    notes:            opts.note,
    cost_lost:        Math.round(unitCost * item.quantity),
    logged_by:        opts.logged_by,
    already_deducted: opts.already_deducted,
  }
}
