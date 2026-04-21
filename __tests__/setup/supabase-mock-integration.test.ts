// ══════════════════════════════════════════════════════════════════════════════
//  Supabase Mock Integration Test — __tests__/setup/supabase-mock-integration.test.ts
//
//  Validates that the mock works correctly with actual API route patterns
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock, createPostgrestError } from './supabase-mock'

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn()
}))

import { createAdminClient } from '@/lib/supabase/server'

describe('Supabase Mock - Real API Pattern Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should work with typical GET pattern (menu-items)', async () => {
    // Setup mock with menu items data
    const mock = createSupabaseMock({
      tables: {
        menu_items: {
          data: [
            { id: '1', name: 'Pizza Margherita', price: 5000, category: 'Principal', restaurant_id: 'r1' },
            { id: '2', name: 'Burger Clásica', price: 3500, category: 'Principal', restaurant_id: 'r1' },
            { id: '3', name: 'Ensalada César', price: 2500, category: 'Entrada', restaurant_id: 'r1' }
          ]
        }
      }
    })

    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    // Simulate the API route query pattern
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', 'r1')
      .order('category')
      .order('name')

    expect(error).toBeNull()
    expect(data).toHaveLength(3)
    // Verify ordering works
    expect(data[0].category).toBe('Entrada')
    expect(data[1].category).toBe('Principal')
  })

  it('should work with typical POST pattern (insert with select)', async () => {
    // Setup mock to return inserted item
    const mock = createSupabaseMock({
      tables: {
        menu_items: {
          data: {
            id: 'new-id',
            name: 'Pizza Margherita',
            price: 5000,
            category: 'Principal',
            restaurant_id: 'r1',
            available: true,
            tags: [],
            created_at: '2024-01-01T00:00:00Z'
          }
        }
      }
    })

    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    // Simulate the API route insert pattern
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: 'r1',
        name: 'Pizza Margherita',
        price: 5000,
        category: 'Principal',
        available: true,
        tags: []
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect(data.id).toBe('new-id')
    expect(data.name).toBe('Pizza Margherita')
  })

  it('should work with typical PATCH pattern (update with select)', async () => {
    // Setup mock to return updated item
    const mock = createSupabaseMock({
      tables: {
        menu_items: {
          data: {
            id: '1',
            name: 'Pizza Margherita',
            price: 6000, // Updated price
            category: 'Principal',
            restaurant_id: 'r1',
            available: true
          }
        }
      }
    })

    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    // Simulate the API route update pattern
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('menu_items')
      .update({ price: 6000 })
      .eq('id', '1')
      .eq('restaurant_id', 'r1')
      .select()
      .single()

    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect(data.price).toBe(6000)
  })

  it('should work with typical DELETE pattern', async () => {
    // Setup mock for delete (no data returned)
    const mock = createSupabaseMock({
      tables: {
        menu_items: {
          data: null
        }
      }
    })

    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    // Simulate the API route delete pattern
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', '1')
      .eq('restaurant_id', 'r1')

    expect(error).toBeNull()
  })

  it('should work with RPC pattern (folio management)', async () => {
    // Setup mock for RPC call
    const mock = createSupabaseMock({
      rpc: {
        take_next_folio_rpc: {
          data: {
            folio: 123,
            caf_id: 'caf-uuid-1',
            success: true
          }
        }
      }
    })

    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    // Simulate the RPC call pattern
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('take_next_folio_rpc', {
      p_restaurant_id: 'r1',
      p_document_type: 39
    })

    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect(data.folio).toBe(123)
    expect(data.caf_id).toBe('caf-uuid-1')
  })

  it('should handle database errors correctly', async () => {
    // Setup mock with error
    const mock = createSupabaseMock({
      tables: {
        menu_items: {
          data: null,
          error: createPostgrestError('23505', 'duplicate key value violates unique constraint')
        }
      }
    })

    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    // Simulate query that fails
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('menu_items')
      .insert({ name: 'Pizza', price: 5000 })
      .select()
      .single()

    expect(data).toBeNull()
    expect(error).toBeTruthy()
    expect(error.code).toBe('23505')
    expect(error.message).toContain('duplicate key')
  })

  it('should work with complex filter chains', async () => {
    // Setup mock with multiple items
    const mock = createSupabaseMock({
      tables: {
        orders: {
          data: [
            { id: '1', restaurant_id: 'r1', status: 'paid', total: 5000, created_at: '2024-01-01' },
            { id: '2', restaurant_id: 'r1', status: 'pending', total: 3000, created_at: '2024-01-02' },
            { id: '3', restaurant_id: 'r1', status: 'paid', total: 7000, created_at: '2024-01-03' },
            { id: '4', restaurant_id: 'r2', status: 'paid', total: 4000, created_at: '2024-01-04' }
          ]
        }
      }
    })

    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    // Simulate complex query with multiple filters
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', 'r1')
      .eq('status', 'paid')
      .gte('total', 5000)

    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    expect(data[0].id).toBe('1')
    expect(data[1].id).toBe('3')
  })

  it('should work with .in() filter for batch operations', async () => {
    // Setup mock
    const mock = createSupabaseMock({
      tables: {
        menu_items: {
          data: [
            { id: '1', name: 'Pizza', restaurant_id: 'r1' },
            { id: '2', name: 'Burger', restaurant_id: 'r1' },
            { id: '3', name: 'Salad', restaurant_id: 'r1' },
            { id: '4', name: 'Pasta', restaurant_id: 'r1' }
          ]
        }
      }
    })

    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    // Simulate batch query
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .in('id', ['1', '3', '4'])

    expect(error).toBeNull()
    expect(data).toHaveLength(3)
    expect(data.map((d: any) => d.name)).toEqual(['Pizza', 'Salad', 'Pasta'])
  })
})
