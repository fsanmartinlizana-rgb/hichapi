// ══════════════════════════════════════════════════════════════════════════════
//  Auth Guards Tests — __tests__/lib/supabase/auth-guard.test.ts
//
//  Tests for requireUser() and requireRestaurantRole() auth guard functions
//  Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requireUser, requireRestaurantRole, requireCustomer } from '@/lib/supabase/auth-guard'
import { createAuthError } from '../../setup/supabase-mock'
import { createTestUser } from '../../setup/test-helpers'

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn()
}))

// Mock @supabase/supabase-js (for Bearer token path)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

// Mock the Supabase server module (for createAdminClient)
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn()
}))

// Import after mocking
import { cookies, headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'

describe('requireUser()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock headers() to return no Authorization header by default
    const mockHeaderStore = { get: vi.fn().mockReturnValue(null) }
    vi.mocked(headers).mockResolvedValue(mockHeaderStore as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('No auth header - Requirement 3.1', () => {
    it('should return 401 when no user is authenticated', async () => {
      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: createAuthError('No user found', 401)
          })
        }
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireUser()

      expect(result.user).toBeNull()
      expect(result.error).toBeDefined()
      
      // Extract status from NextResponse
      const response = result.error as any
      expect(response.status).toBe(401)
    })

    it('should return error message "No autorizado"', async () => {
      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: createAuthError('No user found', 401)
          })
        }
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireUser()
      const response = result.error as any
      const body = await response.json()

      expect(body.error).toBe('No autorizado')
    })
  })

  describe('Invalid JWT - Requirement 3.2', () => {
    it('should return 401 for invalid JWT', async () => {
      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([
          { name: 'sb-access-token', value: 'invalid-jwt-token' }
        ]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: createAuthError('Invalid JWT', 401)
          })
        }
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireUser()

      expect(result.user).toBeNull()
      expect(result.error).toBeDefined()
      
      const response = result.error as any
      expect(response.status).toBe(401)
    })

    it('should return 401 for expired JWT', async () => {
      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([
          { name: 'sb-access-token', value: 'expired-jwt-token' }
        ]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: createAuthError('JWT expired', 401)
          })
        }
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireUser()

      expect(result.user).toBeNull()
      expect(result.error).toBeDefined()
      
      const response = result.error as any
      expect(response.status).toBe(401)
    })
  })

  describe('Valid JWT - Requirement 3.5', () => {
    it('should return user for valid JWT', async () => {
      const testUser = createTestUser({ 
        id: 'user-123', 
        email: 'test@example.com' 
      })

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([
          { name: 'sb-access-token', value: 'valid-jwt-token' }
        ]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        }
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireUser()

      expect(result.user).toBeDefined()
      expect(result.user?.id).toBe('user-123')
      expect(result.user?.email).toBe('test@example.com')
      expect(result.error).toBeNull()
    })

    it('should return user_id for authenticated user', async () => {
      const testUser = createTestUser({ id: 'user-456' })

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([
          { name: 'sb-access-token', value: 'valid-jwt-token' }
        ]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        }
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireUser()

      expect(result.user?.id).toBe('user-456')
      expect(result.error).toBeNull()
    })
  })
})

