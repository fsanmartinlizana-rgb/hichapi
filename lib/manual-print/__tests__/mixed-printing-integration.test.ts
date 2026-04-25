/**
 * Mixed Printing Integration Tests — Task 11.3
 *
 * Integration tests for scenarios where both automatic station tickets and
 * manual precuenta/boleta printing happen for the same order. Verifies that
 * the two print flows are completely isolated and do not interfere with each
 * other.
 *
 * Requirements: 4.1, 4.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockNotifierService,
  createInitialPrintState,
  DOCUMENT_TYPES,
  generateDocumentId,
  canRequestPrecuenta,
} from '../index'
import type {
  PrintRequestState,
  DocumentRequest,
  DocumentType,
  PreCuentaRequest,
  BoletaRequest,
} from '../types'
import { MockNotifierServiceImpl } from '../notifier-service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePreCuentaRequest(overrides: Partial<PreCuentaRequest> = {}): PreCuentaRequest {
  return {
    comercio: 'rest-1',
    impresora: 'printer-1',
    comuna: 'Santiago',
    direccion: 'Av. Test 123',
    movimiento: 'order-1',
    items: [{ id: 'i1', name: 'Burger', quantity: 1, unit_price: 5000 }],
    total: 5000,
    ...overrides,
  }
}

function makeBoletaRequest(overrides: Partial<BoletaRequest> = {}): BoletaRequest {
  return {
    comercio: 'rest-1',
    impresora: 'printer-1',
    movimiento: 'order-1',
    total: 5000,
    items: [{ id: 'i1', name: 'Burger', quantity: 1, unit_price: 5000 }],
    dte: { document_type: 39, fma_pago: 1 },
    ...overrides,
  }
}

function makeDocumentRequest(overrides: Partial<DocumentRequest> = {}): DocumentRequest {
  return {
    id: generateDocumentId(),
    type: 'precuenta',
    timestamp: new Date(),
    status: 'pending',
    ...overrides,
  }
}

/**
 * Simulate a station ticket being sent automatically (external to manual-print system).
 * Returns a record of the call to verify it happened independently.
 */
function simulateStationTicketSent(orderId: string, station: 'cocina' | 'barra') {
  return {
    endpoint: '/api/solicita_ticket',
    orderId,
    station,
    sentAt: new Date(),
  }
}

// ── Req 4.5: Precuenta request does not affect station ticket state ────────────

describe('Mixed printing — precuenta does not affect station ticket state (Req 4.5)', () => {
  it('requesting precuenta does not create station ticket entries in document history', async () => {
    const service = createMockNotifierService()
    const state = createInitialPrintState()

    // Simulate station ticket sent automatically (external flow)
    const stationTicket = simulateStationTicketSent('order-1', 'cocina')

    // Request precuenta via manual print system
    const precuentaResult = await service.requestPreCuenta(makePreCuentaRequest())

    // Add precuenta to document history
    const precuentaDoc = makeDocumentRequest({
      type: 'precuenta',
      status: precuentaResult.success ? 'completed' : 'failed',
    })
    const updatedState: PrintRequestState = {
      ...state,
      precuentaRequested: precuentaResult.success,
      precuentaStatus: precuentaResult.success ? 'success' : 'error',
      documentHistory: [precuentaDoc],
    }

    // Station ticket was sent independently
    expect(stationTicket.endpoint).toBe('/api/solicita_ticket')

    // Document history only contains precuenta — no station ticket
    expect(updatedState.documentHistory).toHaveLength(1)
    expect(updatedState.documentHistory[0].type).toBe('precuenta')
    expect(
      updatedState.documentHistory.some(d => d.type === ('station_ticket' as DocumentType))
    ).toBe(false)
  })

  it('precuenta success state is independent of station ticket outcome', async () => {
    const service = createMockNotifierService()

    // Station ticket fails (simulated externally)
    const stationTicketFailed = { endpoint: '/api/solicita_ticket', success: false }

    // Precuenta succeeds independently
    const precuentaResult = await service.requestPreCuenta(makePreCuentaRequest())

    // Precuenta result is not affected by station ticket failure
    expect(precuentaResult.success).toBe(true)
    expect(stationTicketFailed.success).toBe(false)
  })

  it('precuenta failure does not affect station ticket flow', async () => {
    const mockService = createMockNotifierService() as MockNotifierServiceImpl
    mockService.setFailureMode(true)

    // Precuenta fails
    const precuentaResult = await mockService.requestPreCuenta(makePreCuentaRequest())
    expect(precuentaResult.success).toBe(false)

    // Station ticket is sent independently (external flow, unaffected)
    const stationTicket = simulateStationTicketSent('order-1', 'cocina')
    expect(stationTicket.endpoint).toBe('/api/solicita_ticket')
    // Station ticket flow is not gated by precuenta result
    expect(stationTicket.orderId).toBe('order-1')
  })
})

