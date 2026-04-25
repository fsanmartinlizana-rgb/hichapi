/**
 * NotifierService implementation for manual print control system
 * 
 * This service integrates with existing notifier endpoints for precuenta
 * and boleta electronica requests, providing proper error handling,
 * timeout management, and request validation.
 */

import type { 
  NotifierService,
  PreCuentaRequest,
  BoletaRequest,
  PreCuentaResponse,
  BoletaResponse,
  PrintError
} from './types'
import { 
  classifyPrintError, 
  withTimeout, 
  validatePrintRequest,
  validateEmailFormat 
} from './errors'

// ── NotifierService Implementation ───────────────────────────────────────────

// URL del notifier de impresión — mismo servidor para todos los locales.
// Configurar via NOTIFIER_PRINT_URL (server) o NEXT_PUBLIC_NOTIFIER_PRINT_URL (browser).
const NOTIFIER_PRINT_URL =
  (typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_NOTIFIER_PRINT_URL
    : process.env.NOTIFIER_PRINT_URL ?? process.env.NEXT_PUBLIC_NOTIFIER_PRINT_URL
  )?.replace(/\/$/, '') ?? 'https://api.notifier.realdev.cl'

class NotifierServiceImpl implements NotifierService {
  private readonly baseUrl: string
  private readonly timeout: number
  
  constructor(baseUrl?: string, timeout: number = 10000) {
    // Siempre usar el notifier externo, no el origen de Next.js
    this.baseUrl = (baseUrl && baseUrl !== '' ? baseUrl : NOTIFIER_PRINT_URL).replace(/\/$/, '')
    this.timeout = timeout
  }
  
  /**
   * Request precuenta printing via /api/pre_cuenta endpoint.
   *
   * Payload format expected by realdev.cl:
   * {
   *   comercio:   string   // ID del restaurante en BD
   *   impresora:  string   // nombre de la impresora configurada
   *   comuna:     string
   *   direccion:  string
   *   movimiento: string   // ID de la orden
   *   nombrecli:  string   // nombre del cliente (campo del notifier)
   *   detalle:    Array<{ nombre, cantidad, precio, subtotal }>
   *   totales:    Array<{ total }>
   * }
   */
  async requestPreCuenta(params: PreCuentaRequest): Promise<PreCuentaResponse> {
    try {
      // Validate base fields
      if (!params.comercio || !params.movimiento) {
        const error = new Error('comercio y movimiento son requeridos')
        error.name = 'ValidationError'
        throw error
      }

      if (!params.items || params.items.length === 0) {
        const error = new Error('Debe incluir al menos un item')
        error.name = 'ValidationError'
        throw error
      }

      // Build payload in the format expected by realdev.cl
      const payload = {
        comercio:   params.comercio,          // restaurant_id de la BD
        impresora:  params.impresora || '',
        comuna:     params.comuna    || '',
        direccion:  params.direccion || '',
        movimiento: params.movimiento,
        nombrecli:  params.nombreCliente || '',
        detalle: params.items.map(item => ({
          nombre:   item.name,
          cantidad: item.quantity,
          precio:   item.unit_price,
          subtotal: item.unit_price * item.quantity,
        })),
        totales: [{ total: params.total }],
      }
      
      // Make request with timeout
      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/pre_cuenta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        this.timeout
      )
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 
          errorData.message || 
          `Error HTTP ${response.status}: ${response.statusText}`
        
        // Create error with the actual message from server
        const error = new Error(errorMessage)
        throw error
      }
      
      const data = await response.json()
      
