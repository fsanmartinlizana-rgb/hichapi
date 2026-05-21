/**
 * __tests__/api/customer/tracking-service.test.ts
 *
 * Unit tests for TrackingService.
 * Tests: getTrackingData, validateGpsCoordinates, subscribeToRiderLocation
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateGpsCoordinates,
  getTrackingData,
  subscribeToRiderLocation,
} from '@/lib/customer/tracking-service'
import { createSupabaseMock } from '@/__tests__/setup/supabase-mock'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClientMock } from '@supabase/supabase-js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORDER_ID = 'order-uuid-1234'
const RIDER_ID = 'rider-uuid-5678'

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: ORDER_ID,
    status: 'in_transit',
    rider_id: RIDER_ID,
    delivery_address: 'Av. Providencia 1234, Santiago',
    delivered_at: null,
    ...overrides,
  }
}

function makeRider(overrides: Record<string, any> = {}) {
  return {
    id: RIDER_ID,
    full_name: 'Carlos Rodríguez',
    profile_photo_url: 'https://example.com/photo.jpg',
    ...overrides,
  }
}

function makeLocation(overrides: Record<string, any> = {}) {
  return {
    lat: -33.4372,
    lng: -70.6506,
    recorded_at: '2026-04-10T12:00:00Z',
    ...overrides,
  }
}

// ── validateGpsCoordinates ────────────────────────────────────────────────────

describe('validateGpsCoordinates', () => {
  it('accepts valid coordinates at origin', () => {
    expect(() => validateGpsCoordinates(0, 0)).not.toThrow()
  })

  it('accepts valid coordinates at boundary values', () => {
    expect(() => validateGpsCoordinates(-90, -180)).not.toThrow()
    expect(() => validateGpsCoordinates(90, 180)).not.toThrow()
    expect(() => validateGpsCoordinates(-90, 180)).not.toThrow()
    expect(() => validateGpsCoordinates(90, -180)).not.toThrow()
  })

  it('accepts typical Santiago coordinates', () => {
    expect(() => validateGpsCoordinates(-33.4372, -70.6506)).not.toThrow()
  })

  it('throws for latitude below -90', () => {
    expect(() => validateGpsCoordinates(-90.001, 0)).toThrow('Latitud inválida')
    expect(() => validateGpsCoordinates(-91, 0)).toThrow('Latitud inválida')
  })

  it('throws for latitude above 90', () => {
    expect(() => validateGpsCoordinates(90.001, 0)).toThrow('Latitud inválida')
    expect(() => validateGpsCoordinates(91, 0)).toThrow('Latitud inválida')
  })

  it('throws for longitude below -180', () => {
    expect(() => validateGpsCoordinates(0, -180.001)).toThrow('Longitud inválida')
    expect(() => validateGpsCoordinates(0, -181)).toThrow('Longitud inválida')
  })

  it('throws for longitude above 180', () => {
    expect(() => validateGpsCoordinates(0, 180.001)).toThrow('Longitud inválida')
    expect(() => validateGpsCoordinates(0, 181)).toThrow('Longitud inválida')
  })

  it('throws for both invalid lat and lng (lat checked first)', () => {
    expect(() => validateGpsCoordinates(91, 181)).toThrow('Latitud inválida')
  })
})

// ── getTrackingData ───────────────────────────────────────────────────────────

describe('getTrackingData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when delivery order does not exist', async () => {
    const mock = createSupabaseMock({
      tables: {
        delivery_orders: { data: null },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    const result = await getTrackingData('nonexistent-id')
    expect(result).toBeNull()
  })

  it('returns tracking data with rider and last location for in_transit order', async () => {
    const order = makeOrder()
    const rider = makeRider()
    const location = makeLocation()

    const mock = createSupabaseMock({
      tables: {
        delivery_orders: { data: order },
        rider_profiles:  { data: rider },
        rider_locations: { data: location },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    const result = await getTrackingData(ORDER_ID)

    expect(result).not.toBeNull()
    expect(result!.delivery_order_id).toBe(ORDER_ID)
    expect(result!.status).toBe('in_transit')
    expect(result!.delivery_address).toBe('Av. Providencia 1234, Santiago')
    expect(result!.delivered_at).toBeNull()
  })

  it('exposes only first name of rider (not full name)', async () => {
    const order = makeOrder()
    const rider = makeRider({ full_name: 'Carlos Rodríguez Pérez' })
    const location = makeLocation()

    const mock = createSupabaseMock({
      tables: {
        delivery_orders: { data: order },
        rider_profiles:  { data: rider },
        rider_locations: { data: location },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    const result = await getTrackingData(ORDER_ID)

    expect(result!.rider).not.toBeNull()
    expect(result!.rider!.first_name).toBe('Carlos')
    // Must NOT expose full name
    expect((result!.rider as any).full_name).toBeUndefined()
  })

  it('returns rider with single-word name correctly', async () => {
    const order = makeOrder()
    const rider = makeRider({ full_name: 'Carlos' })
    const location = makeLocation()

    const mock = createSupabaseMock({
      tables: {
        delivery_orders: { data: order },
        rider_profiles:  { data: rider },
        rider_locations: { data: location },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    const result = await getTrackingData(ORDER_ID)
    expect(result!.rider!.first_name).toBe('Carlos')
  })

  it('returns null rider when order has no rider assigned', async () => {
    const order = makeOrder({ rider_id: null })

    const mock = createSupabaseMock({
      tables: {
        delivery_orders: { data: order },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    const result = await getTrackingData(ORDER_ID)

    expect(result).not.toBeNull()
    expect(result!.rider).toBeNull()
    expect(result!.last_location).toBeNull()
  })

  it('returns null last_location when no GPS data recorded yet', async () => {
    const order = makeOrder()
    const rider = makeRider()

    const mock = createSupabaseMock({
      tables: {
        delivery_orders: { data: order },
        rider_profiles:  { data: rider },
        rider_locations: { data: null },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    const result = await getTrackingData(ORDER_ID)

    expect(result!.last_location).toBeNull()
  })

  it('returns validated GPS coordinates in last_location', async () => {
    const order = makeOrder()
    const rider = makeRider()
    const location = makeLocation({ lat: -33.4372, lng: -70.6506 })

    const mock = createSupabaseMock({
      tables: {
        delivery_orders: { data: order },
        rider_profiles:  { data: rider },
        rider_locations: { data: location },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    const result = await getTrackingData(ORDER_ID)

    expect(result!.last_location).not.toBeNull()
    expect(result!.last_location!.lat).toBe(-33.4372)
    expect(result!.last_location!.lng).toBe(-70.6506)
    expect(result!.last_location!.recorded_at).toBe('2026-04-10T12:00:00Z')
  })

  it('throws when GPS coordinates from DB are out of range', async () => {
    const order = makeOrder()
    const rider = makeRider()
    // Simulate corrupted data in DB
    const location = makeLocation({ lat: 91, lng: 0 })

    const mock = createSupabaseMock({
      tables: {
        delivery_orders: { data: order },
        rider_profiles:  { data: rider },
        rider_locations: { data: location },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    await expect(getTrackingData(ORDER_ID)).rejects.toThrow('Latitud inválida')
  })

  it('returns delivered_at timestamp for delivered orders', async () => {
    const deliveredAt = '2026-04-10T14:30:00Z'
    const order = makeOrder({ status: 'delivered', delivered_at: deliveredAt })
    const rider = makeRider()

    const mock = createSupabaseMock({
      tables: {
        delivery_orders: { data: order },
        rider_profiles:  { data: rider },
        rider_locations: { data: null },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    const result = await getTrackingData(ORDER_ID)

    expect(result!.status).toBe('delivered')
    expect(result!.delivered_at).toBe(deliveredAt)
  })

  it('throws when Supabase returns an error for delivery_orders', async () => {
    const mock = createSupabaseMock({
      tables: {
        delivery_orders: {
          data: null,
          error: { message: 'DB error', code: '500', details: '', hint: '' },
        },
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as any)

    await expect(getTrackingData(ORDER_ID)).rejects.toThrow('DB error')
  })
})

// ── subscribeToRiderLocation ──────────────────────────────────────────────────

describe('subscribeToRiderLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an unsubscribe function', () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }
    const mockAnonClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    }
    vi.mocked(createSupabaseClientMock).mockReturnValue(mockAnonClient as any)

    const unsubscribe = subscribeToRiderLocation(ORDER_ID, vi.fn())

    expect(typeof unsubscribe).toBe('function')
  })

  it('creates a channel with the correct name', () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }
    const mockAnonClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    }
    vi.mocked(createSupabaseClientMock).mockReturnValue(mockAnonClient as any)

    subscribeToRiderLocation(ORDER_ID, vi.fn())

    expect(mockAnonClient.channel).toHaveBeenCalledWith(`rider-location-${ORDER_ID}`)
  })

  it('subscribes to postgres_changes INSERT on rider_locations with correct filter', () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }
    const mockAnonClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    }
    vi.mocked(createSupabaseClientMock).mockReturnValue(mockAnonClient as any)

    subscribeToRiderLocation(ORDER_ID, vi.fn())

    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event:  'INSERT',
        schema: 'public',
        table:  'rider_locations',
        filter: `delivery_order_id=eq.${ORDER_ID}`,
      }),
      expect.any(Function),
    )
  })

  it('calls removeChannel when unsubscribe is invoked', () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }
    const mockAnonClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    }
    vi.mocked(createSupabaseClientMock).mockReturnValue(mockAnonClient as any)

    const unsubscribe = subscribeToRiderLocation(ORDER_ID, vi.fn())
    unsubscribe()

    expect(mockAnonClient.removeChannel).toHaveBeenCalledWith(mockChannel)
  })

  it('invokes callback with valid GPS coordinates from realtime payload', () => {
    let capturedHandler: ((payload: any) => void) | null = null

    const mockChannel = {
      on: vi.fn().mockImplementation((_event, _config, handler) => {
        capturedHandler = handler
        return mockChannel
      }),
      subscribe: vi.fn().mockReturnThis(),
    }
    const mockAnonClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    }
    vi.mocked(createSupabaseClientMock).mockReturnValue(mockAnonClient as any)

    const callback = vi.fn()
    subscribeToRiderLocation(ORDER_ID, callback)

    // Simulate a realtime INSERT event
    capturedHandler!({
      new: { lat: -33.4372, lng: -70.6506, recorded_at: '2026-04-10T12:00:00Z' },
    })

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith({
      lat: -33.4372,
      lng: -70.6506,
      recorded_at: '2026-04-10T12:00:00Z',
    })
  })

  it('discards realtime payload with invalid latitude (out of range)', () => {
    let capturedHandler: ((payload: any) => void) | null = null

    const mockChannel = {
      on: vi.fn().mockImplementation((_event, _config, handler) => {
        capturedHandler = handler
        return mockChannel
      }),
      subscribe: vi.fn().mockReturnThis(),
    }
    const mockAnonClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    }
    vi.mocked(createSupabaseClientMock).mockReturnValue(mockAnonClient as any)

    const callback = vi.fn()
    subscribeToRiderLocation(ORDER_ID, callback)

    // Simulate a realtime event with invalid lat
    capturedHandler!({
      new: { lat: 91, lng: 0, recorded_at: '2026-04-10T12:00:00Z' },
    })

    // Callback must NOT be called for invalid coordinates
    expect(callback).not.toHaveBeenCalled()
  })

  it('discards realtime payload with invalid longitude (out of range)', () => {
    let capturedHandler: ((payload: any) => void) | null = null

    const mockChannel = {
      on: vi.fn().mockImplementation((_event, _config, handler) => {
        capturedHandler = handler
        return mockChannel
      }),
      subscribe: vi.fn().mockReturnThis(),
    }
    const mockAnonClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    }
    vi.mocked(createSupabaseClientMock).mockReturnValue(mockAnonClient as any)

    const callback = vi.fn()
    subscribeToRiderLocation(ORDER_ID, callback)

    // Simulate a realtime event with invalid lng
    capturedHandler!({
      new: { lat: 0, lng: 181, recorded_at: '2026-04-10T12:00:00Z' },
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it('accepts boundary GPS coordinates (lat=90, lng=180)', () => {
    let capturedHandler: ((payload: any) => void) | null = null

    const mockChannel = {
      on: vi.fn().mockImplementation((_event, _config, handler) => {
        capturedHandler = handler
        return mockChannel
      }),
      subscribe: vi.fn().mockReturnThis(),
    }
    const mockAnonClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    }
    vi.mocked(createSupabaseClientMock).mockReturnValue(mockAnonClient as any)

    const callback = vi.fn()
    subscribeToRiderLocation(ORDER_ID, callback)

    capturedHandler!({
      new: { lat: 90, lng: 180, recorded_at: '2026-04-10T12:00:00Z' },
    })

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith({ lat: 90, lng: 180, recorded_at: '2026-04-10T12:00:00Z' })
  })

  it('accepts boundary GPS coordinates (lat=-90, lng=-180)', () => {
    let capturedHandler: ((payload: any) => void) | null = null

    const mockChannel = {
      on: vi.fn().mockImplementation((_event, _config, handler) => {
        capturedHandler = handler
        return mockChannel
      }),
      subscribe: vi.fn().mockReturnThis(),
    }
    const mockAnonClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    }
    vi.mocked(createSupabaseClientMock).mockReturnValue(mockAnonClient as any)

    const callback = vi.fn()
    subscribeToRiderLocation(ORDER_ID, callback)

    capturedHandler!({
      new: { lat: -90, lng: -180, recorded_at: '2026-04-10T12:00:00Z' },
    })

    expect(callback).toHaveBeenCalledOnce()
  })

  it('uses anon key client (not admin client) for Realtime', () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }
    const mockAnonClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    }
    vi.mocked(createSupabaseClientMock).mockReturnValue(mockAnonClient as any)

    subscribeToRiderLocation(ORDER_ID, vi.fn())

    // createClient (anon) must be called, not createAdminClient
    expect(createSupabaseClientMock).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
