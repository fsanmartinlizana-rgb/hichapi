// ══════════════════════════════════════════════════════════════════════════════
//  Stock API Tests — __tests__/api/stock/stock.test.ts
//
//  Tests for POST /api/stock and DELETE /api/stock endpoints
//  Requirements: 6.1, 6.6
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
import { POST, DELETE, GET } from '@/app/api/stock/route'
import { createClient } from '@supabase/supabase-js'

describe('POST /api/stock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Create stock item - Requirement 6.1', () => {
    it('should create stock item with valid data', async () => {
      const restaurant = createTestRestaurant()
      const stockItemId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              id: stockItemId,
              restaurant_id: restaurant.id,
              name: 'Tomatoes',
              unit: 'kg',
              current_qty: 50,
              min_qty: 10,
              cost_per_unit: 1500,
              supplier: 'Fresh Produce Co',
              category: 'Vegetables',
              active: true
            }
          },
          stock_movements: {
            data: null
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        name: 'Tomatoes',
        unit: 'kg',
        current_qty: 50,
        min_qty: 10,
        cost_per_unit: 1500,
        supplier: 'Fresh Produce Co',
        category: 'Vegetables'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.item).toBeDefined()
      expect(data.item.id).toBe(stockItemId)
      expect(data.item.name).toBe('Tomatoes')
      expect(data.item.current_qty).toBe(50)
    })

    it('should create stock item with minimal required fields', async () => {
      const restaurant = createTestRestaurant()
      const stockItemId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              id: stockItemId,
              restaurant_id: restaurant.id,
              name: 'Salt',
              unit: 'kg',
              current_qty: 10,
              min_qty: 0,
              cost_per_unit: 500,
              active: true
            }
          },
          stock_movements: {
            data: null
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        name: 'Salt',
        unit: 'kg',
        current_qty: 10,
        cost_per_unit: 500
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.item).toBeDefined()
      expect(data.item.name).toBe('Salt')
    })

    it('should create initial stock movement when current_qty > 0', async () => {
      const restaurant = createTestRestaurant()
      const stockItemId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: {
              id: stockItemId,
              restaurant_id: restaurant.id,
              name: 'Flour',
              unit: 'kg',
              current_qty: 100,
              cost_per_unit: 800,
              active: true
            }
          },
          stock_movements: {
            data: null
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        name: 'Flour',
        unit: 'kg',
        current_qty: 100,
        cost_per_unit: 800
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(200)
      // Verify stock_movements insert was called
      expect(mockSupabase.from).toHaveBeenCalledWith('stock_movements')
    })
  })

  describe('Invalid input validation', () => {
    it('should reject item with missing name', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        unit: 'kg',
        current_qty: 10,
        cost_per_unit: 500
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject item with negative current_qty', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        name: 'Test Item',
        unit: 'kg',
        current_qty: -10,
        cost_per_unit: 500
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject item with negative cost_per_unit', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        name: 'Test Item',
        unit: 'kg',
        current_qty: 10,
        cost_per_unit: -500
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject item with invalid unit', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        name: 'Test Item',
        unit: 'invalid_unit',
        current_qty: 10,
        cost_per_unit: 500
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject item with invalid restaurant_id', async () => {
      const requestBody = {
        restaurant_id: 'not-a-uuid',
        name: 'Test Item',
        unit: 'kg',
        current_qty: 10,
        cost_per_unit: 500
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('DELETE /api/stock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Soft delete - Requirement 6.6', () => {
    it('should soft delete item with recent movements', async () => {
      const stockItemId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_movements: {
            data: null,
            count: 5 // Has recent movements
          },
          stock_items: {
            data: null
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'DELETE', 
          url: `http://localhost:3000/api/stock?id=${stockItemId}` 
        }
      )
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.action).toBe('deactivated')
    })

    it('should hard delete item without recent movements', async () => {
      const stockItemId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_movements: {
            data: null,
            count: 0 // No recent movements
          },
          stock_items: {
            data: null
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'DELETE', 
          url: `http://localhost:3000/api/stock?id=${stockItemId}` 
        }
      )
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.action).toBe('deleted')
    })

    it('should return 400 when id is missing', async () => {
      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'DELETE', 
          url: 'http://localhost:3000/api/stock' 
        }
      )
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('id requerido')
    })
  })
})

describe('GET /api/stock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('List stock items', () => {
    it('should return stock items grouped by category', async () => {
      const restaurant = createTestRestaurant()
      const items = [
        createTestStockItem({ 
          restaurant_id: restaurant.id, 
          name: 'Tomatoes', 
          category: 'Vegetables',
          current_qty: 50,
          cost_per_unit: 1500
        }),
        createTestStockItem({ 
          restaurant_id: restaurant.id, 
          name: 'Chicken', 
          category: 'Meat',
          current_qty: 20,
          cost_per_unit: 5000
        })
      ]

      const mockSupabase = createSupabaseMock({
        tables: {
          stock_items: {
            data: items
          }
        }
      })

      vi.mocked(createClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/stock?restaurant_id=${restaurant.id}` 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.categories).toBeDefined()
      expect(data.total_inventory_value).toBeDefined()
      expect(data.below_minimum).toBeDefined()
    })

    it('should return 400 when restaurant_id is missing', async () => {
      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: 'http://localhost:3000/api/stock' 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('restaurant_id requerido')
    })
  })
})
