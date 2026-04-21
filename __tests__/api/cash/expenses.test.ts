// ══════════════════════════════════════════════════════════════════════════════
//  Cash Expenses API Tests — __tests__/api/cash/expenses.test.ts
//
//  Tests for POST /api/cash/expenses and DELETE /api/cash/expenses endpoints
//  Requirements: 7.5, 7.6, 7.7
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, DELETE, GET } from '@/app/api/cash/expenses/route'
import { createSupabaseMock, createPostgrestError } from '../../setup/supabase-mock'
import { 
  mockNextRequest, 
  extractResponse,
  createTestRestaurant
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

describe('POST /api/cash/expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Add expense to open session - Requirement 7.5', () => {
    it('should add expense to open session', async () => {
      const restaurant = createTestRestaurant()
      const sessionId = crypto.randomUUID()
      const expenseId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              status: 'open',
              restaurant_id: restaurant.id
            }
          },
          cash_session_expenses: {
            data: {
              id: expenseId,
              session_id: sessionId,
              restaurant_id: restaurant.id,
              amount: 15000,
              category: 'proveedor',
              description: 'Compra de insumos',
              created_by: 'test-user-id',
              created_at: new Date().toISOString()
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        session_id: sessionId,
        restaurant_id: restaurant.id,
        amount: 15000,
        category: 'proveedor',
        description: 'Compra de insumos'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.expense).toBeDefined()
      expect(data.expense.id).toBe(expenseId)
      expect(data.expense.amount).toBe(15000)
      expect(data.expense.category).toBe('proveedor')
    })

    it('should add expense with different categories', async () => {
      const restaurant = createTestRestaurant()
      const sessionId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              status: 'open',
              restaurant_id: restaurant.id
            }
          },
          cash_session_expenses: {
            data: {
              id: crypto.randomUUID(),
              session_id: sessionId,
              restaurant_id: restaurant.id,
              amount: 5000,
              category: 'propina',
              description: 'Propina para delivery',
              created_by: 'test-user-id'
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        session_id: sessionId,
        restaurant_id: restaurant.id,
        amount: 5000,
        category: 'propina',
        description: 'Propina para delivery'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.expense.category).toBe('propina')
    })

    it('should default to "otros" category when not specified', async () => {
      const restaurant = createTestRestaurant()
      const sessionId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              status: 'open',
              restaurant_id: restaurant.id
            }
          },
          cash_session_expenses: {
            data: {
              id: crypto.randomUUID(),
              session_id: sessionId,
              restaurant_id: restaurant.id,
              amount: 10000,
              category: 'otros',
              description: 'Gasto varios',
              created_by: 'test-user-id'
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        session_id: sessionId,
        restaurant_id: restaurant.id,
        amount: 10000,
        description: 'Gasto varios'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.expense.category).toBe('otros')
    })
  })

  describe('Reject for closed session - Requirement 7.6', () => {
    it('should reject expense for closed session', async () => {
      const restaurant = createTestRestaurant()
      const sessionId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              status: 'closed',
              restaurant_id: restaurant.id
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        session_id: sessionId,
        restaurant_id: restaurant.id,
        amount: 15000,
        category: 'proveedor',
        description: 'Compra de insumos'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('La caja está cerrada')
    })

    it('should return 404 for non-existent session', async () => {
      const restaurant = createTestRestaurant()

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
        restaurant_id: restaurant.id,
        amount: 15000,
        category: 'proveedor',
        description: 'Compra de insumos'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(404)
      expect(data.error).toBe('Sesión no encontrada')
    })

    it('should reject expense for session from different restaurant', async () => {
      const restaurant = createTestRestaurant()
      const sessionId = crypto.randomUUID()
      const otherRestaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_register_sessions: {
            data: {
              id: sessionId,
              status: 'open',
              restaurant_id: otherRestaurantId
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        session_id: sessionId,
        restaurant_id: restaurant.id,
        amount: 15000,
        category: 'proveedor',
        description: 'Compra de insumos'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(403)
      expect(data.error).toBe('Sesión no pertenece al restaurante')
    })
  })

  describe('Invalid input validation', () => {
    it('should reject expense with missing required fields', async () => {
      const requestBody = {
        session_id: crypto.randomUUID(),
        amount: 15000
        // missing restaurant_id and description
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject expense with zero amount', async () => {
      const requestBody = {
        session_id: crypto.randomUUID(),
        restaurant_id: crypto.randomUUID(),
        amount: 0,
        category: 'proveedor',
        description: 'Test'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject expense with negative amount', async () => {
      const requestBody = {
        session_id: crypto.randomUUID(),
        restaurant_id: crypto.randomUUID(),
        amount: -5000,
        category: 'proveedor',
        description: 'Test'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject expense with invalid category', async () => {
      const requestBody = {
        session_id: crypto.randomUUID(),
        restaurant_id: crypto.randomUUID(),
        amount: 15000,
        category: 'invalid_category',
        description: 'Test'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject expense with invalid session_id', async () => {
      const requestBody = {
        session_id: 'not-a-uuid',
        restaurant_id: crypto.randomUUID(),
        amount: 15000,
        category: 'proveedor',
        description: 'Test'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject expense with empty description', async () => {
      const requestBody = {
        session_id: crypto.randomUUID(),
        restaurant_id: crypto.randomUUID(),
        amount: 15000,
        category: 'proveedor',
        description: ''
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject expense with description too long', async () => {
      const requestBody = {
        session_id: crypto.randomUUID(),
        restaurant_id: crypto.randomUUID(),
        amount: 15000,
        category: 'proveedor',
        description: 'a'.repeat(201) // Max is 200
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('DELETE /api/cash/expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Remove expense from open session - Requirement 7.7', () => {
    it('should delete expense from open session', async () => {
      const restaurant = createTestRestaurant()
      const sessionId = crypto.randomUUID()
      const expenseId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_session_expenses: {
            data: {
              session_id: sessionId
            }
          },
          cash_register_sessions: {
            data: {
              status: 'open'
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: expenseId,
        restaurant_id: restaurant.id
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
    })

    it('should reject delete for closed session', async () => {
      const restaurant = createTestRestaurant()
      const sessionId = crypto.randomUUID()
      const expenseId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_session_expenses: {
            data: {
              session_id: sessionId
            }
          },
          cash_register_sessions: {
            data: {
              status: 'closed'
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: expenseId,
        restaurant_id: restaurant.id
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('No se puede eliminar gastos de una caja cerrada')
    })

    it('should return 404 for non-existent expense', async () => {
      const restaurant = createTestRestaurant()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_session_expenses: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: crypto.randomUUID(),
        restaurant_id: restaurant.id
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(404)
      expect(data.error).toBe('Gasto no encontrado')
    })
  })

  describe('Invalid input validation', () => {
    it('should reject delete with missing id', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID()
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject delete with missing restaurant_id', async () => {
      const requestBody = {
        id: crypto.randomUUID()
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject delete with invalid id', async () => {
      const requestBody = {
        id: 'not-a-uuid',
        restaurant_id: crypto.randomUUID()
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('GET /api/cash/expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('List expenses for session', () => {
    it('should return expenses for session with total', async () => {
      const sessionId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_session_expenses: {
            data: [
              {
                id: crypto.randomUUID(),
                amount: 15000,
                category: 'proveedor',
                description: 'Compra 1',
                created_at: new Date().toISOString(),
                created_by: 'user-1'
              },
              {
                id: crypto.randomUUID(),
                amount: 5000,
                category: 'propina',
                description: 'Propina',
                created_at: new Date().toISOString(),
                created_by: 'user-2'
              }
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
          url: `http://localhost:3000/api/cash/expenses?session_id=${sessionId}` 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.expenses).toBeDefined()
      expect(Array.isArray(data.expenses)).toBe(true)
      expect(data.total).toBeGreaterThanOrEqual(0)
    })

    it('should return empty array for session with no expenses', async () => {
      const sessionId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          cash_session_expenses: {
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
          url: `http://localhost:3000/api/cash/expenses?session_id=${sessionId}` 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.expenses).toEqual([])
      expect(data.total).toBe(0)
    })

    it('should return 400 when session_id is missing', async () => {
      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: 'http://localhost:3000/api/cash/expenses' 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('session_id requerido')
    })
  })
})
