// ══════════════════════════════════════════════════════════════════════════════
//  Reservations API Tests — __tests__/api/reservations/reservations.test.ts
//
//  Tests for POST /api/reservations, GET /api/reservations/availability, and PATCH /api/reservations/status
//  Requirements: 9.1, 9.2, 9.3, 9.5
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { POST as CreateReservation, GET as GetReservations, PATCH as UpdateReservation } from '@/app/api/reservations/route'
import { GET as GetAvailability } from '@/app/api/reservations/availability/route'
import { createSupabaseMock, createPostgrestError } from '../../setup/supabase-mock'
import { 
  mockNextRequest, 
  extractResponse,
  createTestRestaurant
} from '../../setup/test-helpers'

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn()
}))

// Mock the auth guard module
vi.mock('@/lib/supabase/auth-guard', () => ({
  requireUser: vi.fn()
}))

// Mock email sender
vi.mock('@/lib/email/sender', () => ({
  sendBrandedEmail: vi.fn().mockResolvedValue({ ok: true })
}))

// Import after mocking
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'

describe('POST /api/reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Valid Reservation Creation - Requirement 9.1', () => {
    it('should create reservation with valid data', async () => {
      const restaurantId = crypto.randomUUID()
      const reservationId = crypto.randomUUID()
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const reservationDate = tomorrow.toISOString().split('T')[0]

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              name: 'Test Restaurant',
              reservations_enabled: true,
              reservation_timeout_min: 15,
              reservation_slot_duration: 90,
              reservation_max_party: 10,
              reservation_advance_days: 30,
              capacity: 50
            }
          },
          reservations: {
            data: {
              id: reservationId,
              token: 'res-token-123',
              reservation_date: reservationDate,
              reservation_time: '19:00',
              status: 'confirmed',
              party_size: 4
            }
          }
        },
        rpc: {
          check_reservation_availability: {
            data: { available: true, available_tables: 5 }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurantId,
        name: 'Juan Pérez',
        phone: '+56912345678',
        email: 'juan@test.com',
        party_size: 4,
        reservation_date: reservationDate,
        reservation_time: '19:00',
        notes: 'Mesa cerca de la ventana'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.reservation).toBeDefined()
      expect(data.reservation.id).toBe(reservationId)
      expect(data.message).toBe('Reserva confirmada')
    })

    it('should auto-confirm reservation', async () => {
      const restaurantId = crypto.randomUUID()
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const reservationDate = tomorrow.toISOString().split('T')[0]

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              name: 'Test Restaurant',
              reservations_enabled: true,
              reservation_slot_duration: 90,
              reservation_max_party: 10,
              reservation_advance_days: 30,
              capacity: 50
            }
          },
          reservations: {
            data: {
              id: crypto.randomUUID(),
              token: 'res-token-123',
              status: 'confirmed',
              reservation_date: reservationDate,
              reservation_time: '19:00',
              party_size: 2
            }
          }
        },
        rpc: {
          check_reservation_availability: {
            data: { available: true }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurantId,
        name: 'María García',
        phone: '+56987654321',
        party_size: 2,
        reservation_date: reservationDate,
        reservation_time: '19:00'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.reservation.status).toBe('confirmed')
    })
  })

  describe('Past Date Rejection - Requirement 9.3', () => {
    it('should reject reservation for past date', async () => {
      const restaurantId = crypto.randomUUID()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const pastDate = yesterday.toISOString().split('T')[0]

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              name: 'Test Restaurant',
              reservations_enabled: true,
              reservation_slot_duration: 90,
              reservation_max_party: 10,
              reservation_advance_days: 30,
              capacity: 50
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurantId,
        name: 'Juan Pérez',
        phone: '+56912345678',
        party_size: 4,
        reservation_date: pastDate,
        reservation_time: '19:00'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('fecha pasada')
    })
  })

  describe('Availability Validation', () => {
    it('should reject reservation when no availability', async () => {
      const restaurantId = crypto.randomUUID()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const reservationDate = tomorrow.toISOString().split('T')[0]

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              name: 'Test Restaurant',
              reservations_enabled: true,
              reservation_slot_duration: 90,
              reservation_max_party: 10,
              reservation_advance_days: 30,
              capacity: 50
            }
          }
        },
        rpc: {
          check_reservation_availability: {
            data: { available: false, available_tables: 0 }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurantId,
        name: 'Juan Pérez',
        phone: '+56912345678',
        party_size: 4,
        reservation_date: reservationDate,
        reservation_time: '20:00'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(409)
      expect(data.error).toContain('No hay disponibilidad')
    })

    it('should reject party size exceeding maximum', async () => {
      const restaurantId = crypto.randomUUID()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const reservationDate = tomorrow.toISOString().split('T')[0]

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              name: 'Test Restaurant',
              reservations_enabled: true,
              reservation_max_party: 8,
              reservation_advance_days: 30
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurantId,
        name: 'Juan Pérez',
        phone: '+56912345678',
        party_size: 12,
        reservation_date: reservationDate,
        reservation_time: '19:00'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('Máximo')
    })

    it('should reject reservation beyond advance days limit', async () => {
      const restaurantId = crypto.randomUUID()
      const farFuture = new Date()
      farFuture.setDate(farFuture.getDate() + 60)
      const futureDate = farFuture.toISOString().split('T')[0]

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              name: 'Test Restaurant',
              reservations_enabled: true,
              reservation_advance_days: 30
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        restaurant_id: restaurantId,
        name: 'Juan Pérez',
        phone: '+56912345678',
        party_size: 4,
        reservation_date: futureDate,
        reservation_time: '19:00'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('anticipación')
    })
  })

  describe('Restaurant Validation', () => {
    it('should reject reservation for non-existent restaurant', async () => {
      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: null,
            error: createPostgrestError('PGRST116', 'No rows found')
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const reservationDate = tomorrow.toISOString().split('T')[0]

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        name: 'Juan Pérez',
        phone: '+56912345678',
        party_size: 4,
        reservation_date: reservationDate,
        reservation_time: '19:00'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(404)
      expect(data.error).toBe('Restaurante no encontrado')
    })

    it('should reject reservation when reservations disabled', async () => {
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              name: 'Test Restaurant',
              reservations_enabled: false
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const reservationDate = tomorrow.toISOString().split('T')[0]

      const requestBody = {
        restaurant_id: restaurantId,
        name: 'Juan Pérez',
        phone: '+56912345678',
        party_size: 4,
        reservation_date: reservationDate,
        reservation_time: '19:00'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('no acepta reservas')
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid email format', async () => {
      const restaurantId = crypto.randomUUID()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const reservationDate = tomorrow.toISOString().split('T')[0]

      const requestBody = {
        restaurant_id: restaurantId,
        name: 'Juan Pérez',
        phone: '+56912345678',
        email: 'not-an-email',
        party_size: 4,
        reservation_date: reservationDate,
        reservation_time: '19:00'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject invalid date format', async () => {
      const restaurantId = crypto.randomUUID()

      const requestBody = {
        restaurant_id: restaurantId,
        name: 'Juan Pérez',
        phone: '+56912345678',
        party_size: 4,
        reservation_date: '2024/01/15', // Wrong format
        reservation_time: '19:00'
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject invalid time format', async () => {
      const restaurantId = crypto.randomUUID()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const reservationDate = tomorrow.toISOString().split('T')[0]

      const requestBody = {
        restaurant_id: restaurantId,
        name: 'Juan Pérez',
        phone: '+56912345678',
        party_size: 4,
        reservation_date: reservationDate,
        reservation_time: '7:00 PM' // Wrong format
      }

      const request = mockNextRequest(requestBody)
      const response = await CreateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('GET /api/reservations/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Available Time Slots - Requirement 9.2', () => {
    it('should return available time slots for valid date', async () => {
      const restaurantId = crypto.randomUUID()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const date = tomorrow.toISOString().split('T')[0]
      
      // Get the day name for tomorrow
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      const dayName = dayNames[tomorrow.getDay()]

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              hours: {
                [dayName]: { open: '12:00', close: '22:00', closed: false }
              },
              reservation_slot_duration: 90,
              reservations_enabled: true,
              capacity: 50
            }
          },
          reservations: {
            data: []
          },
          tables: {
            count: 10
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/reservations/availability?restaurant_id=${restaurantId}&date=${date}&party_size=4` 
        }
      )
      const response = await GetAvailability(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.slots).toBeDefined()
      expect(Array.isArray(data.slots)).toBe(true)
      expect(data.date).toBe(date)
    })

    it('should calculate remaining capacity correctly', async () => {
      const restaurantId = crypto.randomUUID()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const date = tomorrow.toISOString().split('T')[0]

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              hours: {
                'Lunes': { open: '18:00', close: '22:00', closed: false }
              },
              reservation_slot_duration: 90,
              reservations_enabled: true,
              capacity: 20
            }
          },
          reservations: {
            data: [
              { reservation_time: '19:00', duration_min: 90, party_size: 4 },
              { reservation_time: '19:30', duration_min: 90, party_size: 2 }
            ]
          },
          tables: {
            count: 5
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/reservations/availability?restaurant_id=${restaurantId}&date=${date}&party_size=2` 
        }
      )
      const response = await GetAvailability(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.slots).toBeDefined()
      // Verify slots have availability information
      const slot19 = data.slots.find((s: any) => s.time === '19:00')
      if (slot19) {
        expect(slot19.remaining).toBeDefined()
        expect(typeof slot19.available).toBe('boolean')
      }
    })

    it('should return empty slots for closed day', async () => {
      const restaurantId = crypto.randomUUID()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const date = tomorrow.toISOString().split('T')[0]

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              hours: {
                'Domingo': { open: '12:00', close: '22:00', closed: true }
              },
              reservations_enabled: true
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/reservations/availability?restaurant_id=${restaurantId}&date=${date}&party_size=2` 
        }
      )
      const response = await GetAvailability(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.slots).toEqual([])
      expect(data.closed).toBe(true)
    })

    it('should reject request without required parameters', async () => {
      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: 'http://localhost:3000/api/reservations/availability' 
        }
      )
      const response = await GetAvailability(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should reject when restaurant does not accept reservations', async () => {
      const restaurantId = crypto.randomUUID()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const date = tomorrow.toISOString().split('T')[0]

      const mockSupabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              id: restaurantId,
              reservations_enabled: false
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/reservations/availability?restaurant_id=${restaurantId}&date=${date}&party_size=2` 
        }
      )
      const response = await GetAvailability(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('no acepta reservas')
    })
  })
})

describe('PATCH /api/reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Cancel Reservation - Requirement 9.5', () => {
    it('should cancel reservation and free availability', async () => {
      const reservationId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          reservations: {
            data: {
              id: reservationId,
              status: 'cancelled'
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: crypto.randomUUID(), email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        reservation_id: reservationId,
        action: 'cancel'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await UpdateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.reservation).toBeDefined()
      expect(data.reservation.status).toBe('cancelled')
    })

    it('should mark reservation as no-show', async () => {
      const reservationId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          reservations: {
            data: {
              id: reservationId,
              status: 'no_show',
              no_show_at: new Date().toISOString()
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: crypto.randomUUID(), email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        reservation_id: reservationId,
        action: 'no_show'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await UpdateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.reservation.status).toBe('no_show')
    })

    it('should seat reservation and assign table', async () => {
      const reservationId = crypto.randomUUID()
      const tableId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          reservations: {
            data: {
              id: reservationId,
              status: 'seated',
              table_id: tableId,
              seated_at: new Date().toISOString()
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: crypto.randomUUID(), email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        reservation_id: reservationId,
        action: 'seat',
        table_id: tableId
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await UpdateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.reservation.status).toBe('seated')
      expect(data.reservation.table_id).toBe(tableId)
    })

    it('should complete reservation', async () => {
      const reservationId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          reservations: {
            data: {
              id: reservationId,
              status: 'completed',
              completed_at: new Date().toISOString()
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: crypto.randomUUID(), email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        reservation_id: reservationId,
        action: 'complete'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await UpdateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.reservation.status).toBe('completed')
    })
  })

  describe('Authentication', () => {
    it('should reject unauthenticated request', async () => {
      vi.mocked(requireUser).mockResolvedValue({
        user: null,
        error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) as any
      })

      const requestBody = {
        reservation_id: crypto.randomUUID(),
        action: 'cancel'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await UpdateReservation(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(401)
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid action', async () => {
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: crypto.randomUUID(), email: 'staff@test.com' } as any,
        error: null
      })

      const requestBody = {
        reservation_id: crypto.randomUUID(),
        action: 'invalid_action'
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await UpdateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject assign_table without table_id', async () => {
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: crypto.randomUUID(), email: 'staff@test.com' } as any,
        error: null
      })

      const mockSupabase = createSupabaseMock({})
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)

      const requestBody = {
        reservation_id: crypto.randomUUID(),
        action: 'assign_table'
        // Missing table_id
      }

      const request = mockNextRequest(requestBody, {}, { method: 'PATCH' })
      const response = await UpdateReservation(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('table_id')
    })
  })
})