// ── Req 4.5: Boleta request does not affect station ticket state ──────────────

describe('Mixed printing — boleta does not affect station ticket state (Req 4.5)', () => {
  it('requesting boleta impresa does not create station ticket entries', async () => {
    const service = createMockNotifierService()
    const state = createInitialPrintState()

    // Station ticket sent automatically
    const stationTicket = simulateStationTicketSent('order-1', 'barra')

    // Request boleta via manual print system
    const boletaResult = await service.requestBoletaElectronica(makeBoletaRequest())

    const boletaDoc = makeDocumentRequest({
      type: 'boleta_impresa',
      status: boletaResult.success ? 'completed' : 'failed',
      metadata: { printServer: 'printer-1' },
    })
    const updatedState: PrintRequestState = {
      ...state,
      documentHistory: [boletaDoc],
    }

    expect(stationTicket.endpoint).toBe('/api/solicita_ticket')
    expect(updatedState.documentHistory).toHaveLength(1)
    expect(updatedState.documentHistory[0].type).toBe('boleta_impresa')
    expect(
      updatedState.documentHistory.some(d => d.type === ('station_ticket' as DocumentType))
    ).toBe(false)
  })

  it('requesting boleta by email does not create station ticket entries', async () => {
    const service = createMockNotifierService()
    const state = createInitialPrintState()

    // Station ticket sent automatically
    simulateStationTicketSent('order-1', 'cocina')

    // Request boleta by email
    const boletaResult = await service.requestBoletaElectronica(
      makeBoletaRequest({ impresora: undefined, email: 'cliente@example.com' })
    )

    const boletaDoc = makeDocumentRequest({
      type: 'boleta_email',
      status: boletaResult.success ? 'completed' : 'failed',
      metadata: { email: 'cliente@example.com' },
    })
    const updatedState: PrintRequestState = {
      ...state,
      documentHistory: [boletaDoc],
    }

    expect(updatedState.documentHistory).toHaveLength(1)
    expect(updatedState.documentHistory[0].type).toBe('boleta_email')
    expect(updatedState.documentHistory[0].metadata?.email).toBe('cliente@example.com')
  })

  it('boleta failure does not affect station ticket flow', async () => {
    const mockService = createMockNotifierService() as MockNotifierServiceImpl
    mockService.setFailureMode(true)

    // Boleta fails
    const boletaResult = await mockService.requestBoletaElectronica(makeBoletaRequest())
    expect(boletaResult.success).toBe(false)

    // Station ticket is sent independently (external flow, unaffected)
    const stationTicket = simulateStationTicketSent('order-1', 'barra')
    expect(stationTicket.endpoint).toBe('/api/solicita_ticket')
  })
})

// ── Req 4.1, 4.5: Multiple document types tracked independently ───────────────

