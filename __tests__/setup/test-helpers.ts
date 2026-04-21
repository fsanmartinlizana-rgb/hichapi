// ══════════════════════════════════════════════════════════════════════════════
//  Test Helpers and Utilities — __tests__/setup/test-helpers.ts
//
//  Provides factory functions for creating test data and utilities for working
//  with Next.js request/response objects in tests.
//
//  Requirements: 1.1
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TestUser extends User {
  id: string
  email: string
  created_at: string
  app_metadata: Record<string, any>
  user_metadata: Record<string, any>
  aud: string
  role?: string
}

export interface TestRestaurant {
  id: string
  name: string
  slug: string
  address?: string
  neighborhood?: string
  lat?: number
  lng?: number
  photo_url?: string
  cuisine_type?: string
  price_range?: 'economico' | 'medio' | 'premium'
  rating?: number
  review_count?: number
  active?: boolean
  plan?: 'free' | 'starter' | 'pro' | 'enterprise'
  created_at?: string
}

export interface TestMenuItem {
  id: string
  restaurant_id: string
  name: string
  description?: string
  price: number
  category?: string
  tags?: string[]
  photo_url?: string
  available?: boolean
  ingredients?: Array<{ stock_item_id: string; qty: number }>
  created_at?: string
}

export interface TestOrderItem {
  id: string
  order_id: string
  menu_item_id?: string
  name: string
  quantity: number
  unit_price: number
  notes?: string
  status?: 'pending' | 'preparing' | 'ready' | 'cancelled'
}

export interface TestOrder {
  id: string
  restaurant_id: string
  table_id: string | null
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'paying' | 'paid' | 'cancelled'
  total: number
  client_name?: string
  notes?: string
  items?: TestOrderItem[]
  created_at?: string
  updated_at?: string
}

export interface TestStockItem {
  id: string
  restaurant_id: string
  name: string
  unit: 'kg' | 'g' | 'l' | 'ml' | 'unidad' | 'porcion' | 'caja'
  current_qty: number
  min_qty?: number
  cost_per_unit: number
  supplier?: string
  category?: string
  active?: boolean
  created_at?: string
  updated_at?: string
}

// ── Factory Functions ─────────────────────────────────────────────────────────

/**
 * Creates a test user with sensible defaults.
 * 
 * @example
 * ```typescript
 * const user = createTestUser({ email: 'chef@example.com' })
 * ```
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.id || crypto.randomUUID()
  const email = overrides.email || `user-${id.slice(0, 8)}@test.com`
  
  return {
    id,
    email,
    created_at: overrides.created_at || new Date().toISOString(),
    app_metadata: overrides.app_metadata || {},
    user_metadata: overrides.user_metadata || {},
    aud: overrides.aud || 'authenticated',
    role: overrides.role,
    ...overrides
  } as TestUser
}

/**
 * Creates a test restaurant with sensible defaults.
 * 
 * @example
 * ```typescript
 * const restaurant = createTestRestaurant({ name: 'Pizza Palace', slug: 'pizza-palace' })
 * ```
 */
export function createTestRestaurant(overrides: Partial<TestRestaurant> = {}): TestRestaurant {
  const id = overrides.id || crypto.randomUUID()
  const name = overrides.name || `Test Restaurant ${id.slice(0, 8)}`
  const slug = overrides.slug || name.toLowerCase().replace(/\s+/g, '-')
  
  return {
    id,
    name,
    slug,
    address: overrides.address,
    neighborhood: overrides.neighborhood,
    lat: overrides.lat,
    lng: overrides.lng,
    photo_url: overrides.photo_url,
    cuisine_type: overrides.cuisine_type || 'general',
    price_range: overrides.price_range || 'medio',
    rating: overrides.rating ?? 4.0,
    review_count: overrides.review_count ?? 0,
    active: overrides.active ?? true,
    plan: overrides.plan || 'free',
    created_at: overrides.created_at || new Date().toISOString()
  }
}

/**
 * Creates a test menu item with sensible defaults.
 * 
 * @example
 * ```typescript
 * const item = createTestMenuItem({ 
 *   restaurant_id: 'rest-123', 
 *   name: 'Margherita Pizza', 
 *   price: 8900 
 * })
 * ```
 */
