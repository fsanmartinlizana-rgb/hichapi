import { describe, it, expect } from 'vitest'
import { filterByName, groupByCategory, calculateTotal } from '../utils'
import type { MenuItemOption, OrderLine } from '../types'

// ── Smoke test ────────────────────────────────────────────────────────────────

describe('StepCatalogoVisual — module smoke test', () => {
  it('imports utils without errors', () => {
    expect(typeof filterByName).toBe('function')
    expect(typeof groupByCategory).toBe('function')
    expect(typeof calculateTotal).toBe('function')
  })
})

// ── filterByName ──────────────────────────────────────────────────────────────

const sampleItems: MenuItemOption[] = [
  { id: '1', name: 'Hamburguesa Clásica', price: 5000, category: 'Comidas' },
  { id: '2', name: 'Coca-Cola', price: 1500, category: 'Bebidas' },
  { id: '3', name: 'Papas Fritas', price: 2500, category: 'Comidas' },
  { id: '4', name: 'Agua Mineral', price: 1000, category: 'Bebidas' },
]

describe('filterByName', () => {
  it('returns all items when query is empty', () => {
    expect(filterByName(sampleItems, '')).toHaveLength(4)
  })

  it('filters case-insensitively (lowercase query)', () => {
    const result = filterByName(sampleItems, 'hamburguesa')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('filters case-insensitively (uppercase query)', () => {
    const result = filterByName(sampleItems, 'COCA')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('filters case-insensitively (mixed case query)', () => {
    const result = filterByName(sampleItems, 'PaPaS')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })

  it('returns multiple matches when query matches several items', () => {
    // Both 'Coca-Cola' and 'Agua Mineral' contain 'a' — but let's use a more specific substring
    const result = filterByName(sampleItems, 'a') // matches Hamburguesa, Papas, Agua
    expect(result.length).toBeGreaterThan(1)
  })

  it('returns empty array when no items match', () => {
    expect(filterByName(sampleItems, 'pizza')).toHaveLength(0)
  })

  it('returns empty array when items list is empty', () => {
    expect(filterByName([], 'algo')).toHaveLength(0)
  })
})

// ── groupByCategory ───────────────────────────────────────────────────────────

describe('groupByCategory', () => {
  it('groups items by their category', () => {
    const grouped = groupByCategory(sampleItems)
    expect(Object.keys(grouped)).toEqual(expect.arrayContaining(['Comidas', 'Bebidas']))
    expect(grouped['Comidas']).toHaveLength(2)
    expect(grouped['Bebidas']).toHaveLength(2)
  })

  it('each item appears in the correct category', () => {
    const grouped = groupByCategory(sampleItems)
    expect(grouped['Comidas'].map(i => i.id)).toEqual(expect.arrayContaining(['1', '3']))
    expect(grouped['Bebidas'].map(i => i.id)).toEqual(expect.arrayContaining(['2', '4']))
  })

  it('returns empty object for empty input', () => {
    expect(groupByCategory([])).toEqual({})
  })

  it('handles items all in the same category', () => {
    const items: MenuItemOption[] = [
      { id: 'a', name: 'Item A', price: 100, category: 'Única' },
      { id: 'b', name: 'Item B', price: 200, category: 'Única' },
    ]
    const grouped = groupByCategory(items)
    expect(Object.keys(grouped)).toHaveLength(1)
    expect(grouped['Única']).toHaveLength(2)
  })
})

// ── calculateTotal ────────────────────────────────────────────────────────────

const makeLines = (entries: Array<[number, number]>): OrderLine[] =>
  entries.map(([unitPrice, qty], i) => ({
    menuItemId: `item-${i}`,
    name: `Item ${i}`,
    unitPrice,
    qty,
    note: '',
    destination: 'cocina',
  }))

describe('calculateTotal', () => {
  it('returns 0 for empty lines', () => {
    expect(calculateTotal([])).toBe(0)
  })

  it('calculates total for a single line', () => {
    expect(calculateTotal(makeLines([[5000, 2]]))).toBe(10000)
  })

  it('calculates total for multiple lines', () => {
    // 5000×2 + 1500×3 = 10000 + 4500 = 14500
    expect(calculateTotal(makeLines([[5000, 2], [1500, 3]]))).toBe(14500)
  })

  it('handles qty of 1 correctly', () => {
    expect(calculateTotal(makeLines([[2500, 1]]))).toBe(2500)
  })

  it('handles fractional prices correctly', () => {
    // 10.5 × 2 = 21
    expect(calculateTotal(makeLines([[10.5, 2]]))).toBeCloseTo(21)
  })
})
