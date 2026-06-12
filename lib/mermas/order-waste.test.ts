import { describe, it, expect } from 'vitest'
import { buildOrderItemWasteRow } from './order-waste'
import type { MenuCandidate, StockCandidate } from './resolve'

const MENU: MenuCandidate[] = [
  { id: 'm1', name: 'Lomo vetado', cost_price: 4500 },
  { id: 'm2', name: 'Pisco sour', cost_price: null },
]
const STOCK: StockCandidate[] = [{ id: 's1', name: 'Vino tinto', cost_per_unit: 6000 }]
const opts = { restaurant_id: 'r1', reason: 'merma', already_deducted: true, logged_by: 'u1', note: 'test' }

describe('buildOrderItemWasteRow', () => {
  it('item con menu_item_id → plato, usa cost_price de la receta', () => {
    const row = buildOrderItemWasteRow({ name: 'Lomo vetado', menu_item_id: 'm1', quantity: 2, unit_price: 9000 }, MENU, STOCK, opts)
    expect(row).toMatchObject({
      item_type: 'plato', menu_item_id: 'm1', stock_item_id: null,
      qty_lost: 2, reason: 'merma', cost_lost: 9000, already_deducted: true,
    })
  })

  it('item sin menu_item_id → resuelve por nombre (plato)', () => {
    const row = buildOrderItemWasteRow({ name: 'Pisco sour', quantity: 1, unit_price: 5000 }, MENU, STOCK, opts)
    // cost_price es null → usa unit_price
    expect(row).toMatchObject({ item_type: 'plato', menu_item_id: 'm2', cost_lost: 5000 })
  })

  it('item sin menu_item_id que es insumo → resuelve a stock', () => {
    const row = buildOrderItemWasteRow({ name: 'Vino tinto', quantity: 2 }, MENU, STOCK, opts)
    expect(row).toMatchObject({ item_type: 'stock', stock_item_id: 's1', menu_item_id: null, cost_lost: 12000 })
  })

  it('satisface el CHECK: siempre menu_item_id O stock_item_id no-null', () => {
    const row = buildOrderItemWasteRow({ name: 'Lomo vetado', menu_item_id: 'm1', quantity: 1 }, MENU, STOCK, opts)!
    expect(row.menu_item_id ?? row.stock_item_id).toBeTruthy()
  })

  it('item no resoluble (sin menu_item_id, no matchea) → null', () => {
    const row = buildOrderItemWasteRow({ name: 'Sushi', quantity: 1 }, MENU, STOCK, opts)
    expect(row).toBeNull()
  })

  it('respeta reason y already_deducted del opts', () => {
    const row = buildOrderItemWasteRow({ name: 'Lomo vetado', menu_item_id: 'm1', quantity: 1 }, MENU, STOCK,
      { ...opts, reason: 'perdida', already_deducted: false })
    expect(row).toMatchObject({ reason: 'perdida', already_deducted: false })
  })

  it('cost_lost se redondea', () => {
    const row = buildOrderItemWasteRow({ name: 'X', menu_item_id: 'mx', quantity: 3, unit_price: 333.33 },
      [{ id: 'mx', name: 'X', cost_price: null }], [], opts)!
    expect(Number.isInteger(row.cost_lost)).toBe(true)
  })
})