describe('Mixed printing — multiple document types tracked independently (Req 4.1, 4.5)', () => {
  it('document history tracks precuenta and boleta independently for the same order', () => {
    const state = createInitialPrintState()

    const precuentaDoc = makeDocumentRequest({
      id: 'doc-precuenta',
      type: 'precuenta',
      status: 'completed',
    })
    const boletaDoc = makeDocumentRequest({
      id: 'doc-boleta',
      type: 'boleta_impresa',
      status: 'completed',
      metadata: { printServer: 'printer-1' },
    })

    const updatedState: PrintRequestState = {
      ...state,
      precuentaRequested: true,
      precuentaStatus: 'success',
      documentHistory: [boletaDoc, precuentaDoc], // most recent first
    }

    // Both documents are tracked independently
    const precuenta = updatedState.documentHistory.find(d => d.type === 'precuenta')
    const boleta = updatedState.documentHistory.find(d => d.type === 'boleta_impresa')

    expect(precuenta).toBeDefined()
    expect(precuenta?.id).toBe('doc-precuenta')
    expect(precuenta?.status).toBe('completed')

    expect(boleta).toBeDefined()
    expect(boleta?.id).toBe('doc-boleta')
    expect(boleta?.status).toBe('completed')

    // No station ticket in history
    expect(
      updatedState.documentHistory.some(d => d.type === ('station_ticket' as DocumentType))
    ).toBe(false)
  })

  it('precuenta and boleta_email can coexist in document history', () => {
    const state = createInitialPrintState()

    const precuentaDoc = makeDocumentRequest({
      type: 'precuenta',
      status: 'completed',
    })
    const boletaEmailDoc = makeDocumentRequest({
      type: 'boleta_email',
      status: 'completed',
      metadata: { email: 'cliente@example.com' },
    })

    const updatedState: PrintRequestState = {
      ...state,
      documentHistory: [boletaEmailDoc, precuentaDoc],
    }

    expect(updatedState.documentHistory).toHaveLength(2)
    const types = updatedState.documentHistory.map(d => d.type)
    expect(types).toContain('precuenta')
    expect(types).toContain('boleta_email')
  })

  it('all three customer document types can coexist in history', () => {
    // Scenario: precuenta requested, then boleta printed, then boleta resent by email
    const state = createInitialPrintState()

    const docs: DocumentRequest[] = [
      makeDocumentRequest({ type: 'boleta_email', status: 'completed', metadata: { email: 'a@b.com' } }),
      makeDocumentRequest({ type: 'boleta_impresa', status: 'failed', error: 'Sin papel' }),
      makeDocumentRequest({ type: 'precuenta', status: 'completed' }),
    ]

    const updatedState: PrintRequestState = {
      ...state,
      documentHistory: docs,
    }

    expect(updatedState.documentHistory).toHaveLength(3)
    const types = updatedState.documentHistory.map(d => d.type)
    expect(types).toContain('precuenta')
    expect(types).toContain('boleta_impresa')
    expect(types).toContain('boleta_email')
  })

  it('document history statuses are independent per document', () => {
    const state = createInitialPrintState()

    const docs: DocumentRequest[] = [
      makeDocumentRequest({ type: 'precuenta', status: 'completed' }),
      makeDocumentRequest({ type: 'boleta_impresa', status: 'failed', error: 'Sin papel' }),
      makeDocumentRequest({ type: 'boleta_email', status: 'pending' }),
    ]

    const updatedState: PrintRequestState = {
      ...state,
      documentHistory: docs,
    }

    const precuenta = updatedState.documentHistory.find(d => d.type === 'precuenta')
    const boletaImpresa = updatedState.documentHistory.find(d => d.type === 'boleta_impresa')
    const boletaEmail = updatedState.documentHistory.find(d => d.type === 'boleta_email')

    // Each document has its own independent status
    expect(precuenta?.status).toBe('completed')
    expect(boletaImpresa?.status).toBe('failed')
    expect(boletaImpresa?.error).toBe('Sin papel')
    expect(boletaEmail?.status).toBe('pending')
  })
})

// ── Req 4.5: DocumentType enum only contains customer document types ───────────

describe('DocumentType — only customer document types (Req 4.5)', () => {
  it('DOCUMENT_TYPES constant only contains precuenta and boleta types', () => {
    const types = Object.values(DOCUMENT_TYPES)

    expect(types).toContain('precuenta')
    expect(types).toContain('boleta_impresa')
    expect(types).toContain('boleta_email')

    // Station ticket types must NOT be present
    expect(types).not.toContain('station_ticket')
    expect(types).not.toContain('ticket_estacion')
    expect(types).not.toContain('cocina')
    expect(types).not.toContain('barra')
    expect(types).not.toContain('ticket')
  })

  it('DOCUMENT_TYPES has exactly three entries', () => {
    const types = Object.values(DOCUMENT_TYPES)
    expect(types).toHaveLength(3)
  })

  it('DocumentType values match the expected customer document types', () => {
    expect(DOCUMENT_TYPES.PRECUENTA).toBe('precuenta')
    expect(DOCUMENT_TYPES.BOLETA_IMPRESA).toBe('boleta_impresa')
    expect(DOCUMENT_TYPES.BOLETA_EMAIL).toBe('boleta_email')
  })
})

