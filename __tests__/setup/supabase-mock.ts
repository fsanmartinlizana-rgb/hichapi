// ══════════════════════════════════════════════════════════════════════════════
//  Supabase Mock Factory — __tests__/setup/supabase-mock.ts
//
//  Provides a flexible mock factory for Supabase client that supports:
//    - Chainable query builder (.from().select().eq().single() pattern)
//    - RPC calls for stored procedures
//    - Auth operations (auth.getUser())
//    - Configurable responses per table and error injection
//
//  Requirements: 1.1, 1.6
// ══════════════════════════════════════════════════════════════════════════════

import { vi } from 'vitest'
import type { SupabaseClient, User, AuthError } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostgrestError {
  message: string
  details: string
  hint: string
  code: string
}

export interface MockTableConfig {
  data?: any[] | any | null
  error?: PostgrestError | null
  count?: number | null
}

export interface MockRpcConfig {
  data?: any
  error?: PostgrestError | null
}

export interface MockAuthConfig {
  user?: User | null
  error?: AuthError | null
}

export interface MockConfig {
  tables?: Record<string, MockTableConfig>
  rpc?: Record<string, MockRpcConfig>
  auth?: MockAuthConfig
}

// ── Query Builder State ───────────────────────────────────────────────────────

interface QueryState {
  table: string
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  filters: Array<{ method: string; args: any[] }>
  selectColumns?: string
  insertData?: any
  updateData?: any
  modifiers: {
    single?: boolean
    maybeSingle?: boolean
    order?: Array<{ column: string; ascending: boolean }>
    limit?: number
    range?: { from: number; to: number }
  }
}

// ── Mock Factory ──────────────────────────────────────────────────────────────

/**
 * Creates a mock Supabase client with configurable responses.
 * 
 * @example
 * ```typescript
 * const mock = createSupabaseMock({
 *   tables: {
 *     menu_items: {
 *       data: [{ id: '1', name: 'Pizza', price: 5000 }],
 *       error: null
 *     }
 *   },
 *   rpc: {
 *     take_next_folio_rpc: {
 *       data: { folio: 123 },
 *       error: null
 *     }
 *   },
 *   auth: {
 *     user: { id: 'user-1', email: 'test@example.com' },
 *     error: null
 *   }
 * })
 * ```
 */
