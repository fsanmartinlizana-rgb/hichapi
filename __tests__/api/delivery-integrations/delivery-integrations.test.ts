// ══════════════════════════════════════════════════════════════════════════════
//  Delivery Integrations API Tests — __tests__/api/delivery-integrations/delivery-integrations.test.ts
//
//  Tests for POST, DELETE /api/delivery-integrations endpoints
//  Requirements: 13.1, 13.2, 13.3, 13.5
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { POST as UpsertIntegration, DELETE as DeleteIntegration } from '@/app/api/delivery-integrations/route'
import { createSupabaseMock } from '../../setup/supabase-mock'
import { 
  mockNextRequest, 
  extractResponse
} from '../../setup/test-helpers'

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn()
}))

// Mock the auth guard module
vi.mock('@/lib/supabase/auth-guard', () => ({
  requireRestaurantRole: vi.fn()
}))

// Import after mocking
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

describe('POST /api/delivery-integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Create/Update Integration for Valid Platform - Requirement 13.1', () => {
    it('should create integration for valid platform', async () => {
      const restaurantId = crypto.randomUUID()
      const integrationId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          delivery_integrations: {
            data: {
              id: integrationId,
              restaurant_id: restaurantId,
              platform: 'pedidosya',
              status: 'connected',
              external_id: 'ext-123',
              api_key_hint: '••••5678',
              auto_sync_menu: false
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        platform: 'pedidosya',
        external_id: 'ext-123',
        api_key: 'secret-key-12345678',
        auto_sync_menu: false
      }

      const request = mockNextRequest(requestBody)
      const response = await UpsertIntegration(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.integration).toBeDefined()
      expect(data.integration.platform).toBe('pedidosya')
      expect(data.integration.api_key_hint).toBe('••••5678')
    })

    it('should update existing integration', async () => {
      const restaurantId = crypto.randomUUID()
      const integrationId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          delivery_integrations: {
            data: {
              id: integrationId,
              restaurant_id: restaurantId,
              platform: 'rappi',
              status: 'connected',
              external_id: 'ext-456',
              api_key_hint: '••••9012',
              auto_sync_menu: true
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        platform: 'rappi',
        external_id: 'ext-456',
        api_key: 'new-secret-key-9012',
        auto_sync_menu: true
      }

      const request = mockNextRequest(requestBody)
      const response = await UpsertIntegration(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.integration).toBeDefined()
      expect(data.integration.platform).toBe('rappi')
    })

    it('should support all valid platforms', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()
      const platforms = ['pedidosya', 'rappi', 'uber_eats', 'justo', 'didi_food', 'cornershop']

      for (const platform of platforms) {
        const integrationId = crypto.randomUUID()

        const mockSupabase = createSupabaseMock({
          tables: {
            delivery_integrations: {
              data: {
                id: integrationId,
                restaurant_id: restaurantId,
                platform,
                status: 'connected'
              }
            }
          }
        })

        vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
        vi.mocked(requireRestaurantRole).mockResolvedValue({
          user: { id: userId, email: 'admin@test.com' } as any,
          error: null
        })

        const requestBody = {
          restaurant_id: restaurantId,
          platform,
          external_id: `ext-${platform}`,
          api_key: `key-${platform}`
        }

        const request = mockNextRequest(requestBody)
        const response = await UpsertIntegration(request)
        const { status, data } = await extractResponse(response)

        expect(status).toBe(201)
        expect(data.integration.platform).toBe(platform)
      }
    })
  })

  describe('Reject Invalid Platform - Requirement 13.2', () => {
    it('should reject invalid platform', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        platform: 'invalid_platform',
        external_id: 'ext-123',
        api_key: 'secret-key'
      }

      const request = mockNextRequest(requestBody)
      const response = await UpsertIntegration(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })

  describe('Store Only Last 4 Characters as Hint - Requirement 13.3', () => {
    it('should store only last 4 characters of API key as hint', async () => {
      const restaurantId = crypto.randomUUID()
      const integrationId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          delivery_integrations: {
            data: {
              id: integrationId,
              restaurant_id: restaurantId,
              platform: 'uber_eats',
              status: 'connected',
              api_key_hint: '••••ABCD'
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        platform: 'uber_eats',
        api_key: 'very-long-secret-key-ABCD'
      }

      const request = mockNextRequest(requestBody)
      const response = await UpsertIntegration(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.integration.api_key_hint).toBe('••••ABCD')
      // Verify full key is never returned
      expect(data.integration.api_key).toBeUndefined()
    })

    it('should handle short API keys correctly', async () => {
      const restaurantId = crypto.randomUUID()
      const integrationId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          delivery_integrations: {
            data: {
              id: integrationId,
              restaurant_id: restaurantId,
              platform: 'justo',
              status: 'connected',
              api_key_hint: '••••123'
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        platform: 'justo',
        api_key: '123' // Only 3 characters
      }

      const request = mockNextRequest(requestBody)
      const response = await UpsertIntegration(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.integration.api_key_hint).toBe('••••123')
    })
  })

  describe('Authorization', () => {
    it('should reject unauthorized user', async () => {
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: null,
        error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) as any
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        platform: 'pedidosya',
        api_key: 'secret-key'
      }

      const request = mockNextRequest(requestBody)
      const response = await UpsertIntegration(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(403)
    })
  })

  describe('Input Validation', () => {
    it('should reject missing restaurant_id', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        platform: 'pedidosya',
        api_key: 'secret-key'
        // Missing restaurant_id
      }

      const request = mockNextRequest(requestBody)
      const response = await UpsertIntegration(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject missing platform', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        api_key: 'secret-key'
        // Missing platform
      }

      const request = mockNextRequest(requestBody)
      const response = await UpsertIntegration(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('DELETE /api/delivery-integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Disconnect Integration - Requirement 13.5', () => {
    it('should disconnect integration', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          delivery_integrations: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        platform: 'pedidosya'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DeleteIntegration(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
    })

    it('should disconnect all valid platforms', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()
      const platforms = ['pedidosya', 'rappi', 'uber_eats', 'justo', 'didi_food', 'cornershop']

      for (const platform of platforms) {
        const mockSupabase = createSupabaseMock({
          tables: {
            delivery_integrations: {
              data: null
            }
          }
        })

        vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
        vi.mocked(requireRestaurantRole).mockResolvedValue({
          user: { id: userId, email: 'admin@test.com' } as any,
          error: null
        })

        const requestBody = {
          restaurant_id: restaurantId,
          platform
        }

        const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
        const response = await DeleteIntegration(request)
        const { status, data } = await extractResponse(response)

        expect(status).toBe(200)
        expect(data.ok).toBe(true)
      }
    })
  })

  describe('Authorization', () => {
    it('should reject unauthorized user', async () => {
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: null,
        error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) as any
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        platform: 'pedidosya'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DeleteIntegration(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(403)
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid platform', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        platform: 'invalid_platform'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DeleteIntegration(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject missing required fields', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID()
        // Missing platform
      }

      const request = mockNextRequest(requestBody, {}, { method: 'DELETE' })
      const response = await DeleteIntegration(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})
