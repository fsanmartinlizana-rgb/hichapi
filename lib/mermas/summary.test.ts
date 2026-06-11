import { describe, it, expect } from 'vitest'
import { buildWasteSummary, type WasteRow } from './summary'

describe('buildWasteSummary', () => {
  // El bug: devoluciones de comanda (item_type='plato') quedaban fuera del
  // contador porque el resumen filtraba item_type='stock'.
  it('CUENTA las devoluciones de plato (regresión del bug 2026-06)', () => {
    const entries: WasteRow[] = [
      { item_type: 'plato', qty_lost: 1, cost_lost: 4500, menu_items: { name: 'Lomo vetado' }, stock_items: null },
    ]
    const s = buildWasteSummary(entries)
    expect(s.total_products_affected).toBe(1)
    expect(s.total_cost).toBe(4500)
    expect(s.by_product[0]).toMatchObject({ name: 'Lomo vetado', unit: 'plato', qty_total: 1, cost_total: 4500 })
  })

  it('mezcla stock + plato en el mismo resumen', () => {
    const entries: WasteRow[] = [
      { item_type: 'stock', qty_lost: 2, cost_lost: 3000, stock_items: { name: 'Tomate', unit: 'kg' }, menu_items: null },
      { item_type: 'plato', qty_lost: 1, cost_lost: 4500, stock_items: null, menu_items: { name: 'Lomo vetado' } },
    ]
    const s = buildWasteSummary(entries)
    expect(s.total_products_affected).toBe(2)
    expect(s.total_cost).toBe(7500)
    // Ordenado por costo desc → Lomo (4500) antes que Tomate (3000)
    expect(s.by_product[0].name).toBe('Lomo vetado')
    expect(s.by_product[1].name).toBe('Tomate')
    expect(s.by_product[1].unit).toBe('kg')
  })

  it('agrupa múltiples devoluciones del mismo plato', () => {
    const entries: WasteRow[] = [
      { item_type: 'plato', qty_lost: 1, cost_lost: 4500, menu_items: { name: 'Lomo vetado' } },
      { item_type: 'plato', qty_lost: 1, cost_lost: 4500, menu_items: { name: 'Lomo vetado' } },
      { item_type: 'plato', qty_lost: 1, cost_lost: 4500, menu_items: { name: 'Lomo vetado' } },
    ]
    const s = buildWasteSummary(entries)
    expect(s.total_products_affected).toBe(1)
    expect(s.by_product[0]).toMatchObject({ name: 'Lomo vetado', qty_total: 3, cost_total: 13500 })
  })

  it('soporta join de Supabase como array (no solo objeto)', () => {
    const entries: WasteRow[] = [
      { item_type: 'plato', qty_lost: 1, cost_lost: 2000, menu_items: [{ name: 'Pisco sour' }] },
      { item_type: 'stock', qty_lost: 1, cost_lost: 1000, stock_items: [{ name: 'Pisco', unit: 'l' }] },
    ]
    const s = buildWasteSummary(entries)
    expect(s.by_product.find(p => p.name === 'Pisco sour')).toBeTruthy()
    expect(s.by_product.find(p => p.name === 'Pisco')?.unit).toBe('l')
  })

  it('cost_lost / qty_lost nulos se tratan como 0 (no NaN)', () => {
    const entries: WasteRow[] = [
      { item_type: 'plato', qty_lost: null, cost_lost: null, menu_items: { name: 'Sin costo' } },
    ]
    const s = buildWasteSummary(entries)
    expect(s.total_cost).toBe(0)
    expect(s.by_product[0]).toMatchObject({ qty_total: 0, cost_total: 0 })
    expect(Number.isNaN(s.total_cost)).toBe(false)
  })

  it('fila sin nombre de stock ni plato → "Desconocido"', () => {
    const entries: WasteRow[] = [
      { item_type: 'stock', qty_lost: 1, cost_lost: 500, stock_items: null, menu_items: null },
    ]
    const s = buildWasteSummary(entries)
    expect(s.by_product[0].name).toBe('Desconocido')
  })

  it('lista vacía → resumen en cero, sin crashear', () => {
    const s = buildWasteSummary([])
    expect(s).toEqual({ total_products_affected: 0, total_cost: 0, by_product: [] })
  })
})
