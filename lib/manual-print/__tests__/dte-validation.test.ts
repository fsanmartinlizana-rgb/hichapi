/**
 * Tests for DTE Validation Service
 *
 * Covers: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect } from 'vitest'
import {
  validateRut,
  formatRut,
  validateBoletaData,
  validateFacturaData,
  validateDteData,
  getFieldErrors,
  type BoletaData,
  type FacturaData,
} from '../dte-validation'

// ── Helpers ───────────────────────────────────────────────────────────────────

const validItem = { name: 'Empanada', quantity: 2, unit_price: 1500 }

const minimalBoleta: BoletaData = {
  total: 3000,
  items: [validItem],
}

const minimalFactura: FacturaData = {
  total: 3000,
  items: [validItem],
  rut_receptor: '76.354.771-K',
  razon_receptor: 'Empresa Ejemplo SpA',
  giro_receptor: 'Servicios de alimentación',
  direccion_receptor: 'Av. Providencia 1234',
  comuna_receptor: 'Providencia',
}

// ── validateRut ───────────────────────────────────────────────────────────────

describe('validateRut', () => {
  // Req 7.4 — valid RUTs in various formats
  it('accepts a valid RUT with dots and dash (76.354.771-K)', () => {
    expect(validateRut('76.354.771-K').isValid).toBe(true)
  })

  it('accepts a valid RUT with dash only (76354771-K)', () => {
    expect(validateRut('76354771-K').isValid).toBe(true)
  })

  it('accepts a valid RUT without separators (76354771K)', () => {
    expect(validateRut('76354771K').isValid).toBe(true)
  })

  it('accepts a valid RUT with lowercase k (76354771k)', () => {
    expect(validateRut('76354771k').isValid).toBe(true)
  })

  it('accepts a valid 8-digit RUT (12.345.678-5)', () => {
    // body=12345678, check digit=5 (verified by algorithm)
    expect(validateRut('12.345.678-5').isValid).toBe(true)
  })

  it('accepts another valid RUT (11.111.111-1)', () => {
    // body=11111111, check digit computation:
    // digits reversed: 1,1,1,1,1,1,1,1
    // multipliers: 2,3,4,5,6,7,2,3
    // products: 2+3+4+5+6+7+2+3 = 32
    // 11 - (32 % 11) = 11 - 10 = 1 → '1'
    expect(validateRut('11.111.111-1').isValid).toBe(true)
  })

  // Invalid cases
  it('rejects empty string', () => {
    const result = validateRut('')
    expect(result.isValid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects whitespace-only string', () => {
    expect(validateRut('   ').isValid).toBe(false)
  })

  it('rejects RUT with wrong check digit', () => {
    const result = validateRut('76.354.771-0')
    expect(result.isValid).toBe(false)
    expect(result.error).toMatch(/inválido/i)
  })

  it('rejects RUT that is too short', () => {
    expect(validateRut('123-4').isValid).toBe(false)
  })

  it('rejects RUT with non-numeric body', () => {
    expect(validateRut('ABCDEFG-K').isValid).toBe(false)
  })

  it('returns a descriptive error message for invalid format', () => {
    const result = validateRut('bad-rut')
    expect(result.isValid).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

// ── formatRut ─────────────────────────────────────────────────────────────────

describe('formatRut', () => {
  // Req 7.5 — auto-format RUT
  it('formats 8-digit RUT without separators (76354771K → 76.354.771-K)', () => {
    expect(formatRut('76354771K')).toBe('76.354.771-K')
  })

  it('formats RUT with dash only (76354771-K → 76.354.771-K)', () => {
    expect(formatRut('76354771-K')).toBe('76.354.771-K')
  })

  it('formats 7-digit RUT (12345678-5 → 12.345.678-5)', () => {
    expect(formatRut('12345678-5')).toBe('12.345.678-5')
  })

  it('formats 7-digit RUT without separators (9876543-3 → 9.876.543-3)', () => {
    expect(formatRut('9876543-3')).toBe('9.876.543-3')
  })

  it('is idempotent — already formatted RUT stays the same', () => {
    expect(formatRut('76.354.771-K')).toBe('76.354.771-K')
  })

  it('uppercases the check digit k → K', () => {
    expect(formatRut('76354771k')).toBe('76.354.771-K')
  })

  it('returns empty string unchanged', () => {
    expect(formatRut('')).toBe('')
  })

  it('returns unparseable input unchanged', () => {
    const bad = 'not-a-rut'
    expect(formatRut(bad)).toBe(bad)
  })
})

// ── validateBoletaData ────────────────────────────────────────────────────────

describe('validateBoletaData', () => {
  // Req 7.1 — boleta validation
  it('passes for valid boleta data', () => {
    const result = validateBoletaData(minimalBoleta)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails when total is 0', () => {
    const result = validateBoletaData({ ...minimalBoleta, total: 0 })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field === 'total')).toBe(true)
  })

  it('fails when total is negative', () => {
    const result = validateBoletaData({ ...minimalBoleta, total: -100 })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field === 'total')).toBe(true)
  })

  it('fails when items array is empty', () => {
    const result = validateBoletaData({ ...minimalBoleta, items: [] })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field === 'items')).toBe(true)
  })

  it('fails when an item has no name', () => {
    const result = validateBoletaData({
      ...minimalBoleta,
      items: [{ name: '', quantity: 1, unit_price: 1000 }],
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field.includes('name'))).toBe(true)
  })

  it('fails when an item has zero quantity', () => {
    const result = validateBoletaData({
      ...minimalBoleta,
      items: [{ name: 'Item', quantity: 0, unit_price: 1000 }],
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field.includes('quantity'))).toBe(true)
  })

  it('fails when an item has negative price', () => {
    const result = validateBoletaData({
      ...minimalBoleta,
      items: [{ name: 'Item', quantity: 1, unit_price: -1 }],
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field.includes('unit_price'))).toBe(true)
  })

  it('allows items with price 0 (free items)', () => {
    const result = validateBoletaData({
      ...minimalBoleta,
      items: [{ name: 'Agua', quantity: 1, unit_price: 0 }],
    })
    expect(result.isValid).toBe(true)
  })

  // Req 7.3 — specific error messages
  it('provides specific error messages for each invalid field', () => {
    const result = validateBoletaData({ total: 0, items: [] })
    const fields = result.errors.map(e => e.field)
    expect(fields).toContain('total')
    expect(fields).toContain('items')
    result.errors.forEach(e => {
      expect(e.message).toBeTruthy()
      expect(e.message.length).toBeGreaterThan(0)
    })
  })
})

// ── validateFacturaData ───────────────────────────────────────────────────────

describe('validateFacturaData', () => {
  // Req 7.2 — factura validation extends boleta
  it('passes for valid factura data', () => {
    const result = validateFacturaData(minimalFactura)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails when rut_receptor is missing', () => {
    const result = validateFacturaData({ ...minimalFactura, rut_receptor: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field === 'rut_receptor')).toBe(true)
  })

  it('fails when rut_receptor has invalid check digit', () => {
    const result = validateFacturaData({ ...minimalFactura, rut_receptor: '76.354.771-0' })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field === 'rut_receptor')).toBe(true)
  })

  it('fails when razon_receptor is missing', () => {
    const result = validateFacturaData({ ...minimalFactura, razon_receptor: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field === 'razon_receptor')).toBe(true)
  })

  it('fails when giro_receptor is missing', () => {
    const result = validateFacturaData({ ...minimalFactura, giro_receptor: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field === 'giro_receptor')).toBe(true)
  })

  it('fails when direccion_receptor is missing', () => {
    const result = validateFacturaData({ ...minimalFactura, direccion_receptor: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field === 'direccion_receptor')).toBe(true)
  })

  it('fails when comuna_receptor is missing', () => {
    const result = validateFacturaData({ ...minimalFactura, comuna_receptor: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field === 'comuna_receptor')).toBe(true)
  })

  it('also validates boleta fields (total)', () => {
    const result = validateFacturaData({ ...minimalFactura, total: 0 })
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.field === 'total')).toBe(true)
  })

  it('reports all missing fields at once', () => {
    const result = validateFacturaData({
      total: 0,
      items: [],
      rut_receptor: '',
      razon_receptor: '',
      giro_receptor: '',
      direccion_receptor: '',
      comuna_receptor: '',
    })
    expect(result.isValid).toBe(false)
    const fields = result.errors.map(e => e.field)
    expect(fields).toContain('total')
    expect(fields).toContain('items')
    expect(fields).toContain('rut_receptor')
    expect(fields).toContain('razon_receptor')
    expect(fields).toContain('giro_receptor')
    expect(fields).toContain('direccion_receptor')
    expect(fields).toContain('comuna_receptor')
  })

  it('accepts optional email_receptor when provided', () => {
    const result = validateFacturaData({
      ...minimalFactura,
      email_receptor: 'contabilidad@empresa.cl',
    })
    expect(result.isValid).toBe(true)
  })

  it('accepts factura without email_receptor', () => {
    const { email_receptor: _, ...withoutEmail } = { ...minimalFactura, email_receptor: undefined }
    const result = validateFacturaData(withoutEmail as FacturaData)
    expect(result.isValid).toBe(true)
  })
})

// ── validateDteData ───────────────────────────────────────────────────────────

describe('validateDteData', () => {
  it('routes document type 39 to boleta validation', () => {
    const result = validateDteData(39, minimalBoleta)
    expect(result.isValid).toBe(true)
  })

  it('routes document type 33 to factura validation', () => {
    const result = validateDteData(33, minimalFactura)
    expect(result.isValid).toBe(true)
  })

  it('returns factura errors for type 33 with missing receptor fields', () => {
    const result = validateDteData(33, {
      ...minimalBoleta,
      rut_receptor: '',
      razon_receptor: '',
      giro_receptor: '',
      direccion_receptor: '',
      comuna_receptor: '',
    } as FacturaData)
    expect(result.isValid).toBe(false)
    const fields = result.errors.map(e => e.field)
    expect(fields).toContain('rut_receptor')
  })

  it('does not require receptor fields for type 39', () => {
    // Boleta only needs total and items
    const result = validateDteData(39, minimalBoleta)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

// ── getFieldErrors ────────────────────────────────────────────────────────────

describe('getFieldErrors', () => {
  it('returns empty object when validation passes', () => {
    const result = validateBoletaData(minimalBoleta)
    expect(getFieldErrors(result)).toEqual({})
  })

  it('returns a map of field → message for each error', () => {
    const result = validateBoletaData({ total: 0, items: [] })
    const fieldErrors = getFieldErrors(result)
    expect(fieldErrors['total']).toBeTruthy()
    expect(fieldErrors['items']).toBeTruthy()
  })

  it('allows UI to look up error by field name', () => {
    const result = validateFacturaData({ ...minimalFactura, rut_receptor: '' })
    const fieldErrors = getFieldErrors(result)
    expect(fieldErrors['rut_receptor']).toMatch(/requerido/i)
  })
})
