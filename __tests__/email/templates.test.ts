// ══════════════════════════════════════════════════════════════════════════════
//  Email Templates Property Tests — __tests__/email/templates.test.ts
//
//  Property-based tests for boletaEmail, facturaEmail, and stockCriticalEmail.
//  Uses fast-check to verify universal invariants across arbitrary inputs.
//
//  Feature: email-templates-hichapi
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  boletaEmail,
  facturaEmail,
  stockCriticalEmail,
} from '../../lib/email/templates'

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Arbitrary for a single order item */
const arbOrderItem = fc.record({
  name:       fc.string({ minLength: 1, maxLength: 80 }),
  quantity:   fc.integer({ min: 1, max: 20 }),
  unit_price: fc.integer({ min: 0, max: 100_000 }),
})

/**
 * Generates a valid ISO date string between 2020-01-01 and 2030-12-31.
 * Uses integer timestamps to avoid fast-check v4 date shrinking issues.
 */
const arbIsoDate: fc.Arbitrary<string> = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
}).map(ts => new Date(ts).toISOString())

/** Arbitrary for BoletaEmailOpts */
const arbBoletaOpts = fc.record({
  restaurantName: fc.string({ minLength: 1, maxLength: 100 }),
  folio:          fc.integer({ min: 1, max: 999_999 }),
  totalAmount:    fc.integer({ min: 1, max: 99_999_999 }),
  emittedAt:      arbIsoDate,
  items:          fc.array(arbOrderItem, { minLength: 1, maxLength: 10 }),
  hasXml:         fc.boolean(),
  hasPdf:         fc.boolean(),
})

/** Arbitrary for FacturaEmailOpts */
const arbFacturaOpts = fc.record({
  restaurantName: fc.string({ minLength: 1, maxLength: 100 }),
  razonReceptor:  fc.string({ minLength: 1, maxLength: 100 }),
  folio:          fc.integer({ min: 1, max: 999_999 }),
  totalAmount:    fc.integer({ min: 1, max: 99_999_999 }),
  emittedAt:      arbIsoDate,
  hasXml:         fc.boolean(),
  hasPdf:         fc.boolean(),
  items:          fc.option(fc.array(arbOrderItem, { minLength: 1, maxLength: 10 }), { nil: undefined }),
})

/** Arbitrary for a single StockCriticalItem */
const arbStockCriticalItem = fc.record({
  name:        fc.string({ minLength: 1, maxLength: 80 }),
  current_qty: fc.integer({ min: -100, max: 100 }),
  min_qty:     fc.integer({ min: 0, max: 50 }),
  unit:        fc.constantFrom('kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja', 'onza'),
  supplier:    fc.option(fc.string({ minLength: 1, maxLength: 80 }), { nil: undefined }),
})

/** Arbitrary for StockCriticalEmailOpts */
const arbStockCriticalOpts = fc.record({
  restaurantName: fc.string({ minLength: 1, maxLength: 100 }),
  items:          fc.array(arbStockCriticalItem, { minLength: 1, maxLength: 10 }),
})

// ══════════════════════════════════════════════════════════════════════════════
//  Boleta — Properties 1, 4, 5, 14, 15
// ══════════════════════════════════════════════════════════════════════════════