export function createSupabaseMock(config: MockConfig = {}): any {
  const { tables = {}, rpc = {}, auth = {} } = config

  // ── Query Builder Chain ─────────────────────────────────────────────────────

  function createQueryBuilder(state: QueryState): any {
    const builder: any = {}

    // SELECT
    builder.select = vi.fn((columns = '*') => {
      state.operation = 'select'
      state.selectColumns = columns
      return createQueryBuilder(state)
    })

    // INSERT
    builder.insert = vi.fn((data) => {
      state.operation = 'insert'
      state.insertData = data
      return createQueryBuilder(state)
    })

    // UPDATE
    builder.update = vi.fn((data) => {
      state.operation = 'update'
      state.updateData = data
      return createQueryBuilder(state)
    })

    // DELETE
    builder.delete = vi.fn(() => {
      state.operation = 'delete'
      return createQueryBuilder(state)
    })

    // UPSERT
    builder.upsert = vi.fn((data) => {
      state.operation = 'upsert'
      state.insertData = data
      return createQueryBuilder(state)
    })

    // FILTERS
    builder.eq = vi.fn((column, value) => {
      state.filters.push({ method: 'eq', args: [column, value] })
      return createQueryBuilder(state)
    })

    builder.neq = vi.fn((column, value) => {
      state.filters.push({ method: 'neq', args: [column, value] })
      return createQueryBuilder(state)
    })

    builder.gt = vi.fn((column, value) => {
      state.filters.push({ method: 'gt', args: [column, value] })
      return createQueryBuilder(state)
    })

    builder.gte = vi.fn((column, value) => {
      state.filters.push({ method: 'gte', args: [column, value] })
      return createQueryBuilder(state)
    })

    builder.lt = vi.fn((column, value) => {
      state.filters.push({ method: 'lt', args: [column, value] })
      return createQueryBuilder(state)
    })

    builder.lte = vi.fn((column, value) => {
      state.filters.push({ method: 'lte', args: [column, value] })
      return createQueryBuilder(state)
    })

    builder.like = vi.fn((column, pattern) => {
      state.filters.push({ method: 'like', args: [column, pattern] })
      return createQueryBuilder(state)
    })

    builder.ilike = vi.fn((column, pattern) => {
      state.filters.push({ method: 'ilike', args: [column, pattern] })
      return createQueryBuilder(state)
    })

    builder.is = vi.fn((column, value) => {
      state.filters.push({ method: 'is', args: [column, value] })
      return createQueryBuilder(state)
    })

    builder.in = vi.fn((column, values) => {
      state.filters.push({ method: 'in', args: [column, values] })
      return createQueryBuilder(state)
    })

    builder.contains = vi.fn((column, value) => {
      state.filters.push({ method: 'contains', args: [column, value] })
      return createQueryBuilder(state)
    })

    builder.containedBy = vi.fn((column, value) => {
      state.filters.push({ method: 'containedBy', args: [column, value] })
      return createQueryBuilder(state)
    })

    builder.rangeGt = vi.fn((column, range) => {
      state.filters.push({ method: 'rangeGt', args: [column, range] })
      return createQueryBuilder(state)
    })

    builder.rangeGte = vi.fn((column, range) => {
      state.filters.push({ method: 'rangeGte', args: [column, range] })
      return createQueryBuilder(state)
    })

    builder.rangeLt = vi.fn((column, range) => {
      state.filters.push({ method: 'rangeLt', args: [column, range] })
      return createQueryBuilder(state)
    })

    builder.rangeLte = vi.fn((column, range) => {
      state.filters.push({ method: 'rangeLte', args: [column, range] })
      return createQueryBuilder(state)
    })

    builder.rangeAdjacent = vi.fn((column, range) => {
      state.filters.push({ method: 'rangeAdjacent', args: [column, range] })
      return createQueryBuilder(state)
    })

    builder.overlaps = vi.fn((column, value) => {
      state.filters.push({ method: 'overlaps', args: [column, value] })
      return createQueryBuilder(state)
    })

    builder.textSearch = vi.fn((column, query, options) => {
      state.filters.push({ method: 'textSearch', args: [column, query, options] })
      return createQueryBuilder(state)
    })

    builder.match = vi.fn((query) => {
      state.filters.push({ method: 'match', args: [query] })
      return createQueryBuilder(state)
    })

    builder.not = vi.fn((column, operator, value) => {
      state.filters.push({ method: 'not', args: [column, operator, value] })
      return createQueryBuilder(state)
    })

    builder.or = vi.fn((filters) => {
      state.filters.push({ method: 'or', args: [filters] })
      return createQueryBuilder(state)
    })

    builder.filter = vi.fn((column, operator, value) => {
      state.filters.push({ method: 'filter', args: [column, operator, value] })
      return createQueryBuilder(state)
    })

    // MODIFIERS
    builder.order = vi.fn((column, options = {}) => {
      if (!state.modifiers.order) state.modifiers.order = []
      state.modifiers.order.push({
        column,
        ascending: options.ascending !== false
      })
      return createQueryBuilder(state)
    })

    builder.limit = vi.fn((count) => {
      state.modifiers.limit = count
      return createQueryBuilder(state)
    })

    builder.range = vi.fn((from, to) => {
      state.modifiers.range = { from, to }
      return createQueryBuilder(state)
    })

    builder.single = vi.fn(() => {
      state.modifiers.single = true
      return executeQuery(state)
    })

    builder.maybeSingle = vi.fn(() => {
      state.modifiers.maybeSingle = true
      return executeQuery(state)
    })

    // TERMINAL OPERATIONS (return promises)
    builder.then = (resolve: any, reject: any) => {
      return executeQuery(state).then(resolve, reject)
    }

    return builder
  }

  // ── Query Execution ─────────────────────────────────────────────────────────

  function executeQuery(state: QueryState): Promise<any> {
    const tableConfig = tables[state.table] || {}
    const { data: configData, error: configError, count } = tableConfig

    // If error is configured, return it
    if (configError) {
      return Promise.resolve({ data: null, error: configError, count: null })
    }

    // Handle different operations
    let resultData: any = null

    switch (state.operation) {
      case 'select':
        resultData = configData !== undefined ? configData : []
        // Apply filters (basic simulation)
        if (Array.isArray(resultData) && state.filters.length > 0) {
          resultData = applyFilters(resultData, state.filters)
        }
        // Apply order
        if (state.modifiers.order && Array.isArray(resultData)) {
          resultData = applyOrder(resultData, state.modifiers.order)
        }
        // Apply limit
        if (state.modifiers.limit && Array.isArray(resultData)) {
          resultData = resultData.slice(0, state.modifiers.limit)
        }
        // Apply range
        if (state.modifiers.range && Array.isArray(resultData)) {
          const { from, to } = state.modifiers.range
          resultData = resultData.slice(from, to + 1)
        }
        // Apply single/maybeSingle
        if (state.modifiers.single) {
          if (Array.isArray(resultData)) {
            if (resultData.length === 0) {
              return Promise.resolve({
                data: null,
                error: { message: 'No rows found', code: 'PGRST116', details: '', hint: '' },
                count: null
              })
            }
            if (resultData.length > 1) {
              return Promise.resolve({
                data: null,
                error: { message: 'Multiple rows found', code: 'PGRST116', details: '', hint: '' },
                count: null
              })
            }
            resultData = resultData[0]
          }
        }
        if (state.modifiers.maybeSingle && Array.isArray(resultData)) {
          resultData = resultData.length > 0 ? resultData[0] : null
        }
        break

      case 'insert':
        // For insert, return the inserted data (or configured data)
        resultData = configData !== undefined ? configData : state.insertData
        // If single modifier, return single object
        if (state.modifiers.single && Array.isArray(resultData)) {
          resultData = resultData[0] || null
        }
        break

      case 'update':
        // For update, return the updated data (or configured data)
        resultData = configData !== undefined ? configData : state.updateData
        // If single modifier, return single object
        if (state.modifiers.single && Array.isArray(resultData)) {
          resultData = resultData[0] || null
        }
        break

      case 'delete':
        // For delete, return empty or configured data
        resultData = configData !== undefined ? configData : null
        break

      case 'upsert':
        // For upsert, return the upserted data (or configured data)
        resultData = configData !== undefined ? configData : state.insertData
        // If single modifier, return single object
        if (state.modifiers.single && Array.isArray(resultData)) {
          resultData = resultData[0] || null
        }
        break
    }

    return Promise.resolve({
      data: resultData,
      error: null,
      count: count !== undefined ? count : (Array.isArray(resultData) ? resultData.length : null)
    })
  }

  // ── Filter Application ──────────────────────────────────────────────────────

  function applyFilters(data: any[], filters: Array<{ method: string; args: any[] }>): any[] {
    return data.filter(row => {
      return filters.every(filter => {
        const [column, value] = filter.args
        switch (filter.method) {
          case 'eq':
            return row[column] === value
          case 'neq':
            return row[column] !== value
          case 'gt':
            return row[column] > value
          case 'gte':
            return row[column] >= value
          case 'lt':
            return row[column] < value
          case 'lte':
            return row[column] <= value
          case 'is':
            return row[column] === value
          case 'in':
            return value.includes(row[column])
          case 'like':
            return new RegExp(value.replace(/%/g, '.*')).test(row[column])
          case 'ilike':
            return new RegExp(value.replace(/%/g, '.*'), 'i').test(row[column])
          case 'contains':
            return Array.isArray(row[column]) && value.every((v: any) => row[column].includes(v))
          case 'match':
            return Object.entries(column).every(([k, v]) => row[k] === v)
          default:
            return true
        }
      })
    })
  }

  // ── Order Application ───────────────────────────────────────────────────────

  function applyOrder(data: any[], orders: Array<{ column: string; ascending: boolean }>): any[] {
    return [...data].sort((a, b) => {
      for (const { column, ascending } of orders) {
        const aVal = a[column]
        const bVal = b[column]
        if (aVal < bVal) return ascending ? -1 : 1
        if (aVal > bVal) return ascending ? 1 : -1
      }
      return 0
    })
  }

  // ── Main Mock Object ────────────────────────────────────────────────────────

  const mock: any = {
    // FROM - entry point for query builder
    from: vi.fn((table: string) => {
      const state: QueryState = {
        table,
        operation: 'select',
        filters: [],
        modifiers: {}
      }
      return createQueryBuilder(state)
    }),

    // RPC - stored procedure calls
    rpc: vi.fn((fnName: string, params?: any) => {
      const rpcConfig = rpc[fnName] || {}
      const { data: rpcData, error: rpcError } = rpcConfig

      if (rpcError) {
        return Promise.resolve({ data: null, error: rpcError })
      }

      return Promise.resolve({ data: rpcData !== undefined ? rpcData : null, error: null })
    }),

    // AUTH
    auth: {
      getUser: vi.fn(() => {
        const { user = null, error: authError = null } = auth

        if (authError) {
          return Promise.resolve({ data: { user: null }, error: authError })
        }

        return Promise.resolve({ data: { user }, error: null })
      }),

      getSession: vi.fn(() => {
        const { user = null, error: authError = null } = auth

        if (authError) {
          return Promise.resolve({ data: { session: null }, error: authError })
        }

        const session = user ? {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user
        } : null

        return Promise.resolve({ data: { session }, error: null })
      }),

      signInWithPassword: vi.fn(() => {
        const { user = null, error: authError = null } = auth

        if (authError) {
          return Promise.resolve({ data: { user: null, session: null }, error: authError })
        }

        const session = user ? {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user
        } : null

        return Promise.resolve({ data: { user, session }, error: null })
      }),

      signOut: vi.fn(() => {
        return Promise.resolve({ error: null })
      }),

      signUp: vi.fn(() => {
        const { user = null, error: authError = null } = auth

        if (authError) {
          return Promise.resolve({ data: { user: null, session: null }, error: authError })
        }

        const session = user ? {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user
        } : null

        return Promise.resolve({ data: { user, session }, error: null })
      }),

      updateUser: vi.fn(() => {
        const { user = null, error: authError = null } = auth

        if (authError) {
          return Promise.resolve({ data: { user: null }, error: authError })
        }

        return Promise.resolve({ data: { user }, error: null })
      }),

      resetPasswordForEmail: vi.fn(() => {
        const { error: authError = null } = auth

        if (authError) {
          return Promise.resolve({ data: null, error: authError })
        }

        return Promise.resolve({ data: {}, error: null })
      }),
    },

    // STORAGE (basic mock)
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: { path: 'mock-path' }, error: null })),
        download: vi.fn(() => Promise.resolve({ data: new Blob(), error: null })),
        remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://mock-url.com' } })),
      }))
    },

    // CHANNEL (realtime - basic mock)
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockReturnThis(),
    })),

    // FUNCTIONS (edge functions - basic mock)
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }
  }

  return mock as unknown as SupabaseClient
}

// ── Helper: Create Error ──────────────────────────────────────────────────────

/**
 * Helper to create a PostgrestError object
 */
export function createPostgrestError(
  code: string,
  message: string,
  details = '',
  hint = ''
): PostgrestError {
  return { code, message, details, hint }
}

/**
 * Helper to create an AuthError object
 */
export function createAuthError(message: string, status = 400): AuthError {
  return {
    name: 'AuthError',
    message,
    status
  } as AuthError
}