describe('requireRestaurantRole()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock headers() to return no Authorization header by default
    const mockHeaderStore = { get: vi.fn().mockReturnValue(null) }
    vi.mocked(headers).mockResolvedValue(mockHeaderStore as any)
    // Default admin client mock (overridden per-test as needed)
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('User not in restaurant - Requirement 3.3', () => {
    it('should return 403 when user is not member of restaurant', async () => {
      const testUser = createTestUser({ id: 'user-123' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null, // User not in restaurant
                    error: null
                  })
                })
              })
            })
          })
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId)

      expect(result.user).toBeNull()
      expect(result.role).toBeNull()
      expect(result.error).toBeDefined()
      
      const response = result.error as any
      expect(response.status).toBe(403)
    })

    it('should return error message "Acceso denegado"', async () => {
      const testUser = createTestUser({ id: 'user-123' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null
                  })
                })
              })
            })
          })
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId)
      const response = result.error as any
      const body = await response.json()

      expect(body.error).toBe('Acceso denegado')
    })
  })

  describe('Insufficient role - Requirement 3.4', () => {
    it('should return 403 when user has garzon role but admin is required', async () => {
      const testUser = createTestUser({ id: 'user-123' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role: 'garzon' },
                    error: null
                  })
                })
              })
            })
          })
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId, ['admin', 'owner'])

      expect(result.user).toBeNull()
      expect(result.role).toBeNull()
      expect(result.error).toBeDefined()
      
      const response = result.error as any
      expect(response.status).toBe(403)
    })

    it('should return 403 when user has supervisor role but owner is required', async () => {
      const testUser = createTestUser({ id: 'user-123' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role: 'supervisor' },
                    error: null
                  })
                })
              })
            })
          })
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId, ['owner'])

      expect(result.user).toBeNull()
      expect(result.role).toBeNull()
      expect(result.error).toBeDefined()
      
      const response = result.error as any
      expect(response.status).toBe(403)
    })
  })

  describe('Valid role - Requirement 3.5', () => {
    it('should return user and role for valid admin', async () => {
      const testUser = createTestUser({ id: 'user-123' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role: 'admin' },
                    error: null
                  })
                })
              })
            })
          })
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId, ['admin', 'owner'])

      expect(result.user).toBeDefined()
      expect(result.user?.id).toBe('user-123')
      expect(result.role).toBe('admin')
      expect(result.error).toBeNull()
    })

    it('should return user and role for valid owner', async () => {
      const testUser = createTestUser({ id: 'user-456' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role: 'owner' },
                    error: null
                  })
                })
              })
            })
          })
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId)

      expect(result.user).toBeDefined()
      expect(result.role).toBe('owner')
      expect(result.error).toBeNull()
    })

    it('should accept garzon role when explicitly allowed', async () => {
      const testUser = createTestUser({ id: 'user-789' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role: 'garzon' },
                    error: null
                  })
                })
              })
            })
          })
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId, ['garzon', 'admin'])

      expect(result.user).toBeDefined()
      expect(result.role).toBe('garzon')
      expect(result.error).toBeNull()
    })
  })

  describe('Super admin bypass - Requirement 3.6', () => {
    it('should allow super_admin to access any restaurant', async () => {
      const testUser = createTestUser({ id: 'super-admin-123' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      let fromCallCount = 0
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockImplementation(() => {
          fromCallCount++
          const isFirstCall = fromCallCount === 1
          
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: isFirstCall ? null : { role: 'super_admin' },
                      error: null
                    })
                  })
                })
              })
            })
          }
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId)

      expect(result.user).toBeDefined()
      expect(result.role).toBe('super_admin')
      expect(result.error).toBeNull()
    })

    it('should allow super_admin even when not in restaurant team', async () => {
      const testUser = createTestUser({ id: 'super-admin-456' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      let fromCallCount = 0
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockImplementation(() => {
          fromCallCount++
          const isFirstCall = fromCallCount === 1
          
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: isFirstCall ? null : { role: 'super_admin' },
                      error: null
                    })
                  })
                })
              })
            })
          }
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId, ['owner'])

      expect(result.user).toBeDefined()
      expect(result.role).toBe('super_admin')
      expect(result.error).toBeNull()
    })
  })

  describe('Role combinations - Requirement 3.6', () => {
    it('should test owner role access', async () => {
      const testUser = createTestUser({ id: 'user-owner' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role: 'owner' },
                    error: null
                  })
                })
              })
            })
          })
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor', 'super_admin'])

      expect(result.role).toBe('owner')
      expect(result.error).toBeNull()
    })

    it('should test supervisor role access', async () => {
      const testUser = createTestUser({ id: 'user-supervisor' })
      const restaurantId = crypto.randomUUID()

      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn()
      }

      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role: 'supervisor' },
                    error: null
                  })
                })
              })
            })
          })
        })
      }

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor', 'super_admin'])

      expect(result.role).toBe('supervisor')
      expect(result.error).toBeNull()
    })
  })
})

