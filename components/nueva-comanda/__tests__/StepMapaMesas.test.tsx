/**
 * Smoke tests for StepMapaMesas
 * Tasks 5.2 and 5.3 (property-based tests) were skipped as optional.
 * This file verifies the module and its dependencies can be imported without errors.
 */

import { describe, it, expect } from 'vitest'

describe('StepMapaMesas — smoke', () => {
  it('imports StepMapaMesas without throwing', async () => {
    // Dynamic import to catch any module-level errors
    const mod = await import('../StepMapaMesas')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('imports types without throwing', async () => {
    // Verify the types module loads cleanly
    const types = await import('../types')
    // types.ts only exports interfaces/types — no runtime values to check,
    // but the import itself must succeed
    expect(types).toBeDefined()
  })

  it('imports utils without throwing', async () => {
    const utils = await import('../utils')
    expect(typeof utils.groupByZone).toBe('function')
    expect(typeof utils.calculateTotal).toBe('function')
    expect(typeof utils.filterByName).toBe('function')
    expect(typeof utils.groupByCategory).toBe('function')
    expect(typeof utils.getDefaultDestination).toBe('function')
  })
})

describe('StepMapaMesas — groupByZone unit', () => {
  it('groups tables by zone correctly', async () => {
    const { groupByZone } = await import('../utils')
    const tables = [
      { id: '1', label: 'T1', status: 'libre' as const, zone: 'Terraza' },
      { id: '2', label: 'T2', status: 'libre' as const, zone: 'Terraza' },
      { id: '3', label: 'T3', status: 'ocupada' as const, zone: 'Interior' },
      { id: '4', label: 'T4', status: 'libre' as const },
    ]
    const grouped = groupByZone(tables)
    expect(grouped['Terraza']).toHaveLength(2)
    expect(grouped['Interior']).toHaveLength(1)
    expect(grouped['']).toHaveLength(1)
  })

  it('returns single empty-key group when no tables have zones', async () => {
    const { groupByZone } = await import('../utils')
    const tables = [
      { id: '1', label: 'T1', status: 'libre' as const },
      { id: '2', label: 'T2', status: 'libre' as const },
    ]
    const grouped = groupByZone(tables)
    const keys = Object.keys(grouped)
    expect(keys).toHaveLength(1)
    expect(keys[0]).toBe('')
    expect(grouped['']).toHaveLength(2)
  })

  it('returns empty object for empty tables array', async () => {
    const { groupByZone } = await import('../utils')
    expect(groupByZone([])).toEqual({})
  })
})
