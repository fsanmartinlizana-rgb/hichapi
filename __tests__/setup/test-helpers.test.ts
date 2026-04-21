// ══════════════════════════════════════════════════════════════════════════════
//  Test Helpers Unit Tests — __tests__/setup/test-helpers.test.ts
//
//  Validates that factory functions and utilities work correctly.
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  createTestUser,
  createTestRestaurant,
  createTestMenuItem,
  createTestOrder,
  createTestStockItem,
  mockNextRequest,
  extractJsonResponse,
  extractResponse
} from './test-helpers'
import { NextResponse } from 'next/server'

describe('Test Helpers - Factory Functions', () => {
  describe('createTestUser', () => {
    it('creates a user with default values', () => {
      const user = createTestUser()
      
      expect(user.id).toBeDefined()
      expect(user.email).toContain('@test.com')
      expect(user.created_at).toBeDefined()
      expect(user.aud).toBe('authenticated')
    })

    it('allows overriding default values', () => {
      const user = createTestUser({
        email: 'chef@restaurant.com',
        role: 'admin'
      })
      
      expect(user.email).toBe('chef@restaurant.com')
      expect(user.role).toBe('admin')
    })

    it('generates unique IDs for different users', () => {
      const user1 = createTestUser()
      const user2 = createTestUser()
      
      expect(user1.id).not.toBe(user2.id)
      expect(user1.email).not.toBe(user2.email)
    })
  })

  describe('createTestRestaurant', () => {
    it('creates a restaurant with default values', () => {
      const restaurant = createTestRestaurant()
      
      expect(restaurant.id).toBeDefined()
      expect(restaurant.name).toBeDefined()
      expect(restaurant.slug).toBeDefined()
      expect(restaurant.plan).toBe('free')
      expect(restaurant.active).toBe(true)
      expect(restaurant.rating).toBe(4.0)
    })

    it('allows overriding default values', () => {
      const restaurant = createTestRestaurant({
        name: 'Pizza Palace',
        slug: 'pizza-palace',
        plan: 'pro',
        price_range: 'premium'
      })
      
      expect(restaurant.name).toBe('Pizza Palace')
      expect(restaurant.slug).toBe('pizza-palace')
      expect(restaurant.plan).toBe('pro')
      expect(restaurant.price_range).toBe('premium')
    })

    it('generates slug from name if not provided', () => {
      const restaurant = createTestRestaurant({ name: 'My Great Restaurant' })
      
      expect(restaurant.slug).toBe('my-great-restaurant')
    })
  })

  describe('createTestMenuItem', () => {
    it('creates a menu item with default values', () => {
      const item = createTestMenuItem()
      
      expect(item.id).toBeDefined()
      expect(item.restaurant_id).toBeDefined()
      expect(item.name).toBeDefined()
      expect(item.price).toBe(5000)
      expect(item.category).toBe('Principal')
      expect(item.available).toBe(true)
      expect(item.tags).toEqual([])
    })

    it('allows overriding default values', () => {
      const restaurantId = crypto.randomUUID()
      const item = createTestMenuItem({
        restaurant_id: restaurantId,
        name: 'Margherita Pizza',
        price: 8900,
        category: 'Pizzas',
        tags: ['vegetarian', 'popular']
      })
      
      expect(item.restaurant_id).toBe(restaurantId)
      expect(item.name).toBe('Margherita Pizza')
      expect(item.price).toBe(8900)
      expect(item.category).toBe('Pizzas')
      expect(item.tags).toEqual(['vegetarian', 'popular'])
    })

    it('supports ingredients configuration', () => {
      const item = createTestMenuItem({
        ingredients: [
          { stock_item_id: crypto.randomUUID(), qty: 0.2 },
          { stock_item_id: crypto.randomUUID(), qty: 0.1 }
        ]
      })
      
      expect(item.ingredients).toHaveLength(2)
      expect(item.ingredients![0].qty).toBe(0.2)
    })
  })

  describe('createTestOrder', () => {
    it('creates an order with default values', () => {
      const order = createTestOrder()
      
      expect(order.id).toBeDefined()
      expect(order.restaurant_id).toBeDefined()
      expect(order.table_id).toBeDefined()
      expect(order.status).toBe('pending')
      expect(order.total).toBeGreaterThan(0)
      expect(order.items).toBeDefined()
      expect(order.items!.length).toBeGreaterThan(0)
    })

    it('calculates total from items if not provided', () => {
      const order = createTestOrder({
        items: [
          {
            id: crypto.randomUUID(),
            order_id: 'order-1',
            name: 'Pizza',
            quantity: 2,
            unit_price: 5000,
            status: 'pending'
          },
          {
            id: crypto.randomUUID(),
            order_id: 'order-1',
            name: 'Soda',
            quantity: 1,
            unit_price: 1500,
            status: 'pending'
          }
        ]
      })
      
      expect(order.total).toBe(11500) // 2*5000 + 1*1500
    })

    it('allows explicit total override', () => {
      const order = createTestOrder({
        total: 20000,
        items: [
          {
            id: crypto.randomUUID(),
            order_id: 'order-1',
            name: 'Pizza',
            quantity: 1,
            unit_price: 5000,
            status: 'pending'
          }
        ]
      })
      
      expect(order.total).toBe(20000)
    })

    it('supports null table_id for delivery orders', () => {
      const order = createTestOrder({ table_id: null })
      
      expect(order.table_id).toBeNull()
    })

    it('allows different order statuses', () => {
      const order = createTestOrder({ status: 'paid' })
      
      expect(order.status).toBe('paid')
    })
  })

  describe('createTestStockItem', () => {
    it('creates a stock item with default values', () => {
      const item = createTestStockItem()
      
      expect(item.id).toBeDefined()
      expect(item.restaurant_id).toBeDefined()
      expect(item.name).toBeDefined()
      expect(item.unit).toBe('kg')
      expect(item.current_qty).toBe(100)
      expect(item.min_qty).toBe(10)
      expect(item.cost_per_unit).toBe(1000)
      expect(item.active).toBe(true)
    })

    it('allows overriding default values', () => {
      const restaurantId = crypto.randomUUID()
      const item = createTestStockItem({
        restaurant_id: restaurantId,
        name: 'Tomatoes',
        unit: 'kg',
        current_qty: 50,
        min_qty: 5,
        cost_per_unit: 2500,
        supplier: 'Fresh Produce Co.'
      })
      
      expect(item.restaurant_id).toBe(restaurantId)
      expect(item.name).toBe('Tomatoes')
      expect(item.current_qty).toBe(50)
      expect(item.supplier).toBe('Fresh Produce Co.')
    })

    it('supports different units', () => {
      const units: Array<'kg' | 'g' | 'l' | 'ml' | 'unidad' | 'porcion' | 'caja'> = 
        ['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja']
      
      units.forEach(unit => {
        const item = createTestStockItem({ unit })
        expect(item.unit).toBe(unit)
      })
    })
  })
})

