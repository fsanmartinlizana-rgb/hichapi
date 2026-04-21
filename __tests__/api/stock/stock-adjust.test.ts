// ══════════════════════════════════════════════════════════════════════════════
//  Stock Adjust API Tests — __tests__/api/stock/stock-adjust.test.ts
//
//  Tests for PATCH /api/stock (adjustments) and POST /api/mermas endpoints
//  Requirements: 6.2, 6.3, 6.5
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock, createPostgrestError } from '../../setup/supabase-mock'
import { 
  mockNextRequest, 
  extractResponse,
  createTestRestaurant,
  createTestStockItem
} from '../../setup/test-helpers'

// Mock the Supabase client module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

// Mock the auth guard
vi.mock('@/lib/supabase/auth-guard', () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: 'test-user' }, error: null })
}))

// Import after mocking
import { PATCH } from '@/app/api/stock/route'
import { POST as POST_MERMA, GET as GET_MERMA } from '@/app/api/mermas/route'
import { createClient } from '@supabase/supabase-js'

describe('PATCH /api/stock - Stock Adjustments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Positive delta increases quantity - Requirement 6.2', () => {
    it('should increase current_qty with positive delta', async () => {
      const stockItem = createTestStockItem({ current_qty: 50 })

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              ...stockItem,
              current_qty: 75 // 50 + 25
            }
          },
          stock_movements: {
            data: null
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: stockItem.id,
        current_qty: 75
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.item).toBeDefined()
      expect(data.item.current_qty).toBe(75)
    })

    it('should record ajuste_manual movement for positive delta', async () => {
      const stockItem = createTestStockItem({ current_qty: 100 })

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              ...stockItem,
              current_qty: 150
            }
          },
          stock_movements: {
            data: null
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: stockItem.id,
        current_qty: 150
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(200)
    })
  })

  describe('Negative delta decreases quantity - Requirement 6.3', () => {
    it('should decrease current_qty with negative delta', async () => {
      const stockItem = createTestStockItem({ current_qty: 100 })

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              ...stockItem,
              current_qty: 75 // 100 - 25
            }
          },
          stock_movements: {
            data: null
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: stockItem.id,
        current_qty: 75
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.item).toBeDefined()
      expect(data.item.current_qty).toBe(75)
    })

    it('should record ajuste_manual movement for negative delta', async () => {
      const stockItem = createTestStockItem({ current_qty: 50 })

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              ...stockItem,
              current_qty: 30
            }
          },
          stock_movements: {
            data: null
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: stockItem.id,
        current_qty: 30
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(200)
    })
  })

  describe('Update other fields without affecting quantity', () => {
    it('should update name without creating movement', async () => {
      const stockItem = createTestStockItem({ name: 'Old Name', current_qty: 50 })

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              ...stockItem,
              name: 'New Name',
              current_qty: 50
            }
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: stockItem.id,
        name: 'New Name'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.item.name).toBe('New Name')
    })

    it('should update cost_per_unit without creating movement', async () => {
      const stockItem = createTestStockItem({ cost_per_unit: 1000, current_qty: 50 })

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              ...stockItem,
              cost_per_unit: 1500,
              current_qty: 50
            }
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: stockItem.id,
        cost_per_unit: 1500
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.item.cost_per_unit).toBe(1500)
    })
  })

  describe('Invalid input validation', () => {
    it('should return 400 when id is missing', async () => {
      const requestBody = {
        current_qty: 50
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('id requerido')
    })

    it('should return 404 when item does not exist', async () => {
      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: null
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: crypto.randomUUID(),
        current_qty: 50
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(404)
      expect(data.error).toBe('Item no encontrado')
    })
  })
})

