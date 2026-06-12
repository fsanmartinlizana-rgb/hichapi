import { describe, it, expect } from 'vitest'
import { resolveWasteItem, type MenuCandidate, type StockCandidate } from './resolve'

const MENU: MenuCandidate[] = [
  { id: 'm1', name: 'Ceviche de reineta', cost_price: 4500 },
  { id: 'm2', name: 'Cordero al palo', cost_price: 9000 },
  { id: 'm3', name: 'Pisco sour clásico', cost_price: null },
]
const STOCK: StockCandidate[] = [
  { id: 's1', name: 'Vino tinto', cost_per_unit: 6000 },
  { id: 's2', name: 'Pisco', cost_per_unit: 8000 },
]

describe('resolveWasteItem', () => {
  it('matchea plato exacto → item_type plato + cost_price', () => {
    const r = resolveWasteItem('Cordero al palo', MENU, STOCK)
    expect(r).toEqual({ item_type: 'plato', menu_item_id: 'm2', stock_item_id: null, cost_lost: 9000 })
  })

  it('case-insensitive y con espacios (regresión del bug ilike+maybeSingle)', () => {
    const r = resolveWasteItem('  CEVICHE DE REINETA  ', MENU, STOCK)
    expect(r?.menu_item_id).toBe('m1')
  })

  it('cost_price null → cost_lost 0', () => {
    const r = resolveWasteItem('Pisco sour clásico', MENU, STOCK)
    expect(r).toMatchObject({ item_type: 'plato', menu_item_id: 'm3', cost_lost: 0 })
  })

  it('si no está en carta, busca en inventario (insumo suelto)', () => {
    const r = resolveWasteItem('Vino tinto', MENU, STOCK)
    expect(r).toEqual({ item_type: 'stock', menu_item_id: null, stock_item_id: 's1', cost_lost: 6000 })
  })

  it('prioriza carta sobre inventario cuando ambos podrían matchear', () => {
    // "Pisco" está en stock; "Pisco sour clásico" en carta. Buscar "Pisco sour"
    // debe caer en la carta por contains, no en el insumo.
    const r = resolveWasteItem('Pisco sour', MENU, STOCK)
    expect(r?.item_type).toBe('plato')
    expect(r?.menu_item_id).toBe('m3')
  })

  it('match por "contiene" cuando el nombre de comanda trae extra', () => {
    const r = resolveWasteItem('Cordero al palo (término medio)', MENU, STOCK)
    expect(r?.menu_item_id).toBe('m2')
  })

  it('no encontrado → null', () => {
    expect(resolveWasteItem('Sushi', MENU, STOCK)).toBeNull()
  })

  it('nombre vacío → null', () => {
    expect(resolveWasteItem('', MENU, STOCK)).toBeNull()
    expect(resolveWasteItem('   ', MENU, STOCK)).toBeNull()
  })

  it('NO se rompe con nombres duplicados en la carta (toma el primero)', () => {
    const dupMenu: MenuCandidate[] = [
      { id: 'd1', name: 'Empanada', cost_price: 2000 },
      { id: 'd2', name: 'Empanada', cost_price: 2500 },
    ]
    const r = resolveWasteItem('Empanada', dupMenu, [])
    // El bug original: .maybeSingle() tiraba error con 2 filas → 404. Acá toma una.
    expect(r?.item_type).toBe('plato')
    expect(['d1', 'd2']).toContain(r?.menu_item_id)
  })
})