      return {
        success: true,
        data
      }
      
    } catch (error) {
      const printError = classifyPrintError(error)
      
      return {
        success: false,
        error: printError.message
      }
    }
  }
  
  /**
   * Request electronic receipt via /api/solicita_boleta_electronica endpoint
   */
  async requestBoletaElectronica(params: BoletaRequest): Promise<BoletaResponse> {
    try {
      // Only validate comercio and movimiento — items are not required for boleta
      if (!params.comercio || !params.movimiento) {
        const error = new Error('comercio y movimiento son requeridos para boleta')
        error.name = 'ValidationError'
        throw error
      }
      
      // Validate boleta-specific requirements
      if (!params.impresora && !params.email) {
        const error = new Error('Se requiere impresora o email para boleta electrónica')
        error.name = 'ValidationError'
        throw error
      }
      
      if (params.email) {
        const emailValidation = validateEmailFormat(params.email)
        if (!emailValidation.isValid) {
          const error = new Error(emailValidation.error || 'Email inválido')
          error.name = 'ValidationError'
          throw error
        }
      }
      
      if (!params.dte) {
        const error = new Error('Información DTE requerida para boleta electrónica')
        error.name = 'ValidationError'
        throw error
      }
      
      // Validate DTE data based on document type
      if (params.dte.document_type === 33) { // Factura
        if (!params.dte.rut_receptor || !params.dte.razon_receptor) {
          const error = new Error('RUT y razón social requeridos para factura')
          error.name = 'ValidationError'
          throw error
        }
        
        if (!params.dte.giro_receptor || !params.dte.direccion_receptor || !params.dte.comuna_receptor) {
          const error = new Error('Giro, dirección y comuna requeridos para factura')
          error.name = 'ValidationError'
          throw error
        }
      }
      
      // Prepare request payload
      const payload = {
        comercio: params.comercio,
        impresora: params.impresora || null,
        email: params.email || null,
        movimiento: params.movimiento,
        total: params.total,
        items: params.items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes || ''
        })),
        dte: {
          document_type: params.dte.document_type,
          rut_receptor: params.dte.rut_receptor || null,
          razon_receptor: params.dte.razon_receptor || null,
          giro_receptor: params.dte.giro_receptor || null,
          direccion_receptor: params.dte.direccion_receptor || null,
          comuna_receptor: params.dte.comuna_receptor || null,
          fma_pago: params.dte.fma_pago || 1,
          email_receptor: params.dte.email_receptor || params.email || null
        }
      }
      
      // Make request with timeout
      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/solicita_boleta_electronica`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }),
        this.timeout
      )
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 
          errorData.message || 
          `Error HTTP ${response.status}: ${response.statusText}`
        
        // Create error with the actual message from server
        const error = new Error(errorMessage)
        throw error
      }
      
      const data = await response.json()
      
      return {
        success: true,
        data
      }
      
    } catch (error) {
      const printError = classifyPrintError(error)
      
      return {
        success: false,
        error: printError.message
      }
    }
  }
  
  /**
   * Test connectivity to notifier endpoints
   */
  async testConnectivity(): Promise<{ 
    preCuentaAvailable: boolean
    boletaAvailable: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    let preCuentaAvailable = false
    let boletaAvailable = false
    
    // Test pre_cuenta endpoint
    try {
      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/pre_cuenta`, {
          method: 'OPTIONS'
        }),
        5000
      )
      preCuentaAvailable = response.status !== 404
    } catch (error) {
      errors.push(`Pre-cuenta endpoint: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
    
    // Test boleta_electronica endpoint
    try {
      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/solicita_boleta_electronica`, {
          method: 'OPTIONS'
        }),
        5000
      )
      boletaAvailable = response.status !== 404
    } catch (error) {
      errors.push(`Boleta electrónica endpoint: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
    
    return {
      preCuentaAvailable,
      boletaAvailable,
      errors
    }
  }
  
  /**
   * Get service configuration
   */
  getConfig(): { baseUrl: string; timeout: number } {
    return {
      baseUrl: this.baseUrl,
      timeout: this.timeout
    }
  }
  
  /**
   * Update service configuration
   */
  updateConfig(config: { baseUrl?: string; timeout?: number }): void {
    if (config.baseUrl !== undefined) {
      // @ts-ignore - We need to update readonly property for configuration
      this.baseUrl = config.baseUrl
    }
    
    if (config.timeout !== undefined) {
      // @ts-ignore - We need to update readonly property for configuration
      this.timeout = config.timeout
    }
  }
}

// ── Utility Functions ────────────────────────────────────────────────────────

/**
 * Create NotifierService instance with default configuration
 */
export function createNotifierService(
  baseUrl?: string, 
  timeout?: number
): NotifierService {
  return new NotifierServiceImpl(baseUrl, timeout)
}

/**
 * Create NotifierService instance for testing with mock endpoints
 */
export function createMockNotifierService(): NotifierService {
  return new MockNotifierServiceImpl()
}

/**
 * Validate notifier request before sending
 */
export function validateNotifierRequest(
  type: 'precuenta' | 'boleta',
  params: PreCuentaRequest | BoletaRequest
): { isValid: boolean; errors: string[] } {
  const baseValidation = validatePrintRequest(params)
  if (!baseValidation.isValid) {
    return baseValidation
  }
  
  const errors: string[] = []
  
  if (type === 'precuenta') {
    const precuentaParams = params as PreCuentaRequest
    if (!precuentaParams.impresora) {
      errors.push('Impresora requerida para precuenta')
    }
    if (!precuentaParams.comuna) {
      errors.push('Comuna requerida para precuenta')
    }
    if (!precuentaParams.direccion) {
      errors.push('Dirección requerida para precuenta')
    }
  } else {
    const boletaParams = params as BoletaRequest
    if (!boletaParams.impresora && !boletaParams.email) {
      errors.push('Impresora o email requerido para boleta')
    }
    if (!boletaParams.dte) {
      errors.push('Información DTE requerida para boleta')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ── Mock Implementation for Testing ──────────────────────────────────────────

class MockNotifierServiceImpl implements NotifierService {
  private shouldFail = false
  private delay = 100 // Reduced delay for tests
  
  async requestPreCuenta(params: PreCuentaRequest): Promise<PreCuentaResponse> {
    await new Promise(resolve => setTimeout(resolve, this.delay))
    
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Mock error: Impresora no disponible'
      }
    }
    
    return {
      success: true,
      data: {
        id: `precuenta_${Date.now()}`,
        status: 'printed',
        timestamp: new Date().toISOString()
      }
    }
  }
  
  async requestBoletaElectronica(params: BoletaRequest): Promise<BoletaResponse> {
    await new Promise(resolve => setTimeout(resolve, this.delay))
    
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Mock error: Error en DTE'
      }
    }
    
    return {
      success: true,
      data: {
        id: `boleta_${Date.now()}`,
        folio: Math.floor(Math.random() * 1000000),
        status: params.email ? 'sent' : 'printed',
        timestamp: new Date().toISOString()
      }
    }
  }
  
  // Test utilities
  setFailureMode(shouldFail: boolean): void {
    this.shouldFail = shouldFail
  }
  
  setDelay(delay: number): void {
    this.delay = delay
  }
}

// ── Export Implementation ────────────────────────────────────────────────────

export { NotifierServiceImpl, MockNotifierServiceImpl }
export default NotifierServiceImpl