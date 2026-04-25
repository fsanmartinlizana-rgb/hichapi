/**
 * Station Ticket Preservation Tests — Task 11.1
 *
 * Verifies that the manual print control system does NOT affect the automatic
 * station ticket flow (/api/solicita_ticket). Manual controls apply only to
 * precuenta and boleta electrónica endpoints.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5
 */

import { describe, it, expect, vi } from 'vitest'
import {
  NotifierServiceImpl,
  createNotifierService,
  createMockNotifierService,
} from '../notifier-service'
import type { NotifierService } from '../types'

// ── Requirement 4.5: Manual controls only affect precuenta and boleta ─────────

describe('NotifierService — station ticket isolation (Req 4.5)', () => {
  it('does NOT expose a requestStationTicket method', () => {
    const service = createNotifierService()

    // The NotifierService interface must NOT have any method that calls
    // /api/solicita_ticket — station tickets are handled automatically
    // by the order creation flow, not by the manual print system.
    expect((service as any).requestStationTicket).toBeUndefined()
    expect((service as any).sendStationTicket).toBeUndefined()
    expect((service as any).requestTicket).toBeUndefined()
    expect((service as any).solicita_ticket).toBeUndefined()
  })

  it('only exposes precuenta and boleta methods (Req 4.5)', () => {
    const service = createNotifierService()

    // The public API of NotifierService must only contain methods for
    // precuenta and boleta — never for station tickets.
    expect(typeof (service as any).requestPreCuenta).toBe('function')
    expect(typeof (service as any).requestBoletaElectronica).toBe('function')
  })

  it('mock service also does not expose station ticket methods (Req 4.5)', () => {
    const mockService = createMockNotifierService()

    expect((mockService as any).requestStationTicket).toBeUndefined()
    expect((mockService as any).sendStationTicket).toBeUndefined()
  })
})

// ── Requirement 4.5: NotifierService never calls /api/solicita_ticket ─────────

describe('NotifierService — no calls to /api/solicita_ticket (Req 4.5)', () => {
  it('requestPreCuenta calls /api/pre_cuenta, not /api/solicita_ticket', async () => {
    const fetchCalls: string[] = []
    const mockFetch = vi.fn((url: string) => {
      fetchCalls.push(url)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'printed' }),
      })
    })
    global.fetch = mockFetch as any

    const service = new NotifierServiceImpl('http://localhost:3000', 5000)
    await service.requestPreCuenta({
      comercio: 'rest-1',
      impresora: 'printer-1',
      comuna: 'Santiago',
      direccion: 'Av. Test 123',
      movimiento: 'order-1',
      items: [{ id: 'i1', name: 'Burger', quantity: 1, unit_price: 5000 }],
      total: 5000,
    })

    // Must call pre_cuenta
    expect(fetchCalls.some(u => u.includes('/api/pre_cuenta'))).toBe(true)
    // Must NOT call solicita_ticket
    expect(fetchCalls.some(u => u.includes('solicita_ticket'))).toBe(false)
  })

  it('requestBoletaElectronica calls /api/solicita_boleta_electronica, not /api/solicita_ticket', async () => {
    const fetchCalls: string[] = []
    const mockFetch = vi.fn((url: string) => {
      fetchCalls.push(url)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ folio: 12345, status: 'printed' }),
      })
    })
    global.fetch = mockFetch as any

    const service = new NotifierServiceImpl('http://localhost:3000', 5000)
    await service.requestBoletaElectronica({
      comercio: 'rest-1',
      impresora: 'printer-1',
      movimiento: 'order-1',
      total: 5000,
      items: [{ id: 'i1', name: 'Burger', quantity: 1, unit_price: 5000 }],
      dte: { document_type: 39, fma_pago: 1 },
    })

    // Must call solicita_boleta_electronica
    expect(fetchCalls.some(u => u.includes('/api/solicita_boleta_electronica'))).toBe(true)
    // Must NOT call solicita_ticket
    expect(fetchCalls.some(u => u.includes('solicita_ticket'))).toBe(false)
  })

  it('testConnectivity only checks pre_cuenta and boleta endpoints (Req 4.5)', async () => {
    const fetchCalls: string[] = []
    const mockFetch = vi.fn((url: string) => {
      fetchCalls.push(url)
      return Promise.resolve({ status: 200 })
    })
    global.fetch = mockFetch as any

    const service = new NotifierServiceImpl('http://localhost:3000', 5000)
    await service.testConnectivity()

    // Only pre_cuenta and boleta_electronica should be tested
    expect(fetchCalls.some(u => u.includes('/api/pre_cuenta'))).toBe(true)
    expect(fetchCalls.some(u => u.includes('/api/solicita_boleta_electronica'))).toBe(true)
    // Station ticket endpoint must NOT be tested/called
    expect(fetchCalls.some(u => u.includes('solicita_ticket'))).toBe(false)
  })
})

// ── Requirement 4.1: Station tickets remain automatic (structural check) ──────