describe('POST /api/mermas - Waste Records', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Create waste record with cost calculation - Requirement 6.5', () => {
    it('should create merma with cost calculation', async () => {
      const restaurant = createTestRestaurant()
      const stockItem = createTestStockItem({ 
        restaurant_id: restaurant.id,
        cost_per_unit: 2000,
        active: true
      })
      const mermaId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              id: stockItem.id,
              cost_per_unit: 2000,
              active: true
            }
          },
          waste_log: {
            data: {
              id: mermaId,
              restaurant_id: restaurant.id,
              stock_item_id: stockItem.id,
              qty_lost: 5,
              reason: 'vencimiento',
              cost_lost: 10000, // 5 * 2000
              logged_at: new Date().toISOString()
            }
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        stock_item_id: stockItem.id,
        qty_lost: 5,
        reason: 'vencimiento',
        notes: 'Expired product'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST_MERMA(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.merma).toBeDefined()
      expect(data.merma.qty_lost).toBe(5)
      expect(data.merma.cost_lost).toBe(10000)
    })

    it('should create merma with different waste reasons', async () => {
      const restaurant = createTestRestaurant()
      const stockItem = createTestStockItem({ 
        restaurant_id: restaurant.id,
        cost_per_unit: 1500,
        active: true
      })

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              id: stockItem.id,
              cost_per_unit: 1500,
              active: true
            }
          },
          waste_log: {
            data: {
              id: crypto.randomUUID(),
              restaurant_id: restaurant.id,
              stock_item_id: stockItem.id,
              qty_lost: 3,
              reason: 'rotura',
              cost_lost: 4500
            }
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        stock_item_id: stockItem.id,
        qty_lost: 3,
        reason: 'rotura'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST_MERMA(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
    })
  })

  describe('Invalid input validation', () => {
    it('should reject merma with missing required fields', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        qty_lost: 5
        // missing stock_item_id and reason
      }

      const request = mockNextRequest(requestBody)
      const response = await POST_MERMA(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject merma with negative qty_lost', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        stock_item_id: crypto.randomUUID(),
        qty_lost: -5,
        reason: 'vencimiento'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST_MERMA(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject merma with invalid reason', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        stock_item_id: crypto.randomUUID(),
        qty_lost: 5,
        reason: 'invalid_reason'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST_MERMA(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should return 404 for non-existent stock item', async () => {
      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: null,
            error: createPostgrestError('PGRST116', 'No rows found')
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        stock_item_id: crypto.randomUUID(),
        qty_lost: 5,
        reason: 'vencimiento'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST_MERMA(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(404)
      expect(data.error).toBe('Producto no encontrado')
    })

    it('should reject merma for inactive stock item', async () => {
      const restaurant = createTestRestaurant()
      const stockItem = createTestStockItem({ 
        restaurant_id: restaurant.id,
        active: false
      })

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              id: stockItem.id,
              cost_per_unit: 1000,
              active: false
            }
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        stock_item_id: stockItem.id,
        qty_lost: 5,
        reason: 'vencimiento'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST_MERMA(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('El producto está inactivo')
    })
  })
})

describe('GET /api/mermas - List Waste Records', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('List mermas with summary', () => {
    it('should return waste records with summary', async () => {
      const restaurant = createTestRestaurant()

      const mockSupabase = createSupabaseMock({
        tables: {
          waste_log: {
            data: [
              {
                id: crypto.randomUUID(),
                stock_item_id: crypto.randomUUID(),
                qty_lost: 5,
                reason: 'vencimiento',
                cost_lost: 10000,
                logged_at: new Date().toISOString(),
                stock_items: { name: 'Tomatoes', unit: 'kg' }
              },
              {
                id: crypto.randomUUID(),
                stock_item_id: crypto.randomUUID(),
                qty_lost: 2,
                reason: 'rotura',
                cost_lost: 4000,
                logged_at: new Date().toISOString(),
                stock_items: { name: 'Flour', unit: 'kg' }
              }
            ]
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/mermas?restaurant_id=${restaurant.id}` 
        }
      )
      const response = await GET_MERMA(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.entries).toBeDefined()
      expect(data.summary).toBeDefined()
      expect(data.summary.total_cost).toBeGreaterThanOrEqual(0)
    })

    it('should return 400 when restaurant_id is missing', async () => {
      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: 'http://localhost:3000/api/mermas' 
        }
      )
      const response = await GET_MERMA(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('restaurant_id requerido')
    })
  })
})
