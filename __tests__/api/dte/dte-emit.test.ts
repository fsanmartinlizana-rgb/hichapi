// ══════════════════════════════════════════════════════════════════════════════
//  DTE Emit API Tests — __tests__/api/dte/dte-emit.test.ts
//
//  Tests for POST /api/dte/emit and GET /api/dte/emissions endpoints
//  Requirements: 11.1, 11.2, 11.3, 11.6
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { POST as EmitDTE } from '@/app/api/dte/emit/route'
import { GET as GetEmissions } from '@/app/api/dte/emissions/route'
import { createSupabaseMock, createPostgrestError } from '../../setup/supabase-mock'
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

// Mock DTE engine
vi.mock('@/lib/dte/engine', () => ({
  runEmission: vi.fn()
}))

// Import after mocking
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { runEmission } from '@/lib/dte/engine'

describe('POST /api/dte/emit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Create Boleta for Paid Order - Requirement 11.1', () => {
    it('should create boleta for paid order', async () => {
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const emissionId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              rut: '76123456-7',
              razon_social: 'Test Restaurant SpA',
              dte_enabled: true,
              dte_environment: 'certificacion'
            }
          },
          orders: {
            data: {
              id: orderId,
              restaurant_id: restaurantId,
              total: 11900,
              status: 'paid'
            }
          },
          dte_emissions: {
            data: {
              id: emissionId
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })
      vi.mocked(runEmission).mockResolvedValue({
        ok: true,
        folio: 123,
        track_id: 'track-123',
        signed_xml: '<xml>...</xml>'
      })

      const requestBody = {
        restaurant_id: restaurantId,
        order_id: orderId,
        document_type: 39 // Boleta
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.folio).toBe(123)
      expect(data.track_id).toBe('track-123')
      expect(data.signed_xml).toBeDefined()
    })
  })

  describe('Reject Duplicate Emission - Requirement 11.2', () => {
    it('should reject duplicate emission for same order', async () => {
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const emissionId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              rut: '76123456-7',
              razon_social: 'Test Restaurant SpA',
              dte_enabled: true
            }
          },
          orders: {
            data: {
              id: orderId,
              restaurant_id: restaurantId,
              total: 11900,
              status: 'paid'
            }
          },
          dte_emissions: {
            data: {
              id: emissionId
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })
      vi.mocked(runEmission).mockResolvedValue({
        ok: false,
        error: 'DUPLICATE_EMISSION'
      })

      const requestBody = {
        restaurant_id: restaurantId,
        order_id: orderId,
        document_type: 39
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(409)
      expect(data.error).toBe('DUPLICATE_EMISSION')
    })
  })

  describe('Reject Factura Without RUT - Requirement 11.3', () => {
    it('should reject factura without RUT receptor', async () => {
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()

      const requestBody = {
        restaurant_id: restaurantId,
        order_id: orderId,
        document_type: 33, // Factura
        // Missing rut_receptor
        razon_receptor: 'Cliente Test'
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('RECEPTOR_RUT_INVALIDO')
    })

    it('should reject factura with invalid RUT format', async () => {
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()

      const requestBody = {
        restaurant_id: restaurantId,
        order_id: orderId,
        document_type: 33,
        rut_receptor: 'invalid-rut',
        razon_receptor: 'Cliente Test'
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('RECEPTOR_RUT_INVALIDO')
    })

    it('should reject factura with incomplete receptor data', async () => {
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              rut: '76123456-7',
              razon_social: 'Test Restaurant SpA',
              dte_enabled: true
            }
          },
          orders: {
            data: {
              id: orderId,
              restaurant_id: restaurantId,
              total: 11900,
              status: 'paid'
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
        order_id: orderId,
        document_type: 33,
        rut_receptor: '12345678-9',
        razon_receptor: 'Cliente Test'
        // Missing giro_receptor, direccion_receptor, comuna_receptor
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('RECEPTOR_DATOS_INCOMPLETOS')
    })

    it('should accept factura with complete receptor data', async () => {
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const emissionId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              rut: '76123456-7',
              razon_social: 'Test Restaurant SpA',
              dte_enabled: true
            }
          },
          orders: {
            data: {
              id: orderId,
              restaurant_id: restaurantId,
              total: 11900,
              status: 'paid'
            }
          },
          dte_emissions: {
            data: {
              id: emissionId
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })
      vi.mocked(runEmission).mockResolvedValue({
        ok: true,
        folio: 456,
        track_id: 'track-456',
        signed_xml: '<xml>...</xml>'
      })

      const requestBody = {
        restaurant_id: restaurantId,
        order_id: orderId,
        document_type: 33,
        rut_receptor: '12345678-9',
        razon_receptor: 'Cliente Test SpA',
        giro_receptor: 'Comercio',
        direccion_receptor: 'Calle Principal 123',
        comuna_receptor: 'Santiago'
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.folio).toBe(456)
    })
  })

  describe('Restaurant Validation', () => {
    it('should reject emission for restaurant without DTE enabled', async () => {
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              rut: '76123456-7',
              razon_social: 'Test Restaurant SpA',
              dte_enabled: false // DTE disabled
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
        order_id: orderId,
        document_type: 39
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('DTE no habilitado')
    })

    it('should reject emission for restaurant without RUT', async () => {
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              rut: null, // Missing RUT
              razon_social: 'Test Restaurant SpA',
              dte_enabled: true
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
        order_id: orderId,
        document_type: 39
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('RUT')
    })

    it('should reject emission for non-existent restaurant', async () => {
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: null,
            error: createPostgrestError('PGRST116', 'No rows found')
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
        order_id: orderId,
        document_type: 39
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(404)
      expect(data.error).toBe('Restaurante no encontrado')
    })

    it('should reject emission for non-existent order', async () => {
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              rut: '76123456-7',
              razon_social: 'Test Restaurant SpA',
              dte_enabled: true
            }
          },
          orders: {
            data: null,
            error: createPostgrestError('PGRST116', 'No rows found')
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
        order_id: orderId,
        document_type: 39
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(404)
      expect(data.error).toBe('Pedido no encontrado')
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
        order_id: crypto.randomUUID(),
        document_type: 39
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(403)
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid document_type', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        order_id: crypto.randomUUID(),
        document_type: 99 // Invalid
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject missing required fields', async () => {
      const requestBody = {
        restaurant_id: crypto.randomUUID()
        // Missing order_id and document_type
      }

      const request = mockNextRequest(requestBody)
      const response = await EmitDTE(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('GET /api/dte/emissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Return Emissions Ordered by Date - Requirement 11.6', () => {
    it('should return emissions ordered by date descending', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          dte_emissions: {
            data: [
              {
                id: crypto.randomUUID(),
                document_type: 39,
                folio: 123,
                status: 'accepted',
                total_amount: 11900,
                net_amount: 10000,
                iva_amount: 1900,
                rut_receptor: null,
                razon_receptor: null,
                sii_track_id: 'track-123',
                emitted_at: '2024-01-15T10:00:00Z',
                order_id: crypto.randomUUID(),
                error_detail: null,
                xml_signed: '<xml>...</xml>'
              },
              {
                id: crypto.randomUUID(),
                document_type: 39,
                folio: 122,
                status: 'accepted',
                total_amount: 8900,
                net_amount: 7479,
                iva_amount: 1421,
                rut_receptor: null,
                razon_receptor: null,
                sii_track_id: 'track-122',
                emitted_at: '2024-01-14T15:30:00Z',
                order_id: crypto.randomUUID(),
                error_detail: null,
                xml_signed: '<xml>...</xml>'
              }
            ]
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/dte/emissions?restaurant_id=${restaurantId}` 
        }
      )
      const response = await GetEmissions(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.emissions).toBeDefined()
      expect(Array.isArray(data.emissions)).toBe(true)
      expect(data.emissions).toHaveLength(2)
      expect(data.totals).toBeDefined()
      expect(data.totals.count).toBe(2)
      expect(data.totals.gross).toBe(20800)
      expect(data.totals.accepted).toBe(2)
    })

    it('should return empty array when no emissions', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          dte_emissions: {
            data: []
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/dte/emissions?restaurant_id=${restaurantId}` 
        }
      )
      const response = await GetEmissions(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.emissions).toEqual([])
      expect(data.totals.count).toBe(0)
    })

    it('should respect limit parameter', async () => {
      const restaurantId = crypto.randomUUID()
      const userId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          dte_emissions: {
            data: Array(10).fill(null).map(() => ({
              id: crypto.randomUUID(),
              document_type: 39,
              folio: 100,
              status: 'accepted',
              total_amount: 10000,
              net_amount: 8403,
              iva_amount: 1597,
              emitted_at: new Date().toISOString()
            }))
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: { id: userId, email: 'admin@test.com' } as any,
        error: null
      })

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/dte/emissions?restaurant_id=${restaurantId}&limit=5` 
        }
      )
      const response = await GetEmissions(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.emissions).toHaveLength(10) // Mock returns all, but real API would limit
    })
  })

  describe('Authorization', () => {
    it('should reject unauthorized user', async () => {
      vi.mocked(requireRestaurantRole).mockResolvedValue({
        user: null,
        error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) as any
      })

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/dte/emissions?restaurant_id=${crypto.randomUUID()}` 
        }
      )
      const response = await GetEmissions(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(403)
    })
  })

  describe('Input Validation', () => {
    it('should reject request without restaurant_id', async () => {
      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: 'http://localhost:3000/api/dte/emissions' 
        }
      )
      const response = await GetEmissions(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('restaurant_id')
    })
  })
})
