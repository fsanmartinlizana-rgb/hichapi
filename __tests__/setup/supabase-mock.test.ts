// ══════════════════════════════════════════════════════════════════════════════
//  Supabase Mock Factory Tests — __tests__/setup/supabase-mock.test.ts
//
//  Validates that the mock factory correctly simulates Supabase behavior
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { createSupabaseMock, createPostgrestError, createAuthError } from './supabase-mock'

describe('createSupabaseMock', () => {
  describe('Query Builder - SELECT', () => {
    it('should return configured data for simple select', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: [
              { id: '1', name: 'Pizza', price: 5000 },
              { id: '2', name: 'Burger', price: 3000 }
            ]
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')

      expect(error).toBeNull()
      expect(data).toHaveLength(2)
      expect(data[0].name).toBe('Pizza')
    })

    it('should support chainable .eq() filters', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: [
              { id: '1', name: 'Pizza', restaurant_id: 'r1' },
              { id: '2', name: 'Burger', restaurant_id: 'r2' }
            ]
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', 'r1')

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('Pizza')
    })

    it('should support multiple chained filters', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: [
              { id: '1', name: 'Pizza', restaurant_id: 'r1', available: true },
              { id: '2', name: 'Burger', restaurant_id: 'r1', available: false },
              { id: '3', name: 'Salad', restaurant_id: 'r2', available: true }
            ]
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', 'r1')
        .eq('available', true)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('Pizza')
    })

    it('should support .single() modifier', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: [{ id: '1', name: 'Pizza' }]
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')
        .eq('id', '1')
        .single()

      expect(error).toBeNull()
      expect(data).toEqual({ id: '1', name: 'Pizza' })
    })

    it('should return error when .single() finds no rows', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: []
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')
        .single()

      expect(data).toBeNull()
      expect(error).toBeTruthy()
      expect(error.code).toBe('PGRST116')
    })

    it('should support .maybeSingle() modifier', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: [{ id: '1', name: 'Pizza' }]
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')
        .eq('id', '1')
        .maybeSingle()

      expect(error).toBeNull()
      expect(data).toEqual({ id: '1', name: 'Pizza' })
    })

    it('should return null when .maybeSingle() finds no rows', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: []
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')
        .maybeSingle()

      expect(error).toBeNull()
      expect(data).toBeNull()
    })

    it('should support .order() modifier', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: [
              { id: '1', name: 'Burger', price: 3000 },
              { id: '2', name: 'Pizza', price: 5000 },
              { id: '3', name: 'Salad', price: 2000 }
            ]
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')
        .order('price', { ascending: true })

      expect(error).toBeNull()
      expect(data[0].name).toBe('Salad')
      expect(data[1].name).toBe('Burger')
      expect(data[2].name).toBe('Pizza')
    })

    it('should support .limit() modifier', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: [
              { id: '1', name: 'Pizza' },
              { id: '2', name: 'Burger' },
              { id: '3', name: 'Salad' }
            ]
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')
        .limit(2)

      expect(error).toBeNull()
      expect(data).toHaveLength(2)
    })
  })

  describe('Query Builder - INSERT', () => {
    it('should return inserted data', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: { id: '1', name: 'Pizza', price: 5000 }
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .insert({ name: 'Pizza', price: 5000 })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toEqual({ id: '1', name: 'Pizza', price: 5000 })
    })
  })

  describe('Query Builder - UPDATE', () => {
    it('should return updated data', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: { id: '1', name: 'Pizza Updated', price: 6000 }
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .update({ price: 6000 })
        .eq('id', '1')
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.price).toBe(6000)
    })
  })

  describe('Query Builder - DELETE', () => {
    it('should execute delete operation', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: null
          }
        }
      })

      const { error } = await mock
        .from('menu_items')
        .delete()
        .eq('id', '1')

      expect(error).toBeNull()
    })
  })

  describe('Error Injection', () => {
    it('should return configured error', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: null,
            error: createPostgrestError('23505', 'duplicate key value')
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')

      expect(data).toBeNull()
      expect(error).toBeTruthy()
      expect(error.code).toBe('23505')
      expect(error.message).toBe('duplicate key value')
    })
  })

  describe('RPC Support', () => {
    it('should call RPC with configured response', async () => {
      const mock = createSupabaseMock({
        rpc: {
          take_next_folio_rpc: {
            data: { folio: 123, caf_id: 'caf-1' }
          }
        }
      })

      const { data, error } = await mock.rpc('take_next_folio_rpc', {
        p_restaurant_id: 'r1',
        p_document_type: 39
      })

      expect(error).toBeNull()
      expect(data.folio).toBe(123)
    })

    it('should return RPC error when configured', async () => {
      const mock = createSupabaseMock({
        rpc: {
          take_next_folio_rpc: {
            data: null,
            error: createPostgrestError('P0001', 'No CAF available')
          }
        }
      })

      const { data, error } = await mock.rpc('take_next_folio_rpc')

      expect(data).toBeNull()
      expect(error).toBeTruthy()
      expect(error.message).toBe('No CAF available')
    })
  })

  describe('Auth Support', () => {
    it('should return configured user from auth.getUser()', async () => {
      const mock = createSupabaseMock({
        auth: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            aud: 'authenticated',
            role: 'authenticated',
            created_at: '2024-01-01T00:00:00Z',
            app_metadata: {},
            user_metadata: {}
          }
        }
      })

      const { data, error } = await mock.auth.getUser()

      expect(error).toBeNull()
      expect(data.user).toBeTruthy()
      expect(data.user.id).toBe('user-1')
      expect(data.user.email).toBe('test@example.com')
    })

    it('should return auth error when configured', async () => {
      const mock = createSupabaseMock({
        auth: {
          user: null,
          error: createAuthError('Invalid JWT', 401)
        }
      })

      const { data, error } = await mock.auth.getUser()

      expect(data.user).toBeNull()
      expect(error).toBeTruthy()
      expect(error.message).toBe('Invalid JWT')
    })

    it('should return null user when not configured', async () => {
      const mock = createSupabaseMock({})

      const { data, error } = await mock.auth.getUser()

      expect(error).toBeNull()
      expect(data.user).toBeNull()
    })
  })

  describe('Complex Filters', () => {
    it('should support .in() filter', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: [
              { id: '1', name: 'Pizza' },
              { id: '2', name: 'Burger' },
              { id: '3', name: 'Salad' }
            ]
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')
        .in('id', ['1', '3'])

      expect(error).toBeNull()
      expect(data).toHaveLength(2)
      expect(data.map((d: any) => d.name)).toEqual(['Pizza', 'Salad'])
    })

    it('should support .gt() and .lt() filters', async () => {
      const mock = createSupabaseMock({
        tables: {
          menu_items: {
            data: [
              { id: '1', price: 1000 },
              { id: '2', price: 3000 },
              { id: '3', price: 5000 }
            ]
          }
        }
      })

      const { data, error } = await mock
        .from('menu_items')
        .select('*')
        .gt('price', 1000)
        .lt('price', 5000)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe('2')
    })
  })
})