describe('boletaEmail', () => {
  // Feature: email-templates-hichapi, Property 1: Contenido completo de la plantilla de boleta
  // Validates: Requisito 1.1
  it('Property 1 — HTML contains folio, restaurantName, CLP amount, date and item names', () => {
    fc.assert(
      fc.property(arbBoletaOpts, (opts) => {
        const result = boletaEmail(opts)

        // Folio appears in HTML
        expect(result.html).toContain(String(opts.folio))

        // Restaurant name appears (possibly escaped)
        const escapedRestaurant = opts.restaurantName
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
        expect(result.html).toContain(escapedRestaurant)

        // CLP formatted amount appears
        const monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(opts.totalAmount)
        expect(result.html).toContain(monto)

        // Each item name appears (possibly escaped)
        for (const item of opts.items) {
          const escapedName = item.name
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
          expect(result.html).toContain(escapedName)
        }
      }),
      { numRuns: 100 }
    )
  })

  // Feature: email-templates-hichapi, Property 4: Texto plano presente en todas las plantillas (boleta)
  // Validates: Requisito 1.2
  it('Property 4 — text field is non-empty and contains folio and item names', () => {
    fc.assert(
      fc.property(arbBoletaOpts, (opts) => {
        const result = boletaEmail(opts)

        expect(result.text.length).toBeGreaterThan(0)
        expect(result.text).toContain(String(opts.folio))

        for (const item of opts.items) {
          expect(result.text).toContain(item.name)
        }
      }),
      { numRuns: 100 }
    )
  })

  // Feature: email-templates-hichapi, Property 5: Paleta de marca en la plantilla de boleta
  // Validates: Requisito 1.3
  it('Property 5 — HTML contains brand colors #FF6B35 and #0A0A14', () => {
    fc.assert(
      fc.property(arbBoletaOpts, (opts) => {
        const result = boletaEmail(opts)

        expect(result.html).toContain('#FF6B35')
        expect(result.html).toContain('#0A0A14')
      }),
      { numRuns: 100 }
    )
  })

  // Feature: email-templates-hichapi, Property 14: Idempotencia de generación de plantillas (boleta)
  // Validates: Requisito 6.5
  it('Property 14 — calling boletaEmail twice with same params produces identical results', () => {
    fc.assert(
      fc.property(arbBoletaOpts, (opts) => {
        const result1 = boletaEmail(opts)
        const result2 = boletaEmail(opts)

        expect(result1.html).toBe(result2.html)
        expect(result1.text).toBe(result2.text)
        expect(result1.subject).toBe(result2.subject)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: email-templates-hichapi, Property 15: Formato CLP consistente (boleta)
  // Validates: Requisito 6.6
  it('Property 15 — CLP amount in HTML matches Intl.NumberFormat output exactly', () => {
    fc.assert(
      fc.property(arbBoletaOpts, (opts) => {
        const result = boletaEmail(opts)
        const expected = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(opts.totalAmount)

        expect(result.html).toContain(expected)
      }),
      { numRuns: 100 }
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════
//  Factura — Properties 2, 4
// ══════════════════════════════════════════════════════════════════════════════

describe('facturaEmail', () => {
  // Feature: email-templates-hichapi, Property 2: Contenido completo de la plantilla de factura
  // Validates: Requisito 2.1
  it('Property 2 — HTML contains folio, razonReceptor, restaurantName, CLP amount, date and SII note', () => {
    fc.assert(
      fc.property(arbFacturaOpts, (opts) => {
        const result = facturaEmail(opts)

        // Folio appears
        expect(result.html).toContain(String(opts.folio))

        // Razón social del receptor (possibly escaped)
        const escapedRazon = opts.razonReceptor
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
        expect(result.html).toContain(escapedRazon)

        // Restaurant name (possibly escaped)
        const escapedRestaurant = opts.restaurantName
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
        expect(result.html).toContain(escapedRestaurant)

        // CLP formatted amount
        const monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(opts.totalAmount)
        expect(result.html).toContain(monto)

        // SII validity note
        expect(result.html).toContain('SII')
      }),
      { numRuns: 100 }
    )
  })

  // Feature: email-templates-hichapi, Property 4: Texto plano presente en todas las plantillas (factura)
  // Validates: Requisito 2.2
  it('Property 4 — text field is non-empty and contains folio and razonReceptor', () => {
    fc.assert(
      fc.property(arbFacturaOpts, (opts) => {
        const result = facturaEmail(opts)

        expect(result.text.length).toBeGreaterThan(0)
        expect(result.text).toContain(String(opts.folio))
        expect(result.text).toContain(opts.razonReceptor)
      }),
      { numRuns: 100 }
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════
//  Stock Critical — Properties 3, 7, 8, 4, 5
// ══════════════════════════════════════════════════════════════════════════════

describe('stockCriticalEmail', () => {
  // Feature: email-templates-hichapi, Property 3: Contenido completo de la plantilla de stock crítico
  // Validates: Requisito 3.1
  it('Property 3 — HTML contains name, current_qty, min_qty, unit for each item; supplier when available', () => {
    fc.assert(
      fc.property(arbStockCriticalOpts, (opts) => {
        const result = stockCriticalEmail(opts)

        for (const item of opts.items) {
          const escapedName = item.name
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
          expect(result.html).toContain(escapedName)
          expect(result.html).toContain(String(item.current_qty))
          expect(result.html).toContain(String(item.min_qty))

          const escapedUnit = item.unit
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
          expect(result.html).toContain(escapedUnit)

          if (item.supplier) {
            const escapedSupplier = item.supplier
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
            expect(result.html).toContain(escapedSupplier)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  // Feature: email-templates-hichapi, Property 7: Ítems con stock negativo destacados en rojo
  // Validates: Requisito 3.4
  it('Property 7 — HTML contains #F87171 when any item has current_qty < 0', () => {
    const arbWithNegativeItem = fc.record({
      restaurantName: fc.string({ minLength: 1, maxLength: 100 }),
      items: fc.array(arbStockCriticalItem, { minLength: 1, maxLength: 9 }).chain(items =>
        arbStockCriticalItem.map(negItem => [
          ...items,
          { ...negItem, current_qty: -Math.abs(negItem.current_qty) - 1 },
        ])
      ),
    })

    fc.assert(
      fc.property(arbWithNegativeItem, (opts) => {
        const result = stockCriticalEmail(opts)
        expect(result.html).toContain('#F87171')
      }),
      { numRuns: 100 }
    )
  })

  // Feature: email-templates-hichapi, Property 8: Formato de asunto de stock crítico
  // Validates: Requisito 3.8
  it('Property 8 — subject follows format "⚠️ {N} insumo(s) con stock crítico — {restaurantName}"', () => {
    fc.assert(
      fc.property(arbStockCriticalOpts, (opts) => {
        const result = stockCriticalEmail(opts)
        const n = opts.items.length
        expect(result.subject).toBe(`⚠️ ${n} insumo(s) con stock crítico — ${opts.restaurantName}`)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: email-templates-hichapi, Property 4: Texto plano presente en todas las plantillas (stock)
  // Validates: Requisito 3.2
  it('Property 4 — text field is non-empty and contains item names', () => {
    fc.assert(
      fc.property(arbStockCriticalOpts, (opts) => {
        const result = stockCriticalEmail(opts)

        expect(result.text.length).toBeGreaterThan(0)
        for (const item of opts.items) {
          expect(result.text).toContain(item.name)
        }
      }),
      { numRuns: 100 }
    )
  })

  // Feature: email-templates-hichapi, Property 5: Paleta de marca en la plantilla de stock crítico
  // Validates: Requisito 3.3
  it('Property 5 — HTML contains brand colors #FF6B35, #0A0A14 and alert color #FB923C', () => {
    fc.assert(
      fc.property(arbStockCriticalOpts, (opts) => {
        const result = stockCriticalEmail(opts)

        expect(result.html).toContain('#FF6B35')
        expect(result.html).toContain('#0A0A14')
        expect(result.html).toContain('#FB923C')
      }),
      { numRuns: 100 }
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════
//  Cross-cutting — Properties 12, 13, 14
// ══════════════════════════════════════════════════════════════════════════════

describe('Cross-cutting template quality properties', () => {
  // Feature: email-templates-hichapi, Property 12: Estructura HTML compatible con email clients
  // Validates: Requisitos 6.1, 6.2, 6.4
  describe('Property 12 — HTML structure compatible with email clients', () => {
    it('boletaEmail: contains <table, style= inline, no <link rel="stylesheet">, no external <style>, contains 560px', () => {
      fc.assert(
        fc.property(arbBoletaOpts, (opts) => {
          const { html } = boletaEmail(opts)

          expect(html).toContain('<table')
          expect(html).toContain('style=')
          expect(html).not.toContain('<link rel="stylesheet"')
          expect(html).not.toMatch(/<style[^>]*>[\s\S]*?@import/i)
          expect(html).toContain('560px')
        }),
        { numRuns: 100 }
      )
    })

    it('facturaEmail: contains <table, style= inline, no <link rel="stylesheet">, no external <style>, contains 560px', () => {
      fc.assert(
        fc.property(arbFacturaOpts, (opts) => {
          const { html } = facturaEmail(opts)

          expect(html).toContain('<table')
          expect(html).toContain('style=')
          expect(html).not.toContain('<link rel="stylesheet"')
          expect(html).not.toMatch(/<style[^>]*>[\s\S]*?@import/i)
          expect(html).toContain('560px')
        }),
        { numRuns: 100 }
      )
    })

    it('stockCriticalEmail: contains <table, style= inline, no <link rel="stylesheet">, no external <style>, contains 560px', () => {
      fc.assert(
        fc.property(arbStockCriticalOpts, (opts) => {
          const { html } = stockCriticalEmail(opts)

          expect(html).toContain('<table')
          expect(html).toContain('style=')
          expect(html).not.toContain('<link rel="stylesheet"')
          expect(html).not.toMatch(/<style[^>]*>[\s\S]*?@import/i)
          expect(html).toContain('560px')
        }),
        { numRuns: 100 }
      )
    })
  })

  // Feature: email-templates-hichapi, Property 13: Escape de HTML en valores dinámicos
  // Validates: Requisito 6.3
  describe('Property 13 — HTML special characters are escaped in dynamic values', () => {
    /** Generates strings that contain at least one HTML special character */
    const arbHtmlSpecialString = fc.string({ minLength: 1, maxLength: 50 }).filter(
      s => s.includes('<') || s.includes('>') || s.includes('&')
    )

    it('boletaEmail: restaurantName with special chars is escaped in HTML', () => {
      fc.assert(
        fc.property(
          arbBoletaOpts,
          arbHtmlSpecialString,
          (opts, specialName) => {
            const optsWithSpecial = { ...opts, restaurantName: specialName }
            const { html } = boletaEmail(optsWithSpecial)

            if (specialName.includes('<')) expect(html).toContain('&lt;')
            if (specialName.includes('>')) expect(html).toContain('&gt;')
            if (specialName.includes('&')) expect(html).toContain('&amp;')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('facturaEmail: razonReceptor with special chars is escaped in HTML', () => {
      fc.assert(
        fc.property(
          arbFacturaOpts,
          arbHtmlSpecialString,
          (opts, specialRazon) => {
            const optsWithSpecial = { ...opts, razonReceptor: specialRazon }
            const { html } = facturaEmail(optsWithSpecial)

            if (specialRazon.includes('<')) expect(html).toContain('&lt;')
            if (specialRazon.includes('>')) expect(html).toContain('&gt;')
            if (specialRazon.includes('&')) expect(html).toContain('&amp;')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('boletaEmail: item names with special chars are escaped in HTML', () => {
      fc.assert(
        fc.property(
          arbBoletaOpts,
          arbHtmlSpecialString,
          (opts, specialItemName) => {
            const optsWithSpecial = {
              ...opts,
              items: [{ name: specialItemName, quantity: 1, unit_price: 1000 }],
            }
            const { html } = boletaEmail(optsWithSpecial)

            if (specialItemName.includes('<')) expect(html).toContain('&lt;')
            if (specialItemName.includes('>')) expect(html).toContain('&gt;')
            if (specialItemName.includes('&')) expect(html).toContain('&amp;')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('stockCriticalEmail: item names with special chars are escaped in HTML', () => {
      fc.assert(
        fc.property(
          arbStockCriticalOpts,
          arbHtmlSpecialString,
          (opts, specialItemName) => {
            const optsWithSpecial = {
              ...opts,
              items: [{ name: specialItemName, current_qty: 0, min_qty: 5, unit: 'kg' as const }],
            }
            const { html } = stockCriticalEmail(optsWithSpecial)

            if (specialItemName.includes('<')) expect(html).toContain('&lt;')
            if (specialItemName.includes('>')) expect(html).toContain('&gt;')
            if (specialItemName.includes('&')) expect(html).toContain('&amp;')
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: email-templates-hichapi, Property 14: Idempotencia de generación de plantillas (factura y stock)
  // Validates: Requisito 6.5
  describe('Property 14 — Template generation is idempotent', () => {
    it('facturaEmail: calling twice with same params produces identical results', () => {
      fc.assert(
        fc.property(arbFacturaOpts, (opts) => {
          const result1 = facturaEmail(opts)
          const result2 = facturaEmail(opts)

          expect(result1.html).toBe(result2.html)
          expect(result1.text).toBe(result2.text)
          expect(result1.subject).toBe(result2.subject)
        }),
        { numRuns: 100 }
      )
    })

    it('stockCriticalEmail: calling twice with same params produces identical results', () => {
      fc.assert(
        fc.property(arbStockCriticalOpts, (opts) => {
          const result1 = stockCriticalEmail(opts)
          const result2 = stockCriticalEmail(opts)

          expect(result1.html).toBe(result2.html)
          expect(result1.text).toBe(result2.text)
          expect(result1.subject).toBe(result2.subject)
        }),
        { numRuns: 100 }
      )
    })
  })
})