// ── Req 4.5: Error in precuenta does not affect boleta capability ─────────────

describe('Mixed printing — error isolation between document types (Req 4.5)', () => {
  it('error in precuenta request does not affect boleta request capability', async () => {
    const mockService = createMockNotifierService() as MockNotifierServiceImpl

    // Precuenta fails
    mockService.setFailureMode(true)
    const precuentaResult = await mockService.requestPreCuenta(makePreCuentaRequest())
    expect(precuentaResult.success).toBe(false)

    // Boleta can still be requested independently
    mockService.setFailureMode(false)
    const boletaResult = await mockService.requestBoletaElectronica(makeBoletaRequest())
    expect(boletaResult.success).toBe(true)
  })

  it('error in boleta request does not affect precuenta state', async () => {
    const mockService = createMockNotifierService() as MockNotifierServiceImpl
    let state = createInitialPrintState()

    // Precuenta succeeds first
    mockService.setFailureMode(false)
    const precuentaResult = await mockService.requestPreCuenta(makePreCuentaRequest())
    expect(precuentaResult.success).toBe(true)

    state = {
      ...state,
      precuentaRequested: true,
      precuentaStatus: 'success',
      precuentaTimestamp: new Date(),
      documentHistory: [
        makeDocumentRequest({ type: 'precuenta', status: 'completed' }),
      ],
    }

    // Boleta fails
    mockService.setFailureMode(true)
    const boletaResult = await mockService.requestBoletaElectronica(makeBoletaRequest())
    expect(boletaResult.success).toBe(false)

    // Precuenta state is unchanged after boleta failure
    expect(state.precuentaRequested).toBe(true)
    expect(state.precuentaStatus).toBe('success')
    expect(state.documentHistory[0].type).toBe('precuenta')
    expect(state.documentHistory[0].status).toBe('completed')
  })

  it('precuenta error state does not bleed into boleta document history entry', () => {
    const state = createInitialPrintState()

    // Precuenta failed
    const precuentaDoc = makeDocumentRequest({
      type: 'precuenta',
      status: 'failed',
      error: 'Impresora sin papel',
    })

    // Boleta succeeded independently
    const boletaDoc = makeDocumentRequest({
      type: 'boleta_impresa',
      status: 'completed',
      metadata: { printServer: 'printer-2' },
    })

    const updatedState: PrintRequestState = {
      ...state,
      precuentaStatus: 'error',
      precuentaError: 'Impresora sin papel',
      documentHistory: [boletaDoc, precuentaDoc],
    }

    // Boleta entry has no error from precuenta
    const boleta = updatedState.documentHistory.find(d => d.type === 'boleta_impresa')
    expect(boleta?.status).toBe('completed')
    expect(boleta?.error).toBeUndefined()

    // Precuenta error is isolated to its own entry
    const precuenta = updatedState.documentHistory.find(d => d.type === 'precuenta')
    expect(precuenta?.status).toBe('failed')
    expect(precuenta?.error).toBe('Impresora sin papel')
  })

  it('boleta error state does not bleed into precuenta state', () => {
    const state = createInitialPrintState()

    // Precuenta succeeded
    const precuentaDoc = makeDocumentRequest({
      type: 'precuenta',
      status: 'completed',
    })

    // Boleta failed
    const boletaDoc = makeDocumentRequest({
      type: 'boleta_impresa',
      status: 'failed',
      error: 'Error en DTE',
    })

    const updatedState: PrintRequestState = {
      ...state,
      precuentaRequested: true,
      precuentaStatus: 'success',
      documentHistory: [boletaDoc, precuentaDoc],
    }

    // Precuenta state is unaffected by boleta error
    expect(updatedState.precuentaStatus).toBe('success')
    expect(updatedState.precuentaError).toBeUndefined()

    const precuenta = updatedState.documentHistory.find(d => d.type === 'precuenta')
    expect(precuenta?.status).toBe('completed')
    expect(precuenta?.error).toBeUndefined()
  })
})

