// ══════════════════════════════════════════════════════════════════════════════
//  Register Restaurant API Tests — __tests__/api/auth/register-restaurant.test.ts
//
//  Tests for POST /api/auth/register-restaurant endpoint
//  Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.6
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/register-restaurant/route'
import { createSupabaseMock, createAuthError } from '../../setup/supabase-mock'
import { 
  mockNextRequest, 
  extractResponse
} from '../../setup/test-helpers'

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn()
}))

// Mock the email sender (non-blocking)
vi.mock('@/lib/email/sender', () => ({
  sendBrandedEmail: vi.fn().mockResolvedValue(undefined)
}))

// Mock the app URL resolver
vi.mock('@/lib/app-url', () => ({
  resolveAppUrl: vi.fn().mockReturnValue('http://localhost:3000')
}))

// Import after mocking
import { createAdminClient } from '@/lib/supabase/server'

describe('POST /api/auth/register-restaurant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful registration - Requirements 4.1, 4.2, 4.3', () => {
    it('should create user, restaurant, and team member atomically', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const slug = 'test-restaurant-a1b2'

      const mockSupabase = createSupabaseMock({
        auth: {
          user: {
            id: userId,
            email: 'owner@restaurant.cl',
            created_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: { owner_name: 'María González' },
            aud: 'authenticated'
          }
        },
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              slug: slug
            }
          },
          team_members: {
            data: {
              id: crypto.randomUUID(),
              restaurant_id: restaurantId,
              user_id: userId,
              role: 'owner'
            }
          }
        }
      })

      // Mock the admin.createUser method
      mockSupabase.auth.admin = {
        createUser: vi.fn().mockResolvedValue({
          data: { 
            user: {
              id: userId,
              email: 'owner@restaurant.cl',
              created_at: new Date().toISOString(),
              app_metadata: {},
              user_metadata: { owner_name: 'María González' },
              aud: 'authenticated'
            }
          },
          error: null
        }),
        deleteUser: vi.fn().mockResolvedValue({ data: null, error: null })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        email: 'owner@restaurant.cl',
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.user_id).toBe(userId)
      expect(data.restaurant_id).toBe(restaurantId)
      expect(data.slug).toBe(slug)

      // Verify user creation was called with correct parameters
      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith({
        email: 'owner@restaurant.cl',
        password: 'SecurePass123!',
        email_confirm: true,
        user_metadata: { owner_name: 'María González' }
      })

      // Verify restaurant creation
      expect(mockSupabase.from).toHaveBeenCalledWith('restaurants')
      
      // Verify team member creation
      expect(mockSupabase.from).toHaveBeenCalledWith('team_members')
    })
  })

  describe('Duplicate email handling - Requirement 4.4', () => {
    it('should return 409 when email already exists', async () => {
      const mockSupabase = createSupabaseMock({})

      // Mock user creation failure due to duplicate email
      mockSupabase.auth.admin = {
        createUser: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'User already been registered' }
        }),
        deleteUser: vi.fn().mockResolvedValue({ data: null, error: null })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        email: 'existing@restaurant.cl',
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(409)
      expect(data.error).toBe('Este email ya tiene una cuenta. Inicia sesión.')
    })

    it('should return 409 when email already exists (alternative message)', async () => {
      const mockSupabase = createSupabaseMock({})

      // Mock user creation failure due to duplicate email (alternative message)
      mockSupabase.auth.admin = {
        createUser: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'User already exists' }
        }),
        deleteUser: vi.fn().mockResolvedValue({ data: null, error: null })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        email: 'existing@restaurant.cl',
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(409)
      expect(data.error).toBe('Este email ya tiene una cuenta. Inicia sesión.')
    })
  })

  describe('Input validation - Requirements 4.4, 7.6', () => {
    it('should return 400 for invalid email format', async () => {
      const requestBody = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
      expect(data.details).toBeDefined()
      expect(data.details[0].path).toEqual(['email'])
    })

    it('should return 400 for password too short (< 12 chars)', async () => {
      const requestBody = {
        email: 'owner@restaurant.cl',
        password: 'Short123!',  // Only 9 characters
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
      expect(data.details).toBeDefined()
      expect(data.details[0].path).toEqual(['password'])
      expect(data.details[0].code).toBe('too_small')
    })

    it('should return 400 for missing email field', async () => {
      const requestBody = {
        // email missing
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
      expect(data.details).toBeDefined()
      expect(data.details[0].path).toEqual(['email'])
      expect(data.details[0].code).toBe('invalid_type')
    })

    it('should return 400 for missing password field', async () => {
      const requestBody = {
        email: 'owner@restaurant.cl',
        // password missing
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
      expect(data.details).toBeDefined()
      expect(data.details[0].path).toEqual(['password'])
      expect(data.details[0].code).toBe('invalid_type')
    })

    it('should return 400 for missing ownerName field', async () => {
      const requestBody = {
        email: 'owner@restaurant.cl',
        password: 'SecurePass123!',
        // ownerName missing
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
      expect(data.details).toBeDefined()
      expect(data.details[0].path).toEqual(['ownerName'])
      expect(data.details[0].code).toBe('invalid_type')
    })

    it('should return 400 for missing restName field', async () => {
      const requestBody = {
        email: 'owner@restaurant.cl',
        password: 'SecurePass123!',
        ownerName: 'María González',
        // restName missing
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
      expect(data.details).toBeDefined()
      expect(data.details[0].path).toEqual(['restName'])
      expect(data.details[0].code).toBe('invalid_type')
    })

    it('should return 400 for missing restAddress field', async () => {
      const requestBody = {
        email: 'owner@restaurant.cl',
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        // restAddress missing
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
      expect(data.details).toBeDefined()
      expect(data.details[0].path).toEqual(['restAddress'])
      expect(data.details[0].code).toBe('invalid_type')
    })

    it('should return 400 for missing restBarrio field', async () => {
      const requestBody = {
        email: 'owner@restaurant.cl',
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        // restBarrio missing
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
      expect(data.details).toBeDefined()
      expect(data.details[0].path).toEqual(['restBarrio'])
      expect(data.details[0].code).toBe('invalid_type')
    })

    it('should return 400 for missing restCocina field', async () => {
      const requestBody = {
        email: 'owner@restaurant.cl',
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia'
        // restCocina missing
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
      expect(data.details).toBeDefined()
      expect(data.details[0].path).toEqual(['restCocina'])
      expect(data.details[0].code).toBe('invalid_type')
    })
  })

  describe('Rollback behavior - Requirement 4.5', () => {
    it('should delete user when restaurant creation fails', async () => {
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: null,
            error: {
              message: 'Database error',
              code: '23505',
              details: 'duplicate key value violates unique constraint',
              hint: ''
            }
          }
        }
      })

      // Mock successful user creation but failed restaurant creation
      mockSupabase.auth.admin = {
        createUser: vi.fn().mockResolvedValue({
          data: { 
            user: {
              id: userId,
              email: 'owner@restaurant.cl',
              created_at: new Date().toISOString(),
              app_metadata: {},
              user_metadata: { owner_name: 'María González' },
              aud: 'authenticated'
            }
          },
          error: null
        }),
        deleteUser: vi.fn().mockResolvedValue({ data: null, error: null })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        email: 'owner@restaurant.cl',
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(500)
      expect(data.error).toBe('No pudimos crear tu restaurante.')

      // Verify user was deleted (rollback)
      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith(userId)
    })

    it('should return partial success when team member creation fails', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const slug = 'test-restaurant-a1b2'

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              slug: slug
            }
          },
          team_members: {
            data: null,
            error: {
              message: 'Database error',
              code: '23505',
              details: 'duplicate key value violates unique constraint',
              hint: ''
            }
          }
        }
      })

      // Mock successful user and restaurant creation but failed team member creation
      mockSupabase.auth.admin = {
        createUser: vi.fn().mockResolvedValue({
          data: { 
            user: {
              id: userId,
              email: 'owner@restaurant.cl',
              created_at: new Date().toISOString(),
              app_metadata: {},
              user_metadata: { owner_name: 'María González' },
              aud: 'authenticated'
            }
          },
          error: null
        }),
        deleteUser: vi.fn().mockResolvedValue({ data: null, error: null })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        email: 'owner@restaurant.cl',
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(500)
      expect(data.error).toBe('Cuenta creada pero no pudimos asignar tu rol. Contacta soporte.')

      // Verify user was NOT deleted (no rollback for team member failure)
      expect(mockSupabase.auth.admin.deleteUser).not.toHaveBeenCalled()
    })
  })

  describe('Server errors', () => {
    it('should return 500 for unexpected user creation error', async () => {
      const mockSupabase = createSupabaseMock({})

      // Mock unexpected user creation error
      mockSupabase.auth.admin = {
        createUser: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Unexpected database error' }
        }),
        deleteUser: vi.fn().mockResolvedValue({ data: null, error: null })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        email: 'owner@restaurant.cl',
        password: 'SecurePass123!',
        ownerName: 'María González',
        restName: 'El Rincón de Don José',
        restAddress: 'Av. Italia 1234',
        restBarrio: 'Providencia',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await POST(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(500)
      expect(data.error).toBe('No pudimos crear tu cuenta.')
    })

    it('should return 500 for malformed JSON', async () => {
      const request = new Request('http://localhost:3000/api/auth/register-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json'
      })

      const response = await POST(request as any)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(500)
      expect(data.error).toBe('Error interno')
    })
  })
})