describe('requireCustomer()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock headers() to return no Authorization header by default
    const mockHeaderStore = { get: vi.fn().mockReturnValue(null) }
    vi.mocked(headers).mockResolvedValue(mockHeaderStore as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('No session — Requirements 9.4, 10.1', () => {
    it('should return 401 when no user is authenticated', async () => {
      const mockCookieStore = { getAll: vi.fn().mockReturnValue([]), setAll: vi.fn() }
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: createAuthError('No user found', 401),
          }),
        },
      }
      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireCustomer()

      expect(result.customer).toBeNull()
      expect(result.error).toBeDefined()
      const response = result.error as any
      expect(response.status).toBe(401)
    })

    it('should return error message "No autorizado" when unauthenticated', async () => {
      const mockCookieStore = { getAll: vi.fn().mockReturnValue([]), setAll: vi.fn() }
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: createAuthError('No user found', 401),
          }),
        },
      }
      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any)

      const result = await requireCustomer()
      const response = result.error as any
      const body = await response.json()

      expect(body.error).toBe('No autorizado')
    })
  })

  describe('Authenticated but no customer_profiles row — Requirements 9.4, 10.1', () => {
    it('should return 403 when user has no customer_profiles record', async () => {
      const testUser = createTestUser({ id: 'user-no-customer' })

      const mockCookieStore = { getAll: vi.fn().mockReturnValue([]), setAll: vi.fn() }
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockAuthSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: testUser }, error: null }),
        },
      }
      vi.mocked(createServerClient).mockReturnValue(mockAuthSupabase as any)

      const mockAdminSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }
      vi.mocked(createAdminClient).mockReturnValue(mockAdminSupabase as any)

      const result = await requireCustomer()

      expect(result.customer).toBeNull()
      expect(result.error).toBeDefined()
      const response = result.error as any
      expect(response.status).toBe(403)
    })

    it('should return error message "Perfil de comensal no encontrado"', async () => {
      const testUser = createTestUser({ id: 'user-no-customer' })

      const mockCookieStore = { getAll: vi.fn().mockReturnValue([]), setAll: vi.fn() }
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockAuthSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: testUser }, error: null }),
        },
      }
      vi.mocked(createServerClient).mockReturnValue(mockAuthSupabase as any)

      const mockAdminSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }
      vi.mocked(createAdminClient).mockReturnValue(mockAdminSupabase as any)

      const result = await requireCustomer()
      const response = result.error as any
      const body = await response.json()

      expect(body.error).toBe('Perfil de comensal no encontrado')
    })
  })

  describe('Authenticated with valid customer_profiles row — Requirements 9.4, 10.1', () => {
    it('should return customer profile when user has a customer_profiles record', async () => {
      const testUser = createTestUser({ id: 'user-with-customer' })
      const mockCustomer = {
        id: 'customer-123',
        user_id: 'user-with-customer',
        display_name: 'Jorge Test',
        phone: null,
        photo_url: null,
        loyalty_points: 0,
        push_token: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockCookieStore = { getAll: vi.fn().mockReturnValue([]), setAll: vi.fn() }
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockAuthSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: testUser }, error: null }),
        },
      }
      vi.mocked(createServerClient).mockReturnValue(mockAuthSupabase as any)

      const mockAdminSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockCustomer, error: null }),
            }),
          }),
        }),
      }
      vi.mocked(createAdminClient).mockReturnValue(mockAdminSupabase as any)

      const result = await requireCustomer()

      expect(result.error).toBeNull()
      expect(result.customer).toBeDefined()
      expect(result.customer?.id).toBe('customer-123')
      expect(result.customer?.user_id).toBe('user-with-customer')
      expect(result.customer?.display_name).toBe('Jorge Test')
    })

    it('should query customer_profiles by user_id', async () => {
      const testUser = createTestUser({ id: 'user-abc' })
      const mockCustomer = {
        id: 'customer-456',
        user_id: 'user-abc',
        display_name: 'Test Customer',
        phone: '+56912345678',
        photo_url: null,
        loyalty_points: 150,
        push_token: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockCookieStore = { getAll: vi.fn().mockReturnValue([]), setAll: vi.fn() }
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

      const mockAuthSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: testUser }, error: null }),
        },
      }
      vi.mocked(createServerClient).mockReturnValue(mockAuthSupabase as any)

      const eqMock = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: mockCustomer, error: null }),
      })
      const mockAdminSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: eqMock,
          }),
        }),
      }
      vi.mocked(createAdminClient).mockReturnValue(mockAdminSupabase as any)

      await requireCustomer()

      // Verify it queried by user_id
      expect(eqMock).toHaveBeenCalledWith('user_id', 'user-abc')
    })
  })
})