describe('Test Helpers - Next.js Utilities', () => {
  describe('mockNextRequest', () => {
    it('creates a POST request with JSON body', () => {
      const body = { name: 'Pizza', price: 8900 }
      const request = mockNextRequest(body)
      
      expect(request.method).toBe('POST')
      expect(request.headers.get('Content-Type')).toBe('application/json')
    })

    it('allows custom headers', () => {
      const request = mockNextRequest(
        { test: 'data' },
        { 'Authorization': 'Bearer token123' }
      )
      
      expect(request.headers.get('Authorization')).toBe('Bearer token123')
    })

    it('allows custom method and URL', () => {
      const request = mockNextRequest(
        null,
        {},
        { method: 'GET', url: 'http://localhost:3000/api/menu-items' }
      )
      
      expect(request.method).toBe('GET')
      expect(request.url).toBe('http://localhost:3000/api/menu-items')
    })

    it('supports PATCH requests', async () => {
      const body = { status: 'paid' }
      const request = mockNextRequest(body, {}, { method: 'PATCH' })
      
      expect(request.method).toBe('PATCH')
      const requestBody = await request.json()
      expect(requestBody).toEqual(body)
    })
  })

  describe('extractJsonResponse', () => {
    it('extracts JSON from NextResponse', async () => {
      const data = { ok: true, id: '123' }
      const response = NextResponse.json(data)
      
      const extracted = await extractJsonResponse(response)
      
      expect(extracted).toEqual(data)
    })

    it('returns null for empty response', async () => {
      const response = new NextResponse('', { status: 200 })
      
      const extracted = await extractJsonResponse(response)
      
      expect(extracted).toBeNull()
    })

    it('throws error for invalid JSON', async () => {
      const response = new NextResponse('not json', { status: 200 })
      
      await expect(extractJsonResponse(response)).rejects.toThrow('Failed to parse response as JSON')
    })
  })

  describe('extractResponse', () => {
    it('extracts both status and data', async () => {
      const data = { ok: true, message: 'Success' }
      const response = NextResponse.json(data, { status: 201 })
      
      const { status, data: extracted } = await extractResponse(response)
      
      expect(status).toBe(201)
      expect(extracted).toEqual(data)
    })

    it('handles error responses', async () => {
      const errorData = { error: 'Not found' }
      const response = NextResponse.json(errorData, { status: 404 })
      
      const { status, data } = await extractResponse(response)
      
      expect(status).toBe(404)
      expect(data.error).toBe('Not found')
    })
  })
})
