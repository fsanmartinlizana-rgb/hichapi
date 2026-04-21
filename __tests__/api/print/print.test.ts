// ══════════════════════════════════════════════════════════════════════════════
//  Print API Tests — __tests__/api/print/print.test.ts
//
//  Tests for POST /api/print/servers, POST /api/print/jobs, and PATCH /api/print/agent
//  Requirements: 12.1, 12.2, 12.3, 12.4
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { POST as RegisterServer } from '@/app/api/print/servers/route'
import { POST as CreateJob } from '@/app/api/print/jobs/route'
import { PATCH as UpdateJobStatus } from '@/app/api/print/agent/route'
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

describe('POST /api/print/servers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Register Server and Return Token - Requirement 12.1', () => {
    it('should register server and return token', async () => {
      const restaurantId = crypto.randomUUID()
      const serverId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: {
              id: serverId,
              name: 'Kitchen Printer',
              printer_kind: 'network',
              printer_addr: '192.168.1.100',
              paper_width: 32,
              active: true,
              created_at: new Date().toISOString()
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
        name: 'Kitchen Printer',
        printer_kind: 'network',
        printer_addr: '192.168.1.100',
        paper_width: 32
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterServer(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.server).toBeDefined()
      expect(data.server.id).toBe(serverId)
      expect(data.token).toBeDefined()
      expect(typeof data.token).toBe('string')
      expect(data.note).toContain('token')
    })

    it('should create server with default values', async () => {
      const restaurantId = crypto.randomUUID()
      const serverId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: {
              id: serverId,
              name: 'Bar Printer',
              printer_kind: 'network',
              printer_addr: null,
              paper_width: 32,
              active: true,
              created_at: new Date().toISOString()
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
        name: 'Bar Printer'
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterServer(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.server.printer_kind).toBe('network')
      expect(data.server.paper_width).toBe(32)
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
        name: 'Test Printer'
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterServer(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(403)
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid printer_kind', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        name: 'Test Printer',
        printer_kind: 'invalid'
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterServer(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject missing name', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID()
        // Missing name
      }

      const request = mockNextRequest(requestBody)
      const response = await RegisterServer(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('POST /api/print/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Enqueue Kitchen Ticket - Requirement 12.2', () => {
    it('should enqueue kitchen ticket', async () => {
      const restaurantId = crypto.randomUUID()
      const serverId = crypto.randomUUID()
      const jobId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: {
              id: serverId,
              active: true
            }
          },
          print_jobs: {
            data: {
              id: jobId,
              server_id: serverId,
              job_type: 'kitchen_ticket',
              status: 'pending',
              created_at: new Date().toISOString()
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        server_id: serverId,
        job_type: 'kitchen_ticket',
        payload: {
          header: 'Mesa 5',
          lines: [
            { text: '2x Pizza Margherita', align: 'left', bold: true },
            { text: '1x Cerveza', align: 'left' }
          ],
          copies: 1
        }
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateJob(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.job).toBeDefined()
      expect(data.job.id).toBe(jobId)
      expect(data.job.job_type).toBe('kitchen_ticket')
      expect(data.job.status).toBe('pending')
    })

    it('should enqueue bar ticket', async () => {
      const restaurantId = crypto.randomUUID()
      const serverId = crypto.randomUUID()
      const jobId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: {
              id: serverId,
              active: true
            }
          },
          print_jobs: {
            data: {
              id: jobId,
              server_id: serverId,
              job_type: 'bar_ticket',
              status: 'pending',
              created_at: new Date().toISOString()
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        server_id: serverId,
        job_type: 'bar_ticket',
        payload: {
          lines: [
            { text: '3x Pisco Sour', align: 'left', bold: true }
          ],
          copies: 1
        }
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateJob(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.job.job_type).toBe('bar_ticket')
    })
  })

  describe('Reject Non-Existent Server - Requirement 12.3', () => {
    it('should reject job for non-existent server', async () => {
      const restaurantId = crypto.randomUUID()
      const serverId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: null // Server not found
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        server_id: serverId,
        job_type: 'kitchen_ticket',
        payload: {
          lines: [{ text: 'Test' }],
          copies: 1
        }
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateJob(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(404)
      expect(data.error).toContain('no encontrado')
    })

    it('should reject job for inactive server', async () => {
      const restaurantId = crypto.randomUUID()
      const serverId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: {
              id: serverId,
              active: false // Inactive
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        server_id: serverId,
        job_type: 'kitchen_ticket',
        payload: {
          lines: [{ text: 'Test' }],
          copies: 1
        }
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateJob(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('inactivo')
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid job_type', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        server_id: crypto.randomUUID(),
        job_type: 'invalid_type',
        payload: {
          lines: [{ text: 'Test' }],
          copies: 1
        }
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateJob(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject payload with too many lines', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        server_id: crypto.randomUUID(),
        job_type: 'kitchen_ticket',
        payload: {
          lines: Array(201).fill({ text: 'Line' }), // Exceeds max 200
          copies: 1
        }
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateJob(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('PATCH /api/print/agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Update Job Status to Completed - Requirement 12.4', () => {
    it('should update job status to completed', async () => {
      const serverId = crypto.randomUUID()
      const jobId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: {
              id: serverId,
              restaurant_id: crypto.randomUUID(),
              name: 'Kitchen Printer',
              active: true
            }
          },
          print_jobs: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        job_id: jobId,
        status: 'completed'
      }

      const request = mockNextRequest(requestBody, {
        'Authorization': 'Bearer mock-token-123'
      }, { method: 'PATCH' })
      const response = await UpdateJobStatus(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
    })

    it('should update job status to failed with error message', async () => {
      const serverId = crypto.randomUUID()
      const jobId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: {
              id: serverId,
              restaurant_id: crypto.randomUUID(),
              name: 'Kitchen Printer',
              active: true
            }
          },
          print_jobs: {
            data: {
              attempts: 1
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        job_id: jobId,
        status: 'failed',
        error_message: 'Printer offline'
      }

      const request = mockNextRequest(requestBody, {
        'Authorization': 'Bearer mock-token-123'
      }, { method: 'PATCH' })
      const response = await UpdateJobStatus(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
    })

    it('should update job status to printing', async () => {
      const serverId = crypto.randomUUID()
      const jobId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: {
              id: serverId,
              restaurant_id: crypto.randomUUID(),
              name: 'Kitchen Printer',
              active: true
            }
          },
          print_jobs: {
            data: {
              attempts: 0
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        job_id: jobId,
        status: 'printing'
      }

      const request = mockNextRequest(requestBody, {
        'Authorization': 'Bearer mock-token-123'
      }, { method: 'PATCH' })
      const response = await UpdateJobStatus(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
    })
  })

  describe('Authentication', () => {
    it('should reject request without token', async () => {
      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: null // No server found for token
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        job_id: crypto.randomUUID(),
        status: 'completed'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await UpdateJobStatus(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(401)
      expect(data.error).toContain('Token')
    })

    it('should reject request with invalid token', async () => {
      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: null // No server found for token
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        job_id: crypto.randomUUID(),
        status: 'completed'
      }

      const request = mockNextRequest(requestBody, {
        'Authorization': 'Bearer invalid-token'
      }, { method: 'PATCH' })
      const response = await UpdateJobStatus(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(401)
      expect(data.error).toContain('Token')
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid status', async () => {
      const serverId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: {
              id: serverId,
              restaurant_id: crypto.randomUUID(),
              active: true
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        job_id: crypto.randomUUID(),
        status: 'invalid_status'
      }

      const request = mockNextRequest(requestBody, {
        'Authorization': 'Bearer mock-token-123'
      }, { method: 'PATCH' })
      const response = await UpdateJobStatus(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})
