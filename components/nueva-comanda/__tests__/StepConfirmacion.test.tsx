/**
 * Tests for StepConfirmacion.
 * Property-based tests (task 9.2*) and example tests (task 9.3*) are optional per spec.
 * This file covers the core utility used by StepConfirmacion: calculateTotal.
 */

import { describe, it, expect } from 'vitest'
import { calculateTotal } from '../utils'
import type { OrderLine } from '../types'

function makeLine(unitPrice: number, qty: number, i = 0): OrderLine {
  return { menuItemId: `item-${i}`, name: `Item ${i}`, unitPrice, qty, note: '', destination: 'cocina' }
}

describe('StepConfirmacion — calculateTotal (used for order total display)', () => {
  it('returns 0 for empty lines', () => {
    expect(calculateTotal([])).toBe(0)
  })

  it('sums unitPrice × qty for each line', () => {
    const lines = [makeLine(5000, 2, 0), makeLine(1500, 3, 1)]
    // 5000×2 + 1500×3 = 10000 + 4500 = 14500
    expect(calculateTotal(lines)).toBe(14500)
  })

  it('handles a single line with qty 1', () => {
    expect(calculateTotal([makeLine(3990, 1)])).toBe(3990)
  })
})
