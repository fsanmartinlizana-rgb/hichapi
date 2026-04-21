// ══════════════════════════════════════════════════════════════════════════════
//  Notifications API Tests — __tests__/api/notifications/notifications.test.ts
//
//  Tests for POST /api/notifications, PATCH /api/notifications/:id, and POST /api/notifications/mark-all-read
//  Requirements: 14.1, 14.2, 14.3, 14.5
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { POST as CreateNotification } from '@/app/api/notifications/route'
import { POST as MarkAllRead } from '@/app/api/notifications/mark-all-read/route'
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
  requireUser: vi.fn()
}))

// Mock notifications server module
vi.mock('@/lib/notifications/server', () => ({
  createNotification: vi.fn()
}))

// Import after mocking
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { createNotification as createNotificationHelper } from '@/lib/notifications/server'

describe('POST /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Create Notification - Requirement 14.1', () => {
    it('should create notification with valid data', async () => {
      const restaurantId = crypto.randomUUID()
      const notificationId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: {
              id: crypto.randomUUID(),
              user_id: userId,
              restaurant_id: restaurantId,
              active: true,
              role: 'admin'
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })
      vi.mocked(createNotificationHelper).mockResolvedValue({
        id: notificationId,
        restaurant_id: restaurantId,
        type: 'stock_low',
        title: 'Stock bajo',
        message: 'El stock de tomates está bajo',
        severity: 'warning',
        category: 'inventario',
        is_read: false,
        created_at: new Date().toISOString()
      } as any)

      const requestBody = {
        restaurant_id: restaurantId,
        type: 'stock_low',
        title: 'Stock bajo',
        message: 'El stock de tomates está bajo',
        severity: 'warning',
        category: 'inventario'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateNotification(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.notification).toBeDefined()
      expect(data.notification.id).toBe(notificationId)
      expect(data.notification.type).toBe('stock_low')
    })

    it('should create notification with minimal fields', async () => {
      const restaurantId = crypto.randomUUID()
      const notificationId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: {
              id: crypto.randomUUID(),
              user_id: userId,
              restaurant_id: restaurantId,
              active: true
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })
      vi.mocked(createNotificationHelper).mockResolvedValue({
        id: notificationId,
        restaurant_id: restaurantId,
        type: 'info',
        title: 'Información',
        is_read: false,
        created_at: new Date().toISOString()
      } as any)

      const requestBody = {
        restaurant_id: restaurantId,
        type: 'info',
        title: 'Información'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateNotification(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.notification).toBeDefined()
    })
  })

  describe('Handle Dedupe Key - Requirement 14.5', () => {
    it('should handle dedupe_key to prevent duplicates', async () => {
      const restaurantId = crypto.randomUUID()
      const notificationId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: {
              id: crypto.randomUUID(),
              user_id: userId,
              restaurant_id: restaurantId,
              active: true
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })
      vi.mocked(createNotificationHelper).mockResolvedValue({
        id: notificationId,
        restaurant_id: restaurantId,
        type: 'order_ready',
        title: 'Orden lista',
        dedupe_key: 'order-123-ready',
        is_read: false,
        created_at: new Date().toISOString()
      } as any)

      const requestBody = {
        restaurant_id: restaurantId,
        type: 'order_ready',
        title: 'Orden lista',
        dedupe_key: 'order-123-ready'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateNotification(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(201)
      expect(data.notification).toBeDefined()
      expect(createNotificationHelper).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupe_key: 'order-123-ready'
        })
      )
    })
  })

  describe('Authorization', () => {
    it('should reject unauthenticated user', async () => {
      vi.mocked(requireUser).mockResolvedValue({
        user: null,
        error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) as any
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        type: 'info',
        title: 'Test'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateNotification(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(401)
    })

    it('should reject user not member of restaurant', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: null // Not a member
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'user@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        type: 'info',
        title: 'Test'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateNotification(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(403)
      expect(data.error).toContain('denegado')
    })
  })

  describe('Input Validation', () => {
    it('should reject missing required fields', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID()
        // Missing type and title
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateNotification(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject invalid severity', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        type: 'info',
        title: 'Test',
        severity: 'invalid_severity'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateNotification(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject invalid category', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        type: 'info',
        title: 'Test',
        category: 'invalid_category'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateNotification(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('POST /api/notifications/mark-all-read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Mark All as Read - Requirement 14.3', () => {
    it('should mark all notifications as read', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: {
              id: crypto.randomUUID(),
              user_id: userId,
              restaurant_id: restaurantId,
              active: true
            }
          },
          notifications: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await MarkAllRead(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should work for super_admin', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: {
              id: crypto.randomUUID(),
              user_id: userId,
              role: 'super_admin',
              active: true
            }
          },
          notifications: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'superadmin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await MarkAllRead(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Authorization', () => {
    it('should reject unauthenticated user', async () => {
      vi.mocked(requireUser).mockResolvedValue({
        user: null,
        error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) as any
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID()
      }

      const request = mockNextRequest(requestBody)
      const response = await MarkAllRead(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(401)
    })

    it('should reject user not member of restaurant', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: null // Not a member
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'user@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId
      }

      const request = mockNextRequest(requestBody)
      const response = await MarkAllRead(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(403)
      expect(data.error).toContain('denegado')
    })
  })

  describe('Input Validation', () => {
    it('should reject missing restaurant_id', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {}

      const request = mockNextRequest(requestBody)
      const response = await MarkAllRead(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject invalid restaurant_id format', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: 'not-a-uuid'
      }

      const request = mockNextRequest(requestBody)
      const response = await MarkAllRead(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})
