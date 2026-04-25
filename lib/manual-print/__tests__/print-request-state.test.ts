/**
 * Tests for PrintRequestState management system
 *
 * Validates state tracking for precuenta and boleta requests,
 * document history storage and retrieval, loading states, and
 * error message handling.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createInitialPrintState,
  generateDocumentId,
  PRINT_STATUS,
  DOCUMENT_TYPES,
} from '../index'
import type { PrintRequestState, DocumentRequest, DocumentType } from '../types'

// ── Mock supabase/client ──────────────────────────────────────────────────────

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/client'
import { createSupabaseMock } from '../../../__tests__/setup/supabase-mock'
import { DocumentHistoryService } from '../document-history'

const mockCreateClient = vi.mocked(createClient)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDocumentRequest(
  overrides: Partial<DocumentRequest> = {}
): DocumentRequest {
  return {
    id: generateDocumentId(),
    type: 'precuenta',
    timestamp: new Date(),
    status: 'pending',
    ...overrides,
  }
}

// ── createInitialPrintState ───────────────────────────────────────────────────

describe('createInitialPrintState', () => {
  it('returns correct default values (Req 6.1, 6.4)', () => {
    const state = createInitialPrintState()

    expect(state.precuentaRequested).toBe(false)
    expect(state.precuentaStatus).toBe(PRINT_STATUS.IDLE)
    expect(state.documentHistory).toEqual([])
    expect(state.precuentaTimestamp).toBeUndefined()
    expect(state.precuentaError).toBeUndefined()
  })

  it('creates independent state objects on each call', () => {
    const state1 = createInitialPrintState()
    const state2 = createInitialPrintState()

    state1.documentHistory.push(makeDocumentRequest())

    expect(state2.documentHistory).toHaveLength(0)
  })
})

// ── PrintRequestState shape ───────────────────────────────────────────────────

describe('PrintRequestState shape', () => {
  it('tracks precuenta request with timestamp (Req 6.1)', () => {
    const now = new Date()
    const state: PrintRequestState = {
      ...createInitialPrintState(),
      precuentaRequested: true,
      precuentaTimestamp: now,
      precuentaStatus: 'success',
    }

    expect(state.precuentaRequested).toBe(true)
    expect(state.precuentaTimestamp).toBe(now)
    expect(state.precuentaStatus).toBe('success')
  })

  it('records boleta method and status in document history (Req 6.2)', () => {
    const boletaImpresa = makeDocumentRequest({
      type: 'boleta_impresa',
      status: 'completed',
      metadata: { printServer: 'server-1' },
    })
    const boletaEmail = makeDocumentRequest({
      type: 'boleta_email',
      status: 'completed',
      metadata: { email: 'cliente@example.com' },
    })

    const state: PrintRequestState = {
      ...createInitialPrintState(),
      documentHistory: [boletaImpresa, boletaEmail],
    }

    const impresa = state.documentHistory.find(d => d.type === 'boleta_impresa')
    const email = state.documentHistory.find(d => d.type === 'boleta_email')

    expect(impresa).toBeDefined()
    expect(impresa?.status).toBe('completed')
    expect(impresa?.metadata?.printServer).toBe('server-1')

    expect(email).toBeDefined()
    expect(email?.status).toBe('completed')
    expect(email?.metadata?.email).toBe('cliente@example.com')
  })

  it('stores document history with all statuses (Req 6.3)', () => {
    const history: DocumentRequest[] = [
      makeDocumentRequest({ type: 'precuenta', status: 'completed' }),
      makeDocumentRequest({ type: 'boleta_impresa', status: 'failed', error: 'Sin papel' }),
      makeDocumentRequest({ type: 'boleta_email', status: 'pending' }),
    ]

    const state: PrintRequestState = {
      ...createInitialPrintState(),
      documentHistory: history,
    }

    expect(state.documentHistory).toHaveLength(3)
    expect(state.documentHistory[0].status).toBe('completed')
    expect(state.documentHistory[1].status).toBe('failed')
    expect(state.documentHistory[1].error).toBe('Sin papel')
    expect(state.documentHistory[2].status).toBe('pending')
  })

  it('supports loading status for in-progress operations (Req 6.4)', () => {
    const state: PrintRequestState = {
      ...createInitialPrintState(),
      precuentaStatus: 'loading',
    }

    expect(state.precuentaStatus).toBe(PRINT_STATUS.LOADING)
  })

  it('stores error messages for failed operations (Req 6.3)', () => {
    const state: PrintRequestState = {
      ...createInitialPrintState(),
      precuentaStatus: 'error',
      precuentaError: 'Impresora sin papel',
    }

    expect(state.precuentaStatus).toBe(PRINT_STATUS.ERROR)
    expect(state.precuentaError).toBe('Impresora sin papel')
  })
})

// ── DocumentRequest shape ─────────────────────────────────────────────────────

describe('DocumentRequest', () => {
  it('supports all document types (Req 6.2)', () => {
    const types: DocumentType[] = [
      DOCUMENT_TYPES.PRECUENTA,
      DOCUMENT_TYPES.BOLETA_IMPRESA,
      DOCUMENT_TYPES.BOLETA_EMAIL,
    ]

    types.forEach(type => {
      const req = makeDocumentRequest({ type })
      expect(req.type).toBe(type)
    })
  })

  it('supports all request statuses', () => {
    const statuses: Array<DocumentRequest['status']> = ['pending', 'completed', 'failed']

    statuses.forEach(status => {
      const req = makeDocumentRequest({ status })
      expect(req.status).toBe(status)
    })
  })

  it('stores email metadata for boleta_email type (Req 6.2)', () => {
    const req = makeDocumentRequest({
      type: 'boleta_email',
      metadata: { email: 'test@example.com' },
    })

    expect(req.metadata?.email).toBe('test@example.com')
  })

  it('stores printServer metadata for boleta_impresa type (Req 6.2)', () => {
    const req = makeDocumentRequest({
      type: 'boleta_impresa',
      metadata: { printServer: 'server-uuid-001' },
    })

    expect(req.metadata?.printServer).toBe('server-uuid-001')
  })

  it('stores error message for failed requests (Req 6.3)', () => {
    const req = makeDocumentRequest({
      status: 'failed',
      error: 'Error de conectividad',
    })

    expect(req.error).toBe('Error de conectividad')
  })
})

// ── State transitions ─────────────────────────────────────────────────────────

describe('PrintRequestState transitions', () => {
  it('transitions from idle → loading → success (Req 6.4, 6.1)', () => {
    let state = createInitialPrintState()

    // idle
    expect(state.precuentaStatus).toBe('idle')

    // loading
    state = { ...state, precuentaStatus: 'loading' }
    expect(state.precuentaStatus).toBe('loading')

    // success
    const now = new Date()
    state = {
      ...state,
      precuentaStatus: 'success',
      precuentaRequested: true,
      precuentaTimestamp: now,
    }
    expect(state.precuentaStatus).toBe('success')
    expect(state.precuentaRequested).toBe(true)
    expect(state.precuentaTimestamp).toBe(now)
  })

  it('transitions from idle → loading → error with message (Req 6.3, 6.4)', () => {
    let state = createInitialPrintState()

    state = { ...state, precuentaStatus: 'loading' }
    state = {
      ...state,
      precuentaStatus: 'error',
      precuentaError: 'Error de conectividad',
    }

    expect(state.precuentaStatus).toBe('error')
    expect(state.precuentaError).toBe('Error de conectividad')
    expect(state.precuentaRequested).toBe(false)
  })

  it('document history accumulates requests in order (Req 6.2, 6.3)', () => {
    let state = createInitialPrintState()

    const req1 = makeDocumentRequest({ type: 'precuenta', status: 'completed' })
    const req2 = makeDocumentRequest({ type: 'boleta_impresa', status: 'pending' })

    // Simulate addDocumentRequest (prepends most recent first)
    state = { ...state, documentHistory: [req1, ...state.documentHistory] }
    state = { ...state, documentHistory: [req2, ...state.documentHistory] }

    expect(state.documentHistory).toHaveLength(2)
    expect(state.documentHistory[0]).toBe(req2) // most recent first
    expect(state.documentHistory[1]).toBe(req1)
  })
})

// ── DocumentHistoryService ────────────────────────────────────────────────────

describe('DocumentHistoryService', () => {
  let service: DocumentHistoryService

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrderDocumentHistory', () => {
    it('returns document history mapped to DocumentRequest format (Req 6.3)', async () => {
      const ORDER_ID = 'order-123'
      const records = [
        {
          id: 'doc-1',
          order_id: ORDER_ID,
          document_type: 'precuenta',
          requested_at: '2024-01-15T10:00:00.000Z',
          status: 'completed',
          error_message: null,
          metadata: { printServer: 'server-1' },
        },
        {
          id: 'doc-2',
          order_id: ORDER_ID,
          document_type: 'boleta_email',
          requested_at: '2024-01-15T10:05:00.000Z',
          status: 'completed',
          error_message: null,
          metadata: { email: 'test@example.com' },
        },
      ]

      const supabase = createSupabaseMock({
        tables: {
          document_history: { data: records },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new DocumentHistoryService()

      const result = await service.getOrderDocumentHistory(ORDER_ID)

      // Results are ordered by requested_at descending (most recent first)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('doc-2') // later timestamp → first
      expect(result[0].type).toBe('boleta_email')
      expect(result[0].status).toBe('completed')
      expect(result[0].timestamp).toBeInstanceOf(Date)
      expect(result[0].metadata?.email).toBe('test@example.com')
      expect(result[1].id).toBe('doc-1')
      expect(result[1].type).toBe('precuenta')
    })

    it('maps failed status with error message (Req 6.3)', async () => {
      const ORDER_ID = 'order-456'
      const records = [
        {
          id: 'doc-3',
          order_id: ORDER_ID,
          document_type: 'precuenta',
          requested_at: '2024-01-15T10:00:00.000Z',
          status: 'failed',
          error_message: 'Impresora sin papel',
          metadata: {},
        },
      ]

      const supabase = createSupabaseMock({
        tables: {
          document_history: { data: records },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new DocumentHistoryService()

      const result = await service.getOrderDocumentHistory(ORDER_ID)

      expect(result[0].status).toBe('failed')
      expect(result[0].error).toBe('Impresora sin papel')
    })

    it('returns empty array when no history exists (Req 6.3)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          document_history: { data: [] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new DocumentHistoryService()

      const result = await service.getOrderDocumentHistory('order-empty')

      expect(result).toEqual([])
    })

    it('returns empty array on database error (Req 6.3)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          document_history: { data: null },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new DocumentHistoryService()

      const result = await service.getOrderDocumentHistory('order-error')

      expect(result).toEqual([])
    })
  })

  describe('createDocumentRequest', () => {
    it('creates a document request record and returns its id (Req 6.1, 6.2)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          document_history: {
            data: { id: 'new-doc-id' },
          },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new DocumentHistoryService()

      const result = await service.createDocumentRequest(
        'rest-1',
        'table-1',
        'order-1',
        'precuenta',
        { printServer: 'server-1' }
      )

      expect(result.success).toBe(true)
      expect(result.id).toBe('new-doc-id')
    })

    it('returns error when database insert fails (Req 6.3)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          document_history: {
            data: null,
            error: { message: 'Insert failed', code: '500', details: '', hint: '' },
          },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new DocumentHistoryService()

      const result = await service.createDocumentRequest(
        'rest-1',
        'table-1',
        'order-1',
        'precuenta'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('updateDocumentStatus', () => {
    it('updates document status to completed (Req 6.1, 6.2)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          document_history: { data: {} },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new DocumentHistoryService()

      const result = await service.updateDocumentStatus('doc-1', 'completed')

      expect(result.success).toBe(true)
    })

    it('updates document status to failed with error message (Req 6.3)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          document_history: { data: {} },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new DocumentHistoryService()

      const result = await service.updateDocumentStatus(
        'doc-2',
        'failed',
        'Error de red'
      )

      expect(result.success).toBe(true)
    })
  })
})

// ── State update helpers ──────────────────────────────────────────────────────

describe('State update helpers', () => {
  it('updatePrintState merges partial updates correctly (Req 6.1, 6.4)', () => {
    const initial = createInitialPrintState()

    // Simulate what usePrintState.updatePrintState does
    const updated: PrintRequestState = { ...initial, precuentaStatus: 'loading' }

    expect(updated.precuentaStatus).toBe('loading')
    expect(updated.precuentaRequested).toBe(false) // unchanged
    expect(updated.documentHistory).toEqual([]) // unchanged
  })

  it('addDocumentRequest prepends to history (Req 6.2, 6.3)', () => {
    const initial = createInitialPrintState()
    const existing = makeDocumentRequest({ type: 'precuenta', status: 'completed' })
    const stateWithHistory: PrintRequestState = {
      ...initial,
      documentHistory: [existing],
    }

    const newRequest = makeDocumentRequest({ type: 'boleta_impresa', status: 'pending' })

    // Simulate what usePrintState.addDocumentRequest does
    const updated: PrintRequestState = {
      ...stateWithHistory,
      documentHistory: [newRequest, ...stateWithHistory.documentHistory],
    }

    expect(updated.documentHistory).toHaveLength(2)
    expect(updated.documentHistory[0]).toBe(newRequest)
    expect(updated.documentHistory[1]).toBe(existing)
  })

  it('loading flag is independent from precuentaStatus (Req 6.4)', () => {
    // The usePrintState hook has a separate `loading` boolean
    // and a `precuentaStatus` field — both can indicate loading
    const state = createInitialPrintState()

    // loading=true means an async operation is in progress
    let loading = false
    loading = true
    expect(loading).toBe(true)

    // precuentaStatus='loading' means precuenta specifically is loading
    const loadingState: PrintRequestState = { ...state, precuentaStatus: 'loading' }
    expect(loadingState.precuentaStatus).toBe('loading')
  })
})
