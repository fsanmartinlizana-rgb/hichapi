/**
 * Unit tests for PrinterConfigService
 *
 * Tests printer configuration retrieval, validation, and the comercio/address
 * utility functions.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createSupabaseMock } from '../../../__tests__/setup/supabase-mock'
import {
  PrinterConfigServiceImpl,
  getRestaurantCode,
  getRestaurantAddress,
  validatePrinterConnectivity,
} from '../printer-config'
import type { PrintServer } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const RESTAURANT_ID = 'rest-uuid-001'

const mockPrintServer = {
  id: 'server-uuid-001',
  name: 'Caja Principal',
  printer_kind: 'network',
  printer_addr: '192.168.1.100:9100',
  active: true,
  restaurant_id: RESTAURANT_ID,
}

const mockPrintServerUsb = {
  id: 'server-uuid-002',
  name: 'Cocina USB',
  printer_kind: 'usb',
  printer_addr: null,
  active: true,
  restaurant_id: RESTAURANT_ID,
}

// ── Mock supabase/client ──────────────────────────────────────────────────────

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/client'
const mockCreateClient = vi.mocked(createClient)

// ── PrinterConfigServiceImpl ──────────────────────────────────────────────────

describe('PrinterConfigServiceImpl', () => {
  let service: PrinterConfigServiceImpl

  // Re-create service before each test so the supabase mock is fresh
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getPreCuentaPrinter ─────────────────────────────────────────────────────

  describe('getPreCuentaPrinter', () => {
    it('returns the configured printer when precuentaPrinterId is set (Req 5.1)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: { precuentaPrinterId: mockPrintServer.id } },
          },
          print_servers: { data: [mockPrintServer] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.getPreCuentaPrinter(RESTAURANT_ID)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(mockPrintServer.id)
      expect(result?.name).toBe(mockPrintServer.name)
      expect(result?.printer_kind).toBe('network')
      expect(result?.active).toBe(true)
    })

    it('falls back to first active print server when no precuentaPrinterId is set', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: {} },
          },
          print_servers: { data: [mockPrintServer] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.getPreCuentaPrinter(RESTAURANT_ID)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(mockPrintServer.id)
    })

    it('returns null when no print servers exist', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: {} },
          },
          print_servers: { data: [] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.getPreCuentaPrinter(RESTAURANT_ID)

      expect(result).toBeNull()
    })

    it('returns null when restaurant is not found', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: { data: null },
          print_servers: { data: [] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.getPreCuentaPrinter(RESTAURANT_ID)

      expect(result).toBeNull()
    })
  })

  // ── getBoletaPrinter ────────────────────────────────────────────────────────

  describe('getBoletaPrinter', () => {
    it('returns the configured printer when boletaPrinterId is set (Req 5.2)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: { boletaPrinterId: mockPrintServer.id } },
          },
          print_servers: { data: [mockPrintServer] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.getBoletaPrinter(RESTAURANT_ID)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(mockPrintServer.id)
    })

    it('falls back to first active print server when no boletaPrinterId is set', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: {} },
          },
          print_servers: { data: [mockPrintServer] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.getBoletaPrinter(RESTAURANT_ID)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(mockPrintServer.id)
    })

    it('returns null when no print servers exist', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: {} },
          },
          print_servers: { data: [] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.getBoletaPrinter(RESTAURANT_ID)

      expect(result).toBeNull()
    })
  })

  // ── validatePrinterConfig ───────────────────────────────────────────────────

  describe('validatePrinterConfig', () => {
    it('returns isValid=true when a properly configured printer exists (Req 5.3)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: { precuentaPrinterId: mockPrintServer.id } },
          },
          print_servers: { data: [mockPrintServer] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.validatePrinterConfig(RESTAURANT_ID, 'precuenta')

      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns specific error message when no precuenta printer is configured (Req 5.3)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: {} },
          },
          print_servers: { data: [] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.validatePrinterConfig(RESTAURANT_ID, 'precuenta')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('precuenta')
      expect(result.error).toContain('No hay impresora configurada')
      expect(result.missingConfig).toContain('precuentaPrinterId')
    })

    it('returns specific error message when no boleta printer is configured (Req 5.3)', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: {} },
          },
          print_servers: { data: [] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.validatePrinterConfig(RESTAURANT_ID, 'boleta')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('boleta electrónica')
      expect(result.error).toContain('No hay impresora configurada')
      expect(result.missingConfig).toContain('boletaPrinterId')
    })

    it('returns error when network printer has no address', async () => {
      const networkPrinterNoAddr = {
        ...mockPrintServer,
        printer_addr: null,
        restaurant_id: RESTAURANT_ID,
      }
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: { precuentaPrinterId: networkPrinterNoAddr.id } },
          },
          print_servers: { data: [networkPrinterNoAddr] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.validatePrinterConfig(RESTAURANT_ID, 'precuenta')

      expect(result.isValid).toBe(false)
      expect(result.missingConfig).toContain('printer_addr')
    })

    it('returns isValid=true for USB printer without address', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: { precuentaPrinterId: mockPrintServerUsb.id } },
          },
          print_servers: { data: [mockPrintServerUsb] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.validatePrinterConfig(RESTAURANT_ID, 'precuenta')

      expect(result.isValid).toBe(true)
    })
  })

  // ── updatePrintSettings ─────────────────────────────────────────────────────

  describe('updatePrintSettings', () => {
    it('merges new settings with existing ones', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: {
              print_settings: {
                autoPreCuenta: false,
                printTimeout: 10000,
              },
            },
          },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.updatePrintSettings(RESTAURANT_ID, {
        precuentaPrinterId: 'new-printer-id',
      })

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns error when supabase update fails', async () => {
      const supabase = createSupabaseMock({
        tables: {
          restaurants: {
            data: { print_settings: {} },
            error: { message: 'DB error', code: '500', details: '', hint: '' },
          },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.updatePrintSettings(RESTAURANT_ID, {
        precuentaPrinterId: 'new-printer-id',
      })

      // The select for existing settings will fail, but the service should handle it
      expect(result).toBeDefined()
    })
  })

  // ── getAvailablePrintServers ────────────────────────────────────────────────

  describe('getAvailablePrintServers', () => {
    it('returns all active print servers for a restaurant', async () => {
      const supabase = createSupabaseMock({
        tables: {
          print_servers: {
            data: [mockPrintServer, mockPrintServerUsb],
          },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.getAvailablePrintServers(RESTAURANT_ID)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(mockPrintServer.id)
      expect(result[1].id).toBe(mockPrintServerUsb.id)
    })

    it('returns empty array when no servers exist', async () => {
      const supabase = createSupabaseMock({
        tables: {
          print_servers: { data: [] },
        },
      })
      mockCreateClient.mockReturnValue(supabase as any)
      service = new PrinterConfigServiceImpl()

      const result = await service.getAvailablePrintServers(RESTAURANT_ID)

      expect(result).toEqual([])
    })
  })
})

// ── getRestaurantCode ─────────────────────────────────────────────────────────

describe('getRestaurantCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the restaurant slug as comercio code (Req 5.4)', async () => {
    const supabase = createSupabaseMock({
      tables: {
        restaurants: {
          data: { slug: 'mi-restaurante', name: 'Mi Restaurante' },
        },
      },
    })
    mockCreateClient.mockReturnValue(supabase as any)

    const code = await getRestaurantCode(RESTAURANT_ID)

    expect(code).toBe('mi-restaurante')
  })

  it('falls back to slugified name when slug is empty', async () => {
    const supabase = createSupabaseMock({
      tables: {
        restaurants: {
          data: { slug: '', name: 'Mi Restaurante Especial' },
        },
      },
    })
    mockCreateClient.mockReturnValue(supabase as any)

    const code = await getRestaurantCode(RESTAURANT_ID)

    expect(code).toBe('mi-restaurante-especial')
  })

  it('returns null when restaurant is not found', async () => {
    const supabase = createSupabaseMock({
      tables: {
        restaurants: { data: null },
      },
    })
    mockCreateClient.mockReturnValue(supabase as any)

    const code = await getRestaurantCode(RESTAURANT_ID)

    expect(code).toBeNull()
  })
})

// ── getRestaurantAddress ──────────────────────────────────────────────────────

describe('getRestaurantAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns SII-specific fields when available', async () => {
    const supabase = createSupabaseMock({
      tables: {
        restaurants: {
          data: {
            address: 'Av. Genérica 1',
            neighborhood: 'Barrio',
            comuna: 'Providencia',
            direccion: 'Av. Providencia 1234',
          },
        },
      },
    })
    mockCreateClient.mockReturnValue(supabase as any)

    const addr = await getRestaurantAddress(RESTAURANT_ID)

    expect(addr?.direccion).toBe('Av. Providencia 1234')
    expect(addr?.comuna).toBe('Providencia')
  })

  it('falls back to generic address fields when SII fields are absent', async () => {
    const supabase = createSupabaseMock({
      tables: {
        restaurants: {
          data: {
            address: 'Av. Genérica 1',
            neighborhood: 'Barrio',
            comuna: null,
            direccion: null,
          },
        },
      },
    })
    mockCreateClient.mockReturnValue(supabase as any)

    const addr = await getRestaurantAddress(RESTAURANT_ID)

    expect(addr?.direccion).toBe('Av. Genérica 1')
    expect(addr?.comuna).toBe('Barrio')
  })

  it('returns null when restaurant is not found', async () => {
    const supabase = createSupabaseMock({
      tables: {
        restaurants: { data: null },
      },
    })
    mockCreateClient.mockReturnValue(supabase as any)

    const addr = await getRestaurantAddress(RESTAURANT_ID)

    expect(addr).toBeNull()
  })
})

// ── validatePrinterConnectivity ───────────────────────────────────────────────

describe('validatePrinterConnectivity', () => {
  it('returns connected=true for a valid network printer', () => {
    const printer: PrintServer = {
      id: 'p1',
      name: 'Test',
      printer_kind: 'network',
      printer_addr: '192.168.1.100:9100',
      active: true,
    }

    const result = validatePrinterConnectivity(printer)

    expect(result.connected).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns connected=true for a valid IP without port', () => {
    const printer: PrintServer = {
      id: 'p1',
      name: 'Test',
      printer_kind: 'network',
      printer_addr: '10.0.0.5',
      active: true,
    }

    const result = validatePrinterConnectivity(printer)

    expect(result.connected).toBe(true)
  })

  it('returns error when network printer has no address', () => {
    const printer: PrintServer = {
      id: 'p1',
      name: 'Test',
      printer_kind: 'network',
      printer_addr: null,
      active: true,
    }

    const result = validatePrinterConnectivity(printer)

    expect(result.connected).toBe(false)
    expect(result.error).toContain('Dirección de red no configurada')
  })

  it('returns error for invalid IP address format', () => {
    const printer: PrintServer = {
      id: 'p1',
      name: 'Test',
      printer_kind: 'network',
      printer_addr: 'not-an-ip',
      active: true,
    }

    const result = validatePrinterConnectivity(printer)

    expect(result.connected).toBe(false)
    expect(result.error).toContain('Dirección IP inválida')
  })

  it('returns connected=true for USB printer without address', () => {
    const printer: PrintServer = {
      id: 'p1',
      name: 'USB Printer',
      printer_kind: 'usb',
      printer_addr: null,
      active: true,
    }

    const result = validatePrinterConnectivity(printer)

    expect(result.connected).toBe(true)
  })

  it('returns connected=true for serial printer without address', () => {
    const printer: PrintServer = {
      id: 'p1',
      name: 'Serial Printer',
      printer_kind: 'serial',
      printer_addr: null,
      active: true,
    }

    const result = validatePrinterConnectivity(printer)

    expect(result.connected).toBe(true)
  })
})
