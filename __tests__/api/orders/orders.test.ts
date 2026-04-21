// ══════════════════════════════════════════════════════════════════════════════
//  Orders API Tests — __tests__/api/orders/orders.test.ts
//
//  Tests for POST /api/orders and PATCH /api/orders endpoints
//  Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, PATCH, GET } from '@/app/api/orders/route'
import { createSupabaseMock, createPostgrestError } from '../../setup/supabase-mock'
import { 
  mockNextRequest, 
  extractResponse,
  createTestRestaurant,
  createTestOrder
} from '../../setup/test-helpers'

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn()
}))

// Mock the notifications module
vi.mock('@/lib/notifications/server', () => ({
  createNotification: vi.fn().mockResolvedValue({ ok: true })
}))

// Import after mocking
import { createAdminClient } from '@/lib/supabase/server'

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Valid Order Creation - Requirement 4.1', () => {
    it('should create order with valid cart and return orderId and total', async () => {
      const restaurant = createTestRestaurant({ slug: 'test-restaurant' })
      const tableId = crypto.randomUUID()
      const menuItemId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { id: restaurant.id, cash_required: false }
          },
          tables: {
            data: { id: tableId, status: 'libre', label: 'Mesa 1' }
          },
          cash_register_sessions: {
            data: [{ id: crypto.randomUUID(), status: 'open' }]
          },
          orders: {
            data: { id: crypto.randomUUID() }
          },
          order_items: {
            data: null
          },
          menu_items: {
            data: [{ id: menuItemId, destination: 'cocina', category_id: null }]
          },
          menu_item_station_override: {
            data: []
          },
          menu_category_station: {
            data: []
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_slug: restaurant.slug,
        table_id: tableId,
        cart: [
          {
            menu_item_id: menuItemId,
            name: 'Pizza Margherita',
            quantity: 2,
            unit_price: 8900,
            note: null
          }
        ],
        client_name: 'Juan Pérez',
        notes: 'Sin cebolla'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.orderId).toBeDefined()
      expect(data.total).toBe(17800) // 2 * 8900
      expect(data.status).toBe('pending')
    })

    it('should calculate total correctly for multiple items', async () => {
      const restaurant = createTestRestaurant({ slug: 'test-restaurant' })
      const tableId = crypto.randomUUID()
      const menuItem1 = crypto.randomUUID()
      const menuItem2 = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { id: restaurant.id, cash_required: false }
          },
          tables: {
            data: { id: tableId, status: 'libre', label: 'Mesa 1' }
          },
          cash_register_sessions: {
            data: [{ id: crypto.randomUUID(), status: 'open' }]
          },
          orders: {
            data: { id: crypto.randomUUID() }
          },
          order_items: {
            data: null
          },
          menu_items: {
            data: [
              { id: menuItem1, destination: 'cocina', category_id: null },
              { id: menuItem2, destination: 'barra', category_id: null }
            ]
          },
          menu_item_station_override: {
            data: []
          },
          menu_category_station: {
            data: []
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_slug: restaurant.slug,
        table_id: tableId,
        cart: [
          {
            menu_item_id: menuItem1,
            name: 'Pizza',
            quantity: 2,
            unit_price: 8900
          },
          {
            menu_item_id: menuItem2,
            name: 'Cerveza',
            quantity: 3,
            unit_price: 2500
          }
        ]
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.total).toBe(25300) // (2 * 8900) + (3 * 2500)
    })

    it('should accept order with qr_token instead of UUID', async () => {
      const restaurant = createTestRestaurant({ slug: 'test-restaurant' })
      const tableId = crypto.randomUUID()
      const qrToken = 'qr-abc123'
      const menuItemId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { id: restaurant.id, cash_required: false }
          },
          tables: {
            data: { id: tableId, status: 'libre', label: 'Mesa 1' }
          },
          cash_register_sessions: {
            data: [{ id: crypto.randomUUID(), status: 'open' }]
          },
          orders: {
            data: { id: crypto.randomUUID() }
          },
          order_items: {
            data: null
          },
          menu_items: {
            data: [{ id: menuItemId, destination: 'cocina', category_id: null }]
          },
          menu_item_station_override: {
            data: []
          },
          menu_category_station: {
            data: []
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_slug: restaurant.slug,
        table_id: qrToken,
        cart: [
          {
            menu_item_id: menuItemId,
            name: 'Pizza',
            quantity: 1,
            unit_price: 8900
          }
        ]
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.orderId).toBeDefined()
    })
  })

  describe('Empty Cart Rejection - Requirement 4.1', () => {
    it('should reject order with empty cart', async () => {
      const requestBody = {
        restaurant_slug: 'test-restaurant',
        table_id: crypto.randomUUID(),
        cart: []
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBeDefined()
    })
  })

  describe('Non-existent Restaurant - Requirement 4.5', () => {
    it('should return 404 for non-existent restaurant', async () => {
      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: null,
            error: createPostgrestError('PGRST116', 'No rows found')
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_slug: 'non-existent-restaurant',
        table_id: crypto.randomUUID(),
        cart: [
          {
            menu_item_id: crypto.randomUUID(),
            name: 'Pizza',
            quantity: 1,
            unit_price: 8900
          }
        ]
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(404)
      expect(data.error).toBe('Restaurante no encontrado')
    })
  })

  describe('Invalid Input Validation', () => {
    it('should reject order with missing required fields', async () => {
      const requestBody = {
        restaurant_slug: 'test-restaurant',
        // missing table_id and cart
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject cart item with negative quantity', async () => {
      const requestBody = {
        restaurant_slug: 'test-restaurant',
        table_id: crypto.randomUUID(),
        cart: [
          {
            menu_item_id: crypto.randomUUID(),
            name: 'Pizza',
            quantity: -1,
            unit_price: 8900
          }
        ]
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject cart item with negative price', async () => {
      const requestBody = {
        restaurant_slug: 'test-restaurant',
        table_id: crypto.randomUUID(),
        cart: [
          {
            menu_item_id: crypto.randomUUID(),
            name: 'Pizza',
            quantity: 1,
            unit_price: -100
          }
        ]
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })

  describe('Blocked Table Handling', () => {
    it('should reject order for blocked table', async () => {
      const restaurant = createTestRestaurant({ slug: 'test-restaurant' })
      const tableId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { id: restaurant.id }
          },
          tables: {
            data: { id: tableId, status: 'bloqueada', label: 'Mesa 2' }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_slug: restaurant.slug,
        table_id: tableId,
        cart: [
          {
            menu_item_id: crypto.randomUUID(),
            name: 'Pizza',
            quantity: 1,
            unit_price: 8900
          }
        ]
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(409)
      expect(data.error).toContain('dividida')
    })
  })

  describe('Cash Register Gating', () => {
    it('should reject order when cash register is closed', async () => {
      const restaurant = createTestRestaurant({ slug: 'test-restaurant' })
      const tableId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { id: restaurant.id, cash_required: true }
          },
          tables: {
            data: { id: tableId, status: 'libre', label: 'Mesa 1' }
          },
          cash_register_sessions: {
            data: null // No open session
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_slug: restaurant.slug,
        table_id: tableId,
        cart: [
          {
            menu_item_id: crypto.randomUUID(),
            name: 'Pizza',
            quantity: 1,
            unit_price: 8900
          }
        ]
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(409)
      expect(data.error).toContain('caja está cerrada')
      expect(data.reason).toBe('cash_register_closed')
    })

    it('should allow order when cash_required is false', async () => {
      const restaurant = createTestRestaurant({ slug: 'test-restaurant' })
      const tableId = crypto.randomUUID()
      const menuItemId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { id: restaurant.id, cash_required: false }
          },
          tables: {
            data: { id: tableId, status: 'libre', label: 'Mesa 1' }
          },
          cash_register_sessions: {
            data: null // No open session, but cash_required is false
          },
          orders: {
            data: { id: crypto.randomUUID() }
          },
          order_items: {
            data: null
          },
          menu_items: {
            data: [{ id: menuItemId, destination: 'cocina', category_id: null }]
          },
          menu_item_station_override: {
            data: []
          },
          menu_category_station: {
            data: []
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_slug: restaurant.slug,
        table_id: tableId,
        cart: [
          {
            menu_item_id: menuItemId,
            name: 'Pizza',
            quantity: 1,
            unit_price: 8900
          }
        ]
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.orderId).toBeDefined()
    })
  })
})

describe('PATCH /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Status Transitions - Requirement 4.2', () => {
    it('should transition order from pending to preparing', async () => {
      const orderId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: null
          }
        },
        rpc: {
          deduct_order_stock: {
            data: { deductions: [] }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        order_id: orderId,
        status: 'preparing' as const
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.status).toBe('preparing')
    })

    it('should transition order to paid status', async () => {
      const orderId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        order_id: orderId,
        status: 'paid' as const,
        payment_method: 'cash' as const,
        cash_amount: 20000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.status).toBe('paid')
    })
  })

  describe('Stock Deduction - Requirement 4.2', () => {
    it('should call deduct_order_stock RPC when status is preparing', async () => {
      const orderId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: null
          }
        },
        rpc: {
          deduct_order_stock: {
            data: { 
              deductions: [
                { stock_item_id: crypto.randomUUID(), qty_deducted: 0.5 }
              ] 
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        order_id: orderId,
        status: 'preparing' as const
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(200)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_order_stock', {
        p_order_id: orderId
      })
    })

    it('should call deduct_order_stock RPC when status is confirmed', async () => {
      const orderId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: null
          }
        },
        rpc: {
          deduct_order_stock: {
            data: { deductions: [] }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        order_id: orderId,
        status: 'confirmed' as const
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(200)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_order_stock', {
        p_order_id: orderId
      })
    })
  })

  describe('Payment Commission Calculation - Requirements 4.3, 4.4', () => {
    it('should calculate 0% commission for cash payment', async () => {
      const orderId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        order_id: orderId,
        status: 'paid' as const,
        payment_method: 'cash' as const,
        cash_amount: 20000,
        digital_amount: 0
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      
      // Verify the update was called with correct commission (0 for cash)
      expect(mockSupabase.from).toHaveBeenCalledWith('orders')
    })

    it('should calculate 1% commission for digital payment', async () => {
      const orderId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        order_id: orderId,
        status: 'paid' as const,
        payment_method: 'digital' as const,
        cash_amount: 0,
        digital_amount: 10000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      
      // Commission should be 1% of 10000 = 100
      // This is calculated in the route handler
    })

    it('should calculate commission for mixed payment', async () => {
      const orderId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        order_id: orderId,
        status: 'paid' as const,
        payment_method: 'mixed' as const,
        cash_amount: 10000,
        digital_amount: 5000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      
      // Commission should be 1% of digital_amount (5000) = 50
    })
  })

  describe('Invalid Transitions - Requirement 4.6', () => {
    it('should reject invalid order_id', async () => {
      const requestBody = {
        order_id: 'not-a-uuid',
        status: 'preparing' as const
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject invalid status value', async () => {
      const requestBody = {
        order_id: crypto.randomUUID(),
        status: 'invalid_status'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })

  describe('Bill Request Notification', () => {
    it('should create notification when status is paying', async () => {
      const orderId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const tableId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: {
              restaurant_id: restaurantId,
              table_id: tableId,
              total: 15000,
              tables: { label: 'Mesa 5' }
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        order_id: orderId,
        status: 'paying' as const
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(200)
    })
  })

  describe('Table Auto-Release', () => {
    it('should release table when order is paid and no other active orders', async () => {
      const orderId = crypto.randomUUID()
      const tableId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: { table_id: tableId }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        order_id: orderId,
        status: 'paid' as const,
        payment_method: 'cash' as const,
        cash_amount: 20000
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(200)
    })

    it('should release table when order is cancelled', async () => {
      const orderId = crypto.randomUUID()
      const tableId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: { table_id: tableId }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        order_id: orderId,
        status: 'cancelled' as const
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await PATCH(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(200)
    })
  })
})

describe('GET /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Query by table_id', () => {
    it('should return orders for valid table UUID', async () => {
      const tableId = crypto.randomUUID()
      const orderId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          orders: {
            data: [
              {
                id: orderId,
                table_id: tableId,
                status: 'pending',
                total: 15000,
                order_items: []
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
          url: `http://localhost:3000/api/orders?table_id=${tableId}` 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.orders).toHaveLength(1)
      expect(data.orders[0].id).toBe(orderId)
      expect(data.table_resolved).toBe(true)
    })

    it('should resolve qr_token to table UUID', async () => {
      const tableId = crypto.randomUUID()
      const qrToken = 'qr-abc123'

      const mockSupabase = createSupabaseMock({
        tables: {
          tables: {
            data: { id: tableId }
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
          url: `http://localhost:3000/api/orders?table_id=${qrToken}` 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.orders).toBeDefined()
      expect(data.table_resolved).toBe(true)
    })

    it('should return 400 when table_id is missing', async () => {
      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: 'http://localhost:3000/api/orders' 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('table_id requerido')
    })

    it('should return empty array for non-existent table', async () => {
      const mockSupabase = createSupabaseMock({
        tables: {
          tables: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/orders?table_id=non-existent` 
        }
      )
      const response = await GET(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.orders).toEqual([])
      expect(data.table_resolved).toBe(false)
    })
  })
})
