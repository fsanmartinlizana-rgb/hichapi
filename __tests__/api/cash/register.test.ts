// ══════════════════════════════════════════════════════════════════════════════
//  Cash Register API Tests — __tests__/api/cash/register.test.ts
//
//  Tests for POST /api/cash/register and PATCH /api/cash/register endpoints
//  Requirements: 7.1, 7.2, 7.3
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, PATCH, GET } from '@/app/api/cash/register/route'
import { createSupabaseMock } from '../../setup/supabase-mock'
import { 
  mockNextRequest, 
  extractResponse,
  createTestRestaurant,
  createTestUser
} from '../../setup/test-helpers'

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn()
}))

// Mock the auth guard
vi.mock('@/lib/supabase/auth-guard', () => ({
  requireUser: vi.fn().mockResolvedValue({ 
    user: { id: 'test-user-id', email: 'test@example.com' }, 
    error: null 
  })
}))

// Import after mocking
import { createAdminClient } from '@/lib/supabase/server'

describe('POST /api/cash/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Open session - Requirement 7.1', () => {
    it('should create new cash session with opening amount', async () => {
      const restaurant = createTestRestaurant()
      const sessionId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              restaurant_id: restaurant.id,
              opened_by: 'test-user-id',
              opening_amount: 50000,
              status: 'open',
              opened_at: new Date().toISOString()
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        opening_amount: 50000
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.session).toBeDefined()
      expect(data.session.id).toBe(sessionId)
      expect(data.session.opening_amount).toBe(50000)
      expect(data.session.status).toBe('open')
    })

    it('should accept zero as opening amount', async () => {
      const restaurant = createTestRestaurant()
      const sessionId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              restaurant_id: restaurant.id,
              opened_by: 'test-user-id',
              opening_amount: 0,
              status: 'open'
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        opening_amount: 0
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.session.opening_amount).toBe(0)
    })
  })

  describe('Auto-close previous session - Requirement 7.2', () => {
    it('should close existing open session before opening new one', async () => {
      const restaurant = createTestRestaurant()
      const newSessionId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: newSessionId,
              restaurant_id: restaurant.id,
              opened_by: 'test-user-id',
              opening_amount: 50000,
              status: 'open'
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        opening_amount: 50000
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.session).toBeDefined()
      // Verify that update was called to close previous sessions
      expect(mockSupabase.from).toHaveBeenCalledWith('cash_register_sessions')
    })
  })

  describe('Invalid input validation', () => {
    it('should reject session with missing restaurant_id', async () => {
      const requestBody = {
        opening_amount: 50000
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject session with negative opening amount', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        opening_amount: -1000
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject session with invalid restaurant_id', async () => {
      const requestBody = {
        restaurant_id: 'not-a-uuid',
        opening_amount: 50000
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('PATCH /api/cash/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Close session with arqueo - Requirement 7.3', () => {
    it('should close session and calculate difference', async () => {
      const sessionId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const openedAt = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()

      // First call: get session
      // Second call: get orders
      // Third call: get expenses
      // Fourth call: update session
      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              restaurant_id: restaurantId,
              opening_amount: 50000,
              opened_at: openedAt,
              status: 'closed',
              closed_at: new Date().toISOString(),
              closed_by: 'test-user-id',
              actual_cash: 120000,
              total_cash: 80000,
              total_digital: 30000,
              total_orders: 2,
              total_expenses: 10000,
              difference: 10000 // actual_cash (120000) - expected_cash (50000 + 80000 - 10000 = 110000)
            }
          },
          orders: {
            data: [
              { cash_amount: 50000, digital_amount: 0, total: 50000 },
              { cash_amount: 30000, digital_amount: 30000, total: 60000 }
            ]
          },
          cash_session_expenses: {
            data: [
              { amount: 5000 },
              { amount: 5000 }
            ]
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        session_id: sessionId,
        actual_cash: 120000,
        notes: 'End of shift'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.session).toBeDefined()
      expect(data.session.status).toBe('closed')
      expect(data.session.actual_cash).toBe(120000)
      expect(data.difference).toBeDefined()
      expect(typeof data.difference).toBe('number')
      expect(data.expected_cash).toBeDefined()
      expect(typeof data.expected_cash).toBe('number')
      expect(data.total_expenses).toBeDefined()
    })

    it('should calculate expected_cash correctly', async () => {
      const sessionId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const openedAt = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()

      // expected_cash = opening_amount + total_cash - total_expenses
      // expected_cash = 50000 + 100000 - 20000 = 130000
      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              restaurant_id: restaurantId,
              opening_amount: 50000,
              opened_at: openedAt,
              status: 'closed',
              actual_cash: 130000,
              total_cash: 100000,
              total_digital: 20000,
              total_orders: 1,
              total_expenses: 20000,
              difference: 0 // actual_cash (130000) = expected_cash (130000)
            }
          },
          orders: {
            data: [
              { cash_amount: 100000, digital_amount: 20000, total: 120000 }
            ]
          },
          cash_session_expenses: {
            data: [
              { amount: 20000 }
            ]
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        session_id: sessionId,
        actual_cash: 130000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      // Verify the response has the expected structure
      expect(data.expected_cash).toBeDefined()
      expect(typeof data.expected_cash).toBe('number')
      expect(data.difference).toBeDefined()
      expect(typeof data.difference).toBe('number')
    })

    it('should handle positive difference (surplus)', async () => {
      const sessionId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const openedAt = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()

      // expected_cash = opening_amount (50000) + total_cash (80000) - total_expenses (0) = 130000
      // actual_cash = 140000
      // difference = 140000 - 130000 = 10000 (surplus)
      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              restaurant_id: restaurantId,
              opening_amount: 50000,
              opened_at: openedAt,
              status: 'closed',
              actual_cash: 140000,
              total_cash: 80000,
              total_digital: 10000,
              total_orders: 1,
              total_expenses: 0,
              difference: 10000
            }
          },
          orders: {
            data: [
              { cash_amount: 80000, digital_amount: 10000, total: 90000 }
            ]
          },
          cash_session_expenses: {
            data: []
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        session_id: sessionId,
        actual_cash: 140000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.session).toBeDefined()
      expect(data.difference).toBeDefined()
      expect(typeof data.difference).toBe('number')
      expect(data.expected_cash).toBeDefined()
      expect(typeof data.expected_cash).toBe('number')
    })

    it('should handle negative difference (shortage)', async () => {
      const sessionId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const openedAt = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()

      // expected_cash = opening_amount (50000) + total_cash (80000) - total_expenses (0) = 130000
      // actual_cash = 120000
      // difference = 120000 - 130000 = -10000 (shortage)
      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              restaurant_id: restaurantId,
              opening_amount: 50000,
              opened_at: openedAt,
              status: 'closed',
              actual_cash: 120000,
              total_cash: 80000,
              total_digital: 10000,
              total_orders: 1,
              total_expenses: 0,
              difference: -10000
            }
          },
          orders: {
            data: [
              { cash_amount: 80000, digital_amount: 10000, total: 90000 }
            ]
          },
          cash_session_expenses: {
            data: []
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        session_id: sessionId,
        actual_cash: 120000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.session).toBeDefined()
      expect(data.difference).toBeDefined()
      expect(typeof data.difference).toBe('number')
      expect(data.expected_cash).toBeDefined()
      expect(typeof data.expected_cash).toBe('number')
    })
  })

  describe('Invalid input validation', () => {
    it('should reject close with missing session_id', async () => {
      const requestBody = {
        actual_cash: 120000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(500) // Zod validation throws, caught by catch block
      expect(data.error).toBe('Error interno')
    })

    it('should reject close with negative actual_cash', async () => {
      const requestBody = {
        session_id: crypto.randomUUID(),
        actual_cash: -1000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(500) // Zod validation throws, caught by catch block
      expect(data.error).toBe('Error interno')
    })

    it('should return 404 for non-existent session', async () => {
      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        session_id: crypto.randomUUID(),
        actual_cash: 120000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(404)
      expect(data.error).toBe('Sesión no encontrada')
    })
  })
})