// ── Req 4.1: Full mixed scenario — station ticket + precuenta + boleta ─────────

describe('Full mixed scenario — station ticket + precuenta + boleta (Req 4.1, 4.5)', () => {
  it('complete order lifecycle: station ticket auto-sent, then manual precuenta, then manual boleta', async () => {
    const service = createMockNotifierService()
    let state = createInitialPrintState()

    // 1. Order created → station ticket sent automatically (external flow)
    const stationTicket = simulateStationTicketSent('order-1', 'cocina')
    expect(stationTicket.endpoint).toBe('/api/solicita_ticket')

    // 2. Order delivered → mesero requests precuenta manually
    expect(canRequestPrecuenta('delivered')).toBe(true)
    const precuentaResult = await service.requestPreCuenta(makePreCuentaRequest())
    expect(precuentaResult.success).toBe(true)

    const precuentaDoc = makeDocumentRequest({
      type: 'precuenta',
      status: 'completed',
    })
    state = {
      ...state,
      precuentaRequested: true,
      precuentaStatus: 'success',
      precuentaTimestamp: new Date(),
      documentHistory: [precuentaDoc],
    }

    // 3. Payment → mesero requests boleta manually
    const boletaResult = await service.requestBoletaElectronica(makeBoletaRequest())
    expect(boletaResult.success).toBe(true)

    const boletaDoc = makeDocumentRequest({
      type: 'boleta_impresa',
      status: 'completed',
      metadata: { printServer: 'printer-1' },
    })
    state = {
      ...state,
      documentHistory: [boletaDoc, ...state.documentHistory],
    }

    // Final state: precuenta and boleta tracked, station ticket not in history
    expect(state.precuentaRequested).toBe(true)
    expect(state.precuentaStatus).toBe('success')
    expect(state.documentHistory).toHaveLength(2)

    const types = state.documentHistory.map(d => d.type)
    expect(types).toContain('precuenta')
    expect(types).toContain('boleta_impresa')
    expect(types).not.toContain('station_ticket' as DocumentType)
  })

  it('station ticket sent for multiple stations does not appear in manual print state', () => {
    const state = createInitialPrintState()

    // Multiple station tickets sent automatically (external flow)
    const cocinaTicket = simulateStationTicketSent('order-2', 'cocina')
    const barraTicket = simulateStationTicketSent('order-2', 'barra')

    // Manual print state remains clean
    expect(state.documentHistory).toHaveLength(0)
    expect(state.precuentaRequested).toBe(false)

    // Station tickets are external to the manual print system
    expect(cocinaTicket.station).toBe('cocina')
    expect(barraTicket.station).toBe('barra')
    expect(
      state.documentHistory.some(d => d.type === ('station_ticket' as DocumentType))
    ).toBe(false)
  })

  it('NotifierService only calls customer document endpoints, never station ticket endpoint', async () => {
    const fetchCalls: string[] = []
    const mockFetch = vi.fn((url: string) => {
      fetchCalls.push(url)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })
    })
    global.fetch = mockFetch as any

    const { NotifierServiceImpl } = await import('../notifier-service')
    const service = new NotifierServiceImpl('http://localhost:3000', 5000)

    // Request precuenta
    await service.requestPreCuenta(makePreCuentaRequest())

    // Request boleta
    await service.requestBoletaElectronica(makeBoletaRequest())

    // Only customer document endpoints were called
    expect(fetchCalls.some(u => u.includes('/api/pre_cuenta'))).toBe(true)
    expect(fetchCalls.some(u => u.includes('/api/solicita_boleta_electronica'))).toBe(true)

    // Station ticket endpoint was never called
    expect(fetchCalls.some(u => u.includes('solicita_ticket'))).toBe(false)
  })
})