export function createTestMenuItem(overrides: Partial<TestMenuItem> = {}): TestMenuItem {
  const id = overrides.id || crypto.randomUUID()
  const restaurant_id = overrides.restaurant_id || crypto.randomUUID()
  const name = overrides.name || `Test Item ${id.slice(0, 8)}`
  
  return {
    id,
    restaurant_id,
    name,
    description: overrides.description,
    price: overrides.price ?? 5000,
    category: overrides.category || 'Principal',
    tags: overrides.tags || [],
    photo_url: overrides.photo_url,
    available: overrides.available ?? true,
    ingredients: overrides.ingredients,
    created_at: overrides.created_at || new Date().toISOString()
  }
}

/**
 * Creates a test order with sensible defaults and optional items.
 * 
 * @example
 * ```typescript
 * const order = createTestOrder({ 
 *   restaurant_id: 'rest-123',
 *   total: 15000,
 *   items: [
 *     { name: 'Pizza', quantity: 2, unit_price: 7500 }
 *   ]
 * })
 * ```
 */
export function createTestOrder(overrides: Partial<TestOrder> = {}): TestOrder {
  const id = overrides.id || crypto.randomUUID()
  const restaurant_id = overrides.restaurant_id || crypto.randomUUID()
  const table_id = overrides.table_id !== undefined ? overrides.table_id : crypto.randomUUID()
  
  // Create default items if not provided
  const items = overrides.items || [
    {
      id: crypto.randomUUID(),
      order_id: id,
      menu_item_id: crypto.randomUUID(),
      name: 'Test Item',
      quantity: 1,
      unit_price: 5000,
      status: 'pending' as const
    }
  ]
  
  // Calculate total from items if not explicitly provided
  const total = overrides.total ?? items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  
  return {
    id,
    restaurant_id,
    table_id,
    status: overrides.status || 'pending',
    total,
    client_name: overrides.client_name,
    notes: overrides.notes,
    items,
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString()
  }
}

/**
 * Creates a test stock item with sensible defaults.
 * 
 * @example
 * ```typescript
 * const stockItem = createTestStockItem({ 
 *   restaurant_id: 'rest-123',
 *   name: 'Tomatoes',
 *   current_qty: 50,
 *   unit: 'kg'
 * })
 * ```
 */
export function createTestStockItem(overrides: Partial<TestStockItem> = {}): TestStockItem {
  const id = overrides.id || crypto.randomUUID()
  const restaurant_id = overrides.restaurant_id || crypto.randomUUID()
  const name = overrides.name || `Test Stock Item ${id.slice(0, 8)}`
  
  return {
    id,
    restaurant_id,
    name,
    unit: overrides.unit || 'kg',
    current_qty: overrides.current_qty ?? 100,
    min_qty: overrides.min_qty ?? 10,
    cost_per_unit: overrides.cost_per_unit ?? 1000,
    supplier: overrides.supplier,
    category: overrides.category || 'general',
    active: overrides.active ?? true,
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString()
  }
}

// ── Next.js Request/Response Utilities ────────────────────────────────────────

/**
 * Creates a mock NextRequest object for testing API routes.
 * 
 * @example
 * ```typescript
 * const request = mockNextRequest(
 *   { name: 'Pizza', price: 8900 },
 *   { 'Authorization': 'Bearer token123' }
 * )
 * ```
 */
export function mockNextRequest(
  body?: any,
  headers?: Record<string, string>,
  options?: {
    method?: string
    url?: string
  }
): NextRequest {
  const method = options?.method || 'POST'
  const url = options?.url || 'http://localhost:3000/api/test'
  
  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }
  
  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
    requestInit.body = JSON.stringify(body)
  }
  
  return new NextRequest(url, requestInit)
}

/**
 * Extracts JSON data from a NextResponse object.
 * 
 * @example
 * ```typescript
 * const response = await POST(request)
 * const data = await extractJsonResponse(response)
 * expect(data.ok).toBe(true)
 * ```
 */
export async function extractJsonResponse(response: NextResponse): Promise<any> {
  const text = await response.text()
  
  if (!text) {
    return null
  }
  
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Failed to parse response as JSON: ${text}`)
  }
}

/**
 * Helper to extract response status and JSON data together.
 * 
 * @example
 * ```typescript
 * const response = await POST(request)
 * const { status, data } = await extractResponse(response)
 * expect(status).toBe(201)
 * expect(data.id).toBeDefined()
 * ```
 */
export async function extractResponse(response: NextResponse): Promise<{
  status: number
  data: any
}> {
  return {
    status: response.status,
    data: await extractJsonResponse(response)
  }
}
