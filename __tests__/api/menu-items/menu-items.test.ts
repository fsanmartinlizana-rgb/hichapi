// ══════════════════════════════════════════════════════════════════════════════
//  Menu Items API Tests — __tests__/api/menu-items/menu-items.test.ts
//
//  Tests for POST, PATCH, DELETE, and GET /api/menu-items endpoints
//  Requirements: 5.1, 5.2, 5.3, 5.4, 5.6
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, PATCH, DELETE, GET } from '@/app/api/menu-items/route'
import { createSupabaseMock, createPostgrestError } from '../../setup/supabase-mock'
import { 
  mockNextRequest, 
  extractResponse,
  createTestRestaurant,
  createTestMenuItem
} from '../../setup/test-helpers'

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn()
}))

// Mock the auth guard
vi.mock('@/lib/supabase/auth-guard', () => ({
  requireUser: vi.fn().mockResolvedValue({ error: null })
}))

// Import after mocking
import { createAdminClient } from '@/lib/supabase/server'

describe('POST /api/menu-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Create with all fields - Requirement 5.1', () => {
    it('should create menu item with all fields and return 201', async () => {
      const restaurant = createTestRestaurant()
      const menuItemId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          menu_items: {
            data: {
              id: menuItemId,
              restaurant_id: restaurant.id,
              name: 'Pizza Margherita',
              description: 'Classic tomato and mozzarella',
              price: 8900,
              category: 'Pizzas',
              tags: ['vegetarian', 'popular'],
              available: true,
              cost_price: 3500,
              photo_url: 'https://example.com/pizza.jpg',
              ingredients: [
                { stock_item_id: crypto.randomUUID(), qty: 0.3 }
              ]
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        name: 'Pizza Margherita',
        description: 'Classic tomato and mozzarella',
        price: 8900,
        category: 'Pizzas',
        tags: ['vegetarian', 'popular'],
        available: true,
        cost_price: 3500,
        photo_url: 'https://example.com/pizza.jpg',
        ingredients: [
          { stock_item_id: crypto.randomUUID(), qty: 0.3 }
        ]
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.item).toBeDefined()
      expect(data.item.id).toBe(menuItemId)
      expect(data.item.name).toBe('Pizza Margherita')
      expect(data.item.price).toBe(8900)
    })
  })

  describe('Create with minimal fields - Requirement 5.1', () => {
    it('should create menu item with only required fields', async () => {
      const restaurant = createTestRestaurant()
      const menuItemId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          menu_items: {
            data: {
              id: menuItemId,
              restaurant_id: restaurant.id,
              name: 'Simple Dish',
              price: 5000,
              category: 'Principal',
              tags: [],
              available: true
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurant.id,
        name: 'Simple Dish',
        price: 5000
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.item).toBeDefined()
      expect(data.item.name).toBe('Simple Dish')
      expect(data.item.price).toBe(5000)
      expect(data.item.category).toBe('Principal')
    })
  })

  describe('Invalid input validation', () => {
    it('should reject item with missing name', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        price: 5000
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject item with negative price', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        name: 'Test Item',
        price: -100
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
        price: 5000
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('PATCH /api/menu-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Update single field - Requirement 5.2', () => {
    it('should update only the price field', async () => {
      const menuItem = createTestMenuItem()

      const mockSupabase = createSupabaseMock({
        tables: {
          menu_items: {
            data: {
              ...menuItem,
              price: 9500
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: menuItem.id,
        restaurant_id: menuItem.restaurant_id,
        price: 9500
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.item).toBeDefined()
      expect(data.item.price).toBe(9500)
    })

    it('should update only the available field', async () => {
      const menuItem = createTestMenuItem({ available: true })

      const mockSupabase = createSupabaseMock({
        tables: {
          menu_items: {
            data: {
              ...menuItem,
              available: false
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: menuItem.id,
        restaurant_id: menuItem.restaurant_id,
        available: false
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.item).toBeDefined()
      expect(data.item.available).toBe(false)
    })
  })

  describe('Update with no changes - Requirement 5.4', () => {
    it('should reject update with no fields to change', async () => {
      const menuItem = createTestMenuItem()

      const requestBody = {
        id: menuItem.id,
        restaurant_id: menuItem.restaurant_id
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Sin cambios')
    })
  })

  describe('Invalid input validation', () => {
    it('should reject update with invalid id', async () => {
      const requestBody = {
        id: 'not-a-uuid',
        restaurant_id: crypto.randomUUID(),
        price: 5000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('DELETE /api/menu-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful deletion - Requirement 5.3', () => {
    it('should delete menu item and return ok: true', async () => {
      const menuItem = createTestMenuItem()

      const mockSupabase = createSupabaseMock({
        tables: {
          menu_items: {
            data: null,
            error: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        id: menuItem.id,
        restaurant_id: menuItem.restaurant_id
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
    })
  })

  describe('Invalid input validation', () => {
    it('should reject deletion with invalid id', async () => {
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

    it('should reject deletion with missing restaurant_id', async () => {
      const requestBody = {
        id: crypto.randomUUID()
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DELETE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('GET /api/menu-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Returns items ordered by category - Requirement 5.6', () => {
    it('should return items ordered by category and name', async () => {
      const restaurant = createTestRestaurant()
      const items = [
        createTestMenuItem({ 
          restaurant_id: restaurant.id, 
          name: 'Burger', 
          category: 'Principal' 
        }),
        createTestMenuItem({ 
          restaurant_id: restaurant.id, 
          name: 'Salad', 
          category: 'Entrada' 
        }),
        createTestMenuItem({ 
          restaurant_id: restaurant.id, 
          name: 'Pizza', 
          category: 'Principal' 
        })
      ]

      const mockSupabase = createSupabaseMock({
        tables: {
          menu_items: {
            data: items
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/menu-items?restaurant_id=${restaurant.id}` 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.items).toBeDefined()
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBe(3)
    })

    it('should return empty array for restaurant with no items', async () => {
      const restaurant = createTestRestaurant()

      const mockSupabase = createSupabaseMock({
        tables: {
          menu_items: {
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
          url: `http://localhost:3000/api/menu-items?restaurant_id=${restaurant.id}` 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.items).toEqual([])
    })

    it('should return 400 when restaurant_id is missing', async () => {
      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: 'http://localhost:3000/api/menu-items' 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('restaurant_id requerido')
    })
  })
})
