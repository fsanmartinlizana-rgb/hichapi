/**
 * Lógica pura del resumen semanal de mermas (contador del /mermas).
 *
 * Extraída de app/api/mermas/route.ts para poder unit-testear el bug 2026-06:
 * las devoluciones de comanda se registran con item_type='plato', pero el
 * resumen filtraba item_type='stock' y las excluía del contador aunque sí
 * estaban en waste_log. Ahora se cuentan TODAS (stock + plato).
 */

/** Fila de waste_log tal como la devuelve Supabase (el join puede venir como
 *  objeto o como array de un elemento según la relación). */
export interface WasteRow {
  item_type?: string | null
  qty_lost?: number | null
  cost_lost?: number | null
  stock_items?: { name: string; unit: string } | { name: string; unit: string }[] | null
  menu_items?: { name: string } | { name: string }[] | null
}

export interface WasteProductSummary {
  name: string
  unit: string
  qty_total: number
  cost_total: number
}

export interface WasteSummary {
  total_products_affected: number
  total_cost: number
  by_product: WasteProductSummary[]
}

function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/**
 * Agrupa las mermas por producto (insumo de stock) o por plato (devolución),
 * sumando cantidad y costo. Incluye ambos item_type.
 */
export function buildWasteSummary(entries: WasteRow[]): WasteSummary {
  const byProduct: Record<string, WasteProductSummary> = {}
  let total_cost = 0

  for (const e of entries) {
    const si = firstOf(e.stock_items)
    const mi = firstOf(e.menu_items)
    // Stock → nombre del insumo. Devolución de comanda → nombre del plato.
    const name = si?.name ?? mi?.name ?? 'Desconocido'
    const unit = si?.unit ?? (e.item_type === 'plato' ? 'plato' : '')

    if (!byProduct[name]) byProduct[name] = { name, unit, qty_total: 0, cost_total: 0 }
    byProduct[name].qty_total += e.qty_lost ?? 0
    byProduct[name].cost_total += e.cost_lost ?? 0
    total_cost += e.cost_lost ?? 0
  }

  return {
    total_products_affected: Object.keys(byProduct).length,
    total_cost,
    by_product: Object.values(byProduct).sort((a, b) => b.cost_total - a.cost_total),
  }
}
