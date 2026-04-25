/**
 * Unit tests for NotifierService implementation
 * 
 * Tests the NotifierService class for proper API integration,
 * error handling, timeout management, and request validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  NotifierServiceImpl,
  createNotifierService,
  createMockNotifierService,
  validateNotifierRequest
} from '../notifier-service'
import type { PreCuentaRequest, BoletaRequest } from '../types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('NotifierService', () => {
  let service: NotifierServiceImpl
  
  beforeEach(() => {
    service = new NotifierServiceImpl('http://localhost:3000', 5000)
    mockFetch.mockClear()
  })
  
  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('requestPreCuenta', () => {
    const validPreCuentaRequest: PreCuentaRequest = {
      comercio: 'test-restaurant',
      impresora: 'printer-1',
      comuna: 'Santiago',
      direccion: 'Av. Test 123',
      movimiento: 'order-123',
      nombreCliente: 'Juan Pérez',
      items: [
        {
          id: 'item-1',
          name: 'Hamburguesa',
          quantity: 2,
          unit_price: 5000,
          notes: 'Sin cebolla'
        }
      ],
      total: 10000
    }

    it('should successfully request precuenta with valid data', async () => {
      const mockResponse = {
        id: 'precuenta-123',
        status: 'printed'
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await service.requestPreCuenta(validPreCuentaRequest)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/pre_cuenta',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"comercio":"test-restaurant"')
        })
      )
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await service.requestPreCuenta(validPreCuentaRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain('conectividad')
    })

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Impresora no disponible' })
      })

      const result = await service.requestPreCuenta(validPreCuentaRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Impresora no disponible')
    })

    it('should validate required fields', async () => {
      const invalidRequest = {
        ...validPreCuentaRequest,
        impresora: '', // Missing required field
        comuna: '' // Missing required field
      }

      const result = await service.requestPreCuenta(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain('requerida')
    })

    it('should handle timeout errors', async () => {
      // Create a service with very short timeout
      const shortTimeoutService = new NotifierServiceImpl('http://localhost:3000', 100)
      
      // Mock a request that takes longer than timeout
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      )

      const result = await shortTimeoutService.requestPreCuenta(validPreCuentaRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain('segundos')
    })

    it('should format items correctly in request payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      })

      await service.requestPreCuenta(validPreCuentaRequest)

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      
      expect(requestBody.items).toEqual([
        {
          id: 'item-1',
          name: 'Hamburguesa',
          quantity: 2,
          unit_price: 5000,
          notes: 'Sin cebolla'
        }
      ])
    })
  })

  describe('requestBoletaElectronica', () => {
    const validBoletaRequest: BoletaRequest = {
      comercio: 'test-restaurant',
      impresora: 'printer-1',
      movimiento: 'order-123',
      total: 10000,
      items: [
        {
          id: 'item-1',
          name: 'Hamburguesa',
          quantity: 2,
          unit_price: 5000
        }
      ],
      dte: {
        document_type: 39,
        fma_pago: 1
      }
    }

    it('should successfully request boleta with printer', async () => {
      const mockResponse = {
        id: 'boleta-123',
        folio: 456789,
        status: 'printed'
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await service.requestBoletaElectronica(validBoletaRequest)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse)
    })

    it('should successfully request boleta with email', async () => {
      const emailRequest = {
        ...validBoletaRequest,
        impresora: undefined,
        email: 'cliente@example.com'
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'sent' })
      })

      const result = await service.requestBoletaElectronica(emailRequest)

      expect(result.success).toBe(true)
      
      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      expect(requestBody.email).toBe('cliente@example.com')
      expect(requestBody.impresora).toBeNull()
    })

    it('should validate email format when provided', async () => {
      const invalidEmailRequest = {
        ...validBoletaRequest,
        impresora: undefined,
        email: 'invalid-email'
      }

      const result = await service.requestBoletaElectronica(invalidEmailRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain('inválido')
    })

    it('should require either printer or email', async () => {
      const noOutputRequest = {
        ...validBoletaRequest,
        impresora: undefined,
        email: undefined
      }

      const result = await service.requestBoletaElectronica(noOutputRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain('requiere')
    })

    it('should validate factura requirements', async () => {
      const facturaRequest = {
        ...validBoletaRequest,
        dte: {
          document_type: 33 as const, // Factura
          rut_receptor: '', // Missing required field
          razon_receptor: '' // Missing required field
        }
      }

      const result = await service.requestBoletaElectronica(facturaRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain('requeridos')
    })

    it('should include DTE information in request payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      })

      await service.requestBoletaElectronica(validBoletaRequest)

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      
      expect(requestBody.dte).toEqual({
        document_type: 39,
        rut_receptor: null,
        razon_receptor: null,
        giro_receptor: null,
        direccion_receptor: null,
        comuna_receptor: null,
        fma_pago: 1,
        email_receptor: null
      })
    })
  })

  describe('testConnectivity', () => {
    it('should test both endpoints availability', async () => {
      mockFetch
        .mockResolvedValueOnce({ status: 200 }) // pre_cuenta
        .mockResolvedValueOnce({ status: 200 }) // boleta_electronica

      const result = await service.testConnectivity()

      expect(result.preCuentaAvailable).toBe(true)
      expect(result.boletaAvailable).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle endpoint unavailability', async () => {
      mockFetch
        .mockResolvedValueOnce({ status: 404 }) // pre_cuenta not found
        .mockRejectedValueOnce(new Error('Connection refused')) // boleta error

      const result = await service.testConnectivity()

      expect(result.preCuentaAvailable).toBe(false)
      expect(result.boletaAvailable).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Boleta electrónica endpoint')
    })
  })

  describe('configuration', () => {
    it('should return current configuration', () => {
      const config = service.getConfig()
      
      expect(config.baseUrl).toBe('http://localhost:3000')
      expect(config.timeout).toBe(5000)
    })

    it('should update configuration', () => {
      service.updateConfig({
        baseUrl: 'http://new-url.com',
        timeout: 15000
      })
      
      const config = service.getConfig()
      expect(config.baseUrl).toBe('http://new-url.com')
      expect(config.timeout).toBe(15000)
    })
  })
})

describe('Factory Functions', () => {
  it('should create NotifierService with default config', () => {
    const service = createNotifierService()
    expect(service).toBeInstanceOf(NotifierServiceImpl)
  })

  it('should create NotifierService with custom config', () => {
    const service = createNotifierService('http://custom.com', 20000)
    const config = (service as NotifierServiceImpl).getConfig()
    
    expect(config.baseUrl).toBe('http://custom.com')
    expect(config.timeout).toBe(20000)
  })

  it('should create mock NotifierService', () => {
    const mockService = createMockNotifierService()
    expect(mockService).toBeDefined()
  })
})

describe('Request Validation', () => {
  const baseRequest = {
    comercio: 'test',
    movimiento: 'order-1',
    total: 1000,
    items: [{ id: '1', name: 'Item', quantity: 1, unit_price: 1000 }]
  }

  it('should validate precuenta request', () => {
    const precuentaRequest = {
      ...baseRequest,
      impresora: 'printer-1',
      comuna: 'Santiago',
      direccion: 'Test St 123'
    }

    const result = validateNotifierRequest('precuenta', precuentaRequest)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should validate boleta request', () => {
    const boletaRequest = {
      ...baseRequest,
      impresora: 'printer-1',
      dte: { document_type: 39 as const }
    }

    const result = validateNotifierRequest('boleta', boletaRequest)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should detect missing precuenta fields', () => {
    const invalidRequest = {
      ...baseRequest,
      // Missing impresora, comuna, direccion
    }

    const result = validateNotifierRequest('precuenta', invalidRequest)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Impresora requerida para precuenta')
    expect(result.errors).toContain('Comuna requerida para precuenta')
    expect(result.errors).toContain('Dirección requerida para precuenta')
  })

  it('should detect missing boleta fields', () => {
    const invalidRequest = {
      ...baseRequest,
      // Missing impresora/email and dte
    }

    const result = validateNotifierRequest('boleta', invalidRequest)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Impresora o email requerido para boleta')
    expect(result.errors).toContain('Información DTE requerida para boleta')
  })
})

describe('MockNotifierService', () => {
  let mockService: any

  beforeEach(() => {
    mockService = createMockNotifierService()
  })

  it('should simulate successful precuenta request', async () => {
    const request: PreCuentaRequest = {
      comercio: 'test',
      impresora: 'printer-1',
      comuna: 'Santiago',
      direccion: 'Test St',
      movimiento: 'order-1',
      items: [],
      total: 1000
    }

    const result = await mockService.requestPreCuenta(request)
    
    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty('id')
    expect(result.data).toHaveProperty('status', 'printed')
  })

  it('should simulate successful boleta request', async () => {
    const request: BoletaRequest = {
      comercio: 'test',
      impresora: 'printer-1',
      movimiento: 'order-1',
      items: [],
      total: 1000,
      dte: { document_type: 39 }
    }

    const result = await mockService.requestBoletaElectronica(request)
    
    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty('id')
    expect(result.data).toHaveProperty('folio')
    expect(result.data).toHaveProperty('status', 'printed')
  })

  it('should simulate email delivery for boleta', async () => {
    const request: BoletaRequest = {
      comercio: 'test',
      email: 'test@example.com',
      movimiento: 'order-1',
      items: [],
      total: 1000,
      dte: { document_type: 39 }
    }

    const result = await mockService.requestBoletaElectronica(request)
    
    expect(result.success).toBe(true)
    expect(result.data?.status).toBe('sent')
  })

  it('should simulate failure mode', async () => {
    mockService.setFailureMode(true)

    const request: PreCuentaRequest = {
      comercio: 'test',
      impresora: 'printer-1',
      comuna: 'Santiago',
      direccion: 'Test St',
      movimiento: 'order-1',
      items: [],
      total: 1000
    }

    const result = await mockService.requestPreCuenta(request)
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('Mock error')
  })
})