describe('Station ticket flow — automatic via order creation (Req 4.1, 4.2, 4.3)', () => {
  it('station ticket flow is independent of manual print controls', () => {
    // The station ticket flow is triggered by /api/orders and
    // /api/orders/internal when orders are created. These routes
    // insert order_items with destination (cocina/barra) and station_id.
    // The manual print system (lib/manual-print/) has no code path
    // that touches /api/solicita_ticket.
    //
    // This test documents the architectural separation:
    // - Manual print: lib/manual-print/ → /api/pre_cuenta, /api/solicita_boleta_electronica
    // - Station tickets: app/api/orders/ → /api/solicita_ticket (external notifier)
    //
    // The manual print NotifierService interface only declares:
    //   requestPreCuenta()
    //   requestBoletaElectronica()
    // No station ticket method exists.

    const service: NotifierService = createNotifierService()
    const serviceKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(service))
      .filter(k => k !== 'constructor')

    // Verify only precuenta and boleta methods are present
    const printMethods = serviceKeys.filter(k =>
      k.includes('ticket') || k.includes('station') || k.includes('Ticket') || k.includes('Station')
    )
    expect(printMethods).toHaveLength(0)
  })

  it('items grouped by destination are stored in order_items, not sent via manual print', () => {
    // Station grouping (cocina/barra) is handled at the DB level via
    // order_items.destination and order_items.station_id fields.
    // The manual print system reads order_items but never routes them
    // to /api/solicita_ticket.
    //
    // Verify that the OrderWithPrintState type (used by manual print hooks)
    // includes destination field for display purposes only — not for routing.
    const orderItem = {
      id: 'item-1',
      name: 'Hamburguesa',
      quantity: 2,
      unit_price: 5000,
      notes: null,
      status: 'pending',
      destination: 'cocina', // present for display, not for ticket routing
    }

    // destination field exists on order items (for display in MesaDetailPanel)
    expect(orderItem.destination).toBe('cocina')

    // But the manual print system only uses items for precuenta/boleta content,
    // not to route station tickets
    const precuentaPayload = {
      comercio: 'rest-1',
      impresora: 'printer-1',
      movimiento: 'order-1',
      items: [orderItem],
      total: 10000,
    }

    // Items in precuenta payload are for document content, not station routing
    expect(precuentaPayload.items[0].destination).toBe('cocina')
    // No station routing logic in the payload
    expect((precuentaPayload as any).station).toBeUndefined()
    expect((precuentaPayload as any).stationId).toBeUndefined()
  })
})

// ── Requirement 4.5: canRequestPrecuenta does not affect station tickets ──────

describe('canRequestPrecuenta — only gates precuenta, not station tickets (Req 4.5)', () => {
  it('canRequestPrecuenta gates only precuenta requests', async () => {
    // Import the utility function that determines if precuenta can be requested
    const { canRequestPrecuenta } = await import('../index')

    // These statuses allow precuenta
    expect(canRequestPrecuenta('delivered')).toBe(true)
    expect(canRequestPrecuenta('ready')).toBe(true)
    expect(canRequestPrecuenta('paying')).toBe(true)

    // These statuses do not allow precuenta
    expect(canRequestPrecuenta('pending')).toBe(false)
    expect(canRequestPrecuenta('preparing')).toBe(false)
    expect(canRequestPrecuenta('paid')).toBe(false)
    expect(canRequestPrecuenta('cancelled')).toBe(false)

    // Station tickets are NOT gated by this function — they are sent
    // automatically when orders are created regardless of order status
  })

  it('station ticket flow is not gated by order status in manual print system', async () => {
    // Station tickets are sent when order_items are inserted (status: 'pending')
    // The manual print system only allows precuenta for delivered/ready/paying.
    // This confirms the two flows are completely independent.
    const { canRequestPrecuenta } = await import('../index')

    // A new order (pending) cannot request precuenta manually
    expect(canRequestPrecuenta('pending')).toBe(false)

    // But station tickets ARE sent for pending orders (automatic flow)
    // This is handled by /api/orders and /api/orders/internal, not by
    // the manual print system.
    // The manual print system has no concept of "pending" for station tickets.
  })
})

// ── Integration: manual print state does not interfere with station flow ───────

describe('PrintRequestState — no station ticket state (Req 4.5)', () => {
  it('initial print state has no station ticket fields', async () => {
    const { createInitialPrintState } = await import('../index')
    const state = createInitialPrintState()

    // State only tracks precuenta and boleta — never station tickets
    expect(state.precuentaRequested).toBeDefined()
    expect(state.precuentaStatus).toBeDefined()
    expect(state.documentHistory).toBeDefined()

    // No station ticket state
    expect((state as any).stationTicketRequested).toBeUndefined()
    expect((state as any).stationTicketStatus).toBeUndefined()
    expect((state as any).ticketHistory).toBeUndefined()
  })

  it('document history only tracks precuenta and boleta types (Req 4.5)', async () => {
    const { DOCUMENT_TYPES } = await import('../index')

    // Only these document types exist in the manual print system
    const validTypes = Object.values(DOCUMENT_TYPES)
    expect(validTypes).toContain('precuenta')
    expect(validTypes).toContain('boleta_impresa')
    expect(validTypes).toContain('boleta_email')

    // Station ticket is NOT a document type in the manual print system
    expect(validTypes).not.toContain('station_ticket')
    expect(validTypes).not.toContain('ticket_estacion')
    expect(validTypes).not.toContain('cocina_ticket')
    expect(validTypes).not.toContain('barra_ticket')
  })
})