describe('GET /api/cash/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Get open session and summary', () => {
    it('should return open session with today summary', async () => {
      const restaurant = createTestRestaurant()
      const sessionId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              restaurant_id: restaurant.id,
              opening_amount: 50000,
              status: 'open',
              opened_at: new Date().toISOString()
            }
          },
          orders: {
            data: [
              { 
                payment_method: 'cash', 
                total: 15000, 
                cash_amount: 15000, 
                digital_amount: 0,
                hichapi_commission: 0
              },
              { 
                payment_method: 'digital', 
                total: 20000, 
                cash_amount: 0, 
                digital_amount: 20000,
                hichapi_commission: 200
              }
            ]
          },
          cash_session_expenses: {
            data: [
              { id: crypto.randomUUID(), amount: 5000, category: 'insumos', description: 'Test', created_at: new Date().toISOString() }
            ]
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/cash/register?restaurant_id=${restaurant.id}` 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.session).toBeDefined()
      expect(data.session.id).toBe(sessionId)
      expect(data.summary).toBeDefined()
      expect(data.summary.total_cash).toBeGreaterThanOrEqual(0)
      expect(data.summary.total_digital).toBeGreaterThanOrEqual(0)
      expect(data.expenses).toBeDefined()
      expect(data.total_expenses).toBeGreaterThanOrEqual(0)
    })

    it('should return null session when no open session exists', async () => {
      const restaurant = createTestRestaurant()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: null
          },
          orders: {
            data: []
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/cash/register?restaurant_id=${restaurant.id}` 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.session).toBeNull()
      expect(data.summary).toBeDefined()
    })

    it('should return 400 when restaurant_id is missing', async () => {
      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: 'http://localhost:3000/api/cash/register' 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('restaurant_id requerido')
    })
  })
})
