// ══════════════════════════════════════════════════════════════════════════════
//  Team API Tests — __tests__/api/team/team.test.ts
//
//  Tests for POST /api/auth/register-restaurant and POST /api/team/invite endpoints
//  Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as RegisterRestaurant } from '@/app/api/auth/register-restaurant/route'
import { POST as InviteTeamMember } from '@/app/api/team/invite/route'
import { NextResponse } from 'next/server'
import { createSupabaseMock, createPostgrestError, createAuthError } from '../../setup/supabase-mock'
import { 
  mockNextRequest, 
  extractResponse,
  createTestUser,
  createTestRestaurant
} from '../../setup/test-helpers'

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn()
}))

// Mock the auth guard module
vi.mock('@/lib/supabase/auth-guard', () => ({
  requireRestaurantRole: vi.fn()
}))

// Mock email sender
vi.mock('@/lib/email/sender', () => ({
  sendBrandedEmail: vi.fn().mockResolvedValue({ ok: true, skipped: false })
}))

// Mock invite token
vi.mock('@/lib/invite-token', () => ({
  createInviteToken: vi.fn().mockReturnValue('mock-invite-token-123')
}))

// Import after mocking
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

describe('POST /api/auth/register-restaurant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Atomic Registration - Requirement 8.1', () => {
    it('should create user, restaurant, and team_member atomically', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { id: restaurantId, slug: 'test-restaurant-abc' }
          },
          team_members: {
            data: null
          }
        }
      })

      // Mock auth.admin.createUser
      mockSupabase.auth.admin = {
        createUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId, email: 'owner@test.com' } },
          error: null
        }),
        deleteUser: vi.fn().mockResolvedValue({ error: null })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        email: 'owner@test.com',
        password: 'SecurePassword123!',
        ownerName: 'Juan Pérez',
        restName: 'Mi Restaurante',
        restAddress: 'Calle Principal 123',
        restBarrio: 'Centro',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterRestaurant(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.user_id).toBe(userId)
      expect(data.restaurant_id).toBe(restaurantId)
      expect(data.slug).toBeDefined()

      // Verify auth.admin.createUser was called
      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'owner@test.com',
          password: 'SecurePassword123!',
          email_confirm: true
        })
      )

      // Verify restaurant was created
      expect(mockSupabase.from).toHaveBeenCalledWith('restaurants')

      // Verify team_member was created
      expect(mockSupabase.from).toHaveBeenCalledWith('team_members')
    })

    it('should rollback restaurant creation if team_member creation fails', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { id: restaurantId, slug: 'test-restaurant-abc' }
          },
          team_members: {
            data: null,
            error: createPostgrestError('23505', 'Duplicate key')
          }
        }
      })

      mockSupabase.auth.admin = {
        createUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId, email: 'owner@test.com' } },
          error: null
        }),
        deleteUser: vi.fn().mockResolvedValue({ error: null })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        email: 'owner@test.com',
        password: 'SecurePassword123!',
        ownerName: 'Juan Pérez',
        restName: 'Mi Restaurante',
        restAddress: 'Calle Principal 123',
        restBarrio: 'Centro',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterRestaurant(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(500)
      expect(data.error).toContain('rol')
    })
  })

  describe('Duplicate Email Rejection - Requirement 8.2', () => {
    it('should reject registration with duplicate email', async () => {
      const mockSupabase = createSupabaseMock({})

      mockSupabase.auth.admin = {
        createUser: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'User already been registered' }
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        email: 'existing@test.com',
        password: 'SecurePassword123!',
        ownerName: 'Juan Pérez',
        restName: 'Mi Restaurante',
        restAddress: 'Calle Principal 123',
        restBarrio: 'Centro',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterRestaurant(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(409)
      expect(data.error).toContain('email ya tiene una cuenta')
    })

    it('should not create partial records on duplicate email', async () => {
      const mockSupabase = createSupabaseMock({})

      mockSupabase.auth.admin = {
        createUser: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'User already exists' }
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        email: 'existing@test.com',
        password: 'SecurePassword123!',
        ownerName: 'Juan Pérez',
        restName: 'Mi Restaurante',
        restAddress: 'Calle Principal 123',
        restBarrio: 'Centro',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      await RegisterRestaurant(request)

      // Verify restaurant creation was never attempted
      expect(mockSupabase.from).not.toHaveBeenCalledWith('restaurants')
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid email format', async () => {
      const requestBody = {
        email: 'not-an-email',
        password: 'SecurePassword123!',
        ownerName: 'Juan Pérez',
        restName: 'Mi Restaurante',
        restAddress: 'Calle Principal 123',
        restBarrio: 'Centro',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterRestaurant(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject password shorter than 12 characters', async () => {
      const requestBody = {
        email: 'owner@test.com',
        password: 'Short1!',
        ownerName: 'Juan Pérez',
        restName: 'Mi Restaurante',
        restAddress: 'Calle Principal 123',
        restBarrio: 'Centro',
        restCocina: 'Italiana'
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterRestaurant(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject missing required fields', async () => {
      const requestBody = {
        email: 'owner@test.com',
        password: 'SecurePassword123!'
        // Missing ownerName, restName, etc.
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterRestaurant(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('POST /api/team/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Valid Invitation Creation - Requirement 8.3', () => {
    it('should create invitation with valid role', async () => {
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          custom_roles: {
            data: []
          },
          team_members: {
            data: null
          },
          restaurants: {
            data: { id: restaurantId, name: 'Test Restaurant' }
          }
        }
      })

      mockSupabase.auth.admin = {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [] }
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({ error: null } as any)

      const requestBody = {
        email: 'newmember@test.com',
        role: 'admin',
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await InviteTeamMember(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.action_link).toBeDefined()
      expect(data.action_link).toContain('aceptar-invitacion')
    })

    it('should support multiple roles in invitation', async () => {
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          custom_roles: {
            data: []
          },
          team_members: {
            data: null
          },
          restaurants: {
            data: { id: restaurantId, name: 'Test Restaurant' }
          }
        }
      })

      mockSupabase.auth.admin = {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [] }
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({ error: null } as any)

      const requestBody = {
        email: 'newmember@test.com',
        roles: ['admin', 'supervisor'],
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await InviteTeamMember(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
    })
  })

  describe('Invalid Role Rejection - Requirement 8.4', () => {
    it('should reject invitation with invalid custom role UUID', async () => {
      const restaurantId = crypto.randomUUID()
      const invalidRoleId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          custom_roles: {
            data: [] // No matching custom role
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({ error: null } as any)

      const requestBody = {
        email: 'newmember@test.com',
        role: invalidRoleId,
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await InviteTeamMember(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('Roles custom inválidos')
    })
  })

  describe('Role-Based Access Control - Requirement 8.5', () => {
    it('should reject invitation from garzon role', async () => {
      const restaurantId = crypto.randomUUID()

      vi.mocked(requireRestaurantRole).mockResolvedValue({
        error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) as any
      } as any)

      const requestBody = {
        email: 'newmember@test.com',
        role: 'admin',
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await InviteTeamMember(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(403)
    })

    it('should allow invitation from admin role', async () => {
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          custom_roles: {
            data: []
          },
          team_members: {
            data: null
          },
          restaurants: {
            data: { id: restaurantId, name: 'Test Restaurant' }
          }
        }
      })

      mockSupabase.auth.admin = {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [] }
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({ error: null } as any)

      const requestBody = {
        email: 'newmember@test.com',
        role: 'garzon',
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await InviteTeamMember(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
    })

    it('should allow invitation from owner role', async () => {
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          custom_roles: {
            data: []
          },
          team_members: {
            data: null
          },
          restaurants: {
            data: { id: restaurantId, name: 'Test Restaurant' }
          }
        }
      })

      mockSupabase.auth.admin = {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [] }
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({ error: null } as any)

      const requestBody = {
        email: 'newmember@test.com',
        role: 'supervisor',
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await InviteTeamMember(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
    })
  })

  describe('Existing User Handling', () => {
    it('should activate existing user immediately', async () => {
      const restaurantId = crypto.randomUUID()
      const existingUserId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          custom_roles: {
            data: []
          },
          team_members: {
            data: null
          },
          restaurants: {
            data: { id: restaurantId, name: 'Test Restaurant' }
          }
        }
      })

      mockSupabase.auth.admin = {
        listUsers: vi.fn().mockResolvedValue({
          data: {
            users: [
              { id: existingUserId, email: 'existing@test.com' }
            ]
          }
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({ error: null } as any)

      const requestBody = {
        email: 'existing@test.com',
        role: 'admin',
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await InviteTeamMember(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.existing_user).toBe(true)
    })
  })

  describe('Input Validation', () => {
    it('should reject invitation without role', async () => {
      const restaurantId = crypto.randomUUID()

      const requestBody = {
        email: 'newmember@test.com',
        restaurant_id: restaurantId
        // Missing role
      }

      const request = mockNextRequest(requestBody)
      const response = await InviteTeamMember(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject invitation with invalid email', async () => {
      const restaurantId = crypto.randomUUID()

      const requestBody = {
        email: 'not-an-email',
        role: 'admin',
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await InviteTeamMember(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject invitation with invalid restaurant_id', async () => {
      const requestBody = {
        email: 'newmember@test.com',
        role: 'admin',
        restaurant_id: 'not-a-uuid'
      }

      const request = mockNextRequest(requestBody)
      const response = await InviteTeamMember(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})
