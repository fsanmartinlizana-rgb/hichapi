/**
 * Resolución del item de una devolución de comanda → merma.
 *
 * Extraída de app/api/mermas/from-devolucion para poder unit-testear el
 * matching y hacerlo robusto. El endpoint original usaba .maybeSingle() con
 * ilike, que se rompe (y traga el error) si hay nombres duplicados, y es
 * sensible a espacios/mayúsculas. Acá hacemos el match en JS sobre la lista
 * completa de la carta/inventario: trim + case-insensitive, exacto primero,
 * luego "contiene".
 */

export interface MenuCandidate {
  id: string
  name: string
  cost_price?: number | null
}

export interface StockCandidate {
  id: string
  name: string
  cost_per_unit?: number | null
}

export interface WasteMatch {
  item_type: 'plato' | 'stock'
  menu_item_id: string | null
  stock_item_id: string | null
  cost_lost: number
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Busca el item devuelto primero en la carta (plato — caso común de comanda),
 * luego en el inventario (insumo suelto). Devuelve null si no hay match.
 *
 * Prioridad de match dentro de cada lista: exacto (trim+lower) → contiene.
 */
export function resolveWasteItem(
  itemName: string,
  menu: MenuCandidate[],
  stock: StockCandidate[],
): WasteMatch | null {
  const target = norm(itemName)
  if (!target) return null

  // 1) Carta (plato)
  const menuMatch =
    menu.find(i => norm(i.name) === target) ??
    menu.find(i => norm(i.name).includes(target) || target.includes(norm(i.name)))
  if (menuMatch) {
    return {
      item_type: 'plato',
      menu_item_id: menuMatch.id,
      stock_item_id: null,
      cost_lost: menuMatch.cost_price ?? 0,
    }
  }

  // 2) Inventario (insumo suelto)
  const stockMatch =
    stock.find(i => norm(i.name) === target) ??
    stock.find(i => norm(i.name).includes(target) || target.includes(norm(i.name)))
  if (stockMatch) {
    return {
      item_type: 'stock',
      menu_item_id: null,
      stock_item_id: stockMatch.id,
      cost_lost: stockMatch.cost_per_unit ?? 0,
    }
  }

  return null
}
