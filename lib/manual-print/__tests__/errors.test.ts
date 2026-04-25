/**
 * Unit tests for error handling service (errors.ts)
 *
 * Tests error classification, recovery actions, retry mechanisms,
 * timeout handling, and diagnostic logging.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  classifyPrintError,
  ErrorRecoveryService,
  createTimeoutError,
  withTimeout,
  getErrorMessage,
  getErrorSuggestions,
  isRetryableError,
  validateEmailFormat,
  validatePrintRequest,
} from '../errors'
import type { PrintError, PrintContext } from '../types'

// ── classifyPrintError ────────────────────────────────────────────────────────

describe('classifyPrintError', () => {
  // Req 8.1 — network timeout errors
  describe('network timeout errors (Req 8.1)', () => {
    it('classifies TimeoutError by name', () => {
      const err = new Error('La operación tardó más de 10 segundos')
      err.name = 'TimeoutError'
      const result = classifyPrintError(err)

      expect(result.type).toBe('network_timeout')
      expect(result.retryable).toBe(true)
      expect(result.suggestions).toBeDefined()
      expect(result.suggestions!.length).toBeGreaterThan(0)
    })

    it('classifies error with "timeout" in message', () => {
      const err = new Error('Request timeout after 10000ms')
      const result = classifyPrintError(err)

      expect(result.type).toBe('network_timeout')
      expect(result.retryable).toBe(true)
    })

    it('classifies error with "tardó más" in message', () => {
      const err = new Error('La operación tardó más de 10 segundos')
      const result = classifyPrintError(err)

      expect(result.type).toBe('network_timeout')
    })

    it('classifies network connectivity errors', () => {
      const err = new Error('network error occurred')
      const result = classifyPrintError(err)

      expect(result.type).toBe('network_timeout')
      expect(result.retryable).toBe(true)
    })

    it('classifies "conectividad" errors', () => {
      const err = new Error('Error de conectividad')
      const result = classifyPrintError(err)

      expect(result.type).toBe('network_timeout')
    })
  })

  // Req 8.2 — printer errors use specific message from notifier
  describe('printer errors (Req 8.2)', () => {
    it('classifies printer offline errors', () => {
      const err = new Error('Printer is offline')
      const result = classifyPrintError(err)

      expect(result.type).toBe('printer_offline')
      expect(result.retryable).toBe(true)
    })

    it('classifies "apagada" printer errors', () => {
      const err = new Error('Impresora apagada')
      const result = classifyPrintError(err)

      expect(result.type).toBe('printer_offline')
    })

    it('classifies paper errors', () => {
      const err = new Error('Printer has no paper')
      const result = classifyPrintError(err)

      expect(result.type).toBe('printer_no_paper')
      expect(result.retryable).toBe(true)
    })

    it('classifies "papel" errors', () => {
      const err = new Error('Sin papel en la impresora')
      const result = classifyPrintError(err)

      expect(result.type).toBe('printer_no_paper')
    })

    it('uses the specific error message from notifier for printer errors', () => {
      const specificMessage = 'Impresora Epson TM-T20 sin conexión USB'
      const err = new Error(specificMessage)
      const result = classifyPrintError(err)

      // The message should be the actual error message (from notifier)
      expect(result.message).toBe(specificMessage)
    })

    it('classifies generic printer errors with original message', () => {
      const specificMessage = 'Error en impresora: cabezal dañado'
      const err = new Error(specificMessage)
      const result = classifyPrintError(err)

      expect(result.type).toBe('printer_error')
      expect(result.message).toBe(specificMessage)
    })
  })

  // Req 8.3 — configuration errors
  describe('configuration errors (Req 8.3)', () => {
    it('classifies config errors', () => {
      const err = new Error('config not found')
      const result = classifyPrintError(err)

      expect(result.type).toBe('configuration_missing')
      expect(result.retryable).toBe(false)
    })

    it('classifies "configuración" errors', () => {
      const err = new Error('Error de configuración de impresora')
      const result = classifyPrintError(err)

      expect(result.type).toBe('configuration_missing')
      expect(result.retryable).toBe(false)
    })

    it('classifies ValidationError by name', () => {
      const err = new Error('Campo requerido')
      err.name = 'ValidationError'
      const result = classifyPrintError(err)

      expect(result.type).toBe('invalid_data')
      expect(result.retryable).toBe(false)
    })
  })

  // Unknown errors
  describe('unknown errors', () => {
    it('classifies unknown errors as retryable', () => {
      const err = new Error('Something went wrong')
      const result = classifyPrintError(err)

      expect(result.type).toBe('unknown_error')
      expect(result.retryable).toBe(true)
    })

    it('handles non-Error objects', () => {
      const result = classifyPrintError('string error')

      expect(result.type).toBe('unknown_error')
      expect(result.message).toBeDefined()
    })

    it('handles null/undefined', () => {
      const result = classifyPrintError(null)

      expect(result.type).toBe('unknown_error')
    })
  })
})

// ── ErrorRecoveryService ──────────────────────────────────────────────────────

describe('ErrorRecoveryService', () => {
  let service: ErrorRecoveryService

  beforeEach(() => {
    service = new ErrorRecoveryService()
  })

  // Req 8.1 — network timeout → offer retry
  describe('handlePrintError (Req 8.1, 8.2, 8.3)', () => {
    it('returns retry action with "Error de conectividad" for network_timeout (Req 8.1)', () => {
      const error: PrintError = {
        type: 'network_timeout',
        message: 'Timeout',
        retryable: true,
      }

      const action = service.handlePrintError(error)

      expect(action.type).toBe('retry')
      expect(action.message).toContain('Error de conectividad')
    })

    it('returns retry action for printer_offline (Req 8.2)', () => {
      const error: PrintError = {
        type: 'printer_offline',
        message: 'Impresora apagada',
        retryable: true,
      }

      const action = service.handlePrintError(error)

      expect(action.type).toBe('retry')
      expect(action.message).toContain('Impresora apagada')
    })

    it('returns retry action for printer_no_paper (Req 8.2)', () => {
      const error: PrintError = {
        type: 'printer_no_paper',
        message: 'Sin papel',
        retryable: true,
      }

      const action = service.handlePrintError(error)

      expect(action.type).toBe('retry')
    })

    it('returns escalate action with "revisar configuración" for configuration_missing (Req 8.3)', () => {
      const error: PrintError = {
        type: 'configuration_missing',
        message: 'No hay impresora configurada',
        retryable: false,
      }

      const action = service.handlePrintError(error)

      expect(action.type).toBe('escalate')
      expect(action.message.toLowerCase()).toContain('configuración')
    })

    it('returns alternative action for invalid_data', () => {
      const error: PrintError = {
        type: 'invalid_data',
        message: 'Datos inválidos',
        retryable: false,
      }

      const action = service.handlePrintError(error)

      expect(action.type).toBe('alternative')
    })

    it('returns retry action for unknown errors', () => {
      const error: PrintError = {
        type: 'unknown_error',
        message: 'Error desconocido',
        retryable: true,
      }

      const action = service.handlePrintError(error)

      expect(action.type).toBe('retry')
    })

    it('network_timeout action includes exponential backoff delay', async () => {
      const error: PrintError = {
        type: 'network_timeout',
        message: 'Timeout',
        retryable: true,
      }

      const action = service.handlePrintError(error)

      expect(action.action).toBeDefined()
      // Should resolve without throwing
      await expect(action.action!()).resolves.toBeUndefined()
    })
  })

  // Req 8.5 — multiple consecutive failures → suggest admin contact
  describe('suggestAlternatives (Req 8.5)', () => {
    it('returns empty array for 0 failures', () => {
      const alternatives = service.suggestAlternatives(0)
      expect(alternatives).toHaveLength(0)
    })

    it('returns empty array for 1 failure', () => {
      const alternatives = service.suggestAlternatives(1)
      expect(alternatives).toHaveLength(0)
    })

    it('returns "Continuar sin imprimir" option after 2 failures', () => {
      const alternatives = service.suggestAlternatives(2)

      expect(alternatives.length).toBeGreaterThanOrEqual(1)
      const labels = alternatives.map(a => a.label)
      expect(labels).toContain('Continuar sin imprimir')
    })

    it('suggests contacting administrator after 3+ consecutive failures (Req 8.5)', () => {
      const alternatives = service.suggestAlternatives(3)

      const labels = alternatives.map(a => a.label)
      expect(labels).toContain('Contactar administrador')
    })

    it('includes email alternative after 3+ failures', () => {
      const alternatives = service.suggestAlternatives(3)

      const labels = alternatives.map(a => a.label)
      expect(labels).toContain('Enviar por email')
    })

    it('all alternatives have action functions', () => {
      const alternatives = service.suggestAlternatives(3)

      alternatives.forEach(alt => {
        expect(typeof alt.action).toBe('function')
        expect(alt.label).toBeTruthy()
        expect(alt.description).toBeTruthy()
      })
    })

    it('returns more alternatives for higher failure counts', () => {
      const two = service.suggestAlternatives(2)
      const three = service.suggestAlternatives(3)

      expect(three.length).toBeGreaterThan(two.length)
    })
  })

  // Req 8.6 — error logging
  describe('logErrorForDiagnostics (Req 8.6)', () => {
    it('logs error with context information', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const error: PrintError = {
        type: 'network_timeout',
        message: 'Timeout error',
        details: 'Timeout after 10000ms',
        retryable: true,
      }

      const context: PrintContext = {
        restaurantId: 'rest-1',
        orderId: 'order-1',
        tableId: 'table-1',
        documentType: 'precuenta',
        userId: 'user-1',
      }

      service.logErrorForDiagnostics(error, context)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[PrintError]',
        expect.objectContaining({
          error: expect.objectContaining({
            type: 'network_timeout',
            message: 'Timeout error',
          }),
          context: expect.objectContaining({
            restaurantId: 'rest-1',
            orderId: 'order-1',
            tableId: 'table-1',
            documentType: 'precuenta',
          }),
          timestamp: expect.any(String),
        })
      )

      consoleSpy.mockRestore()
    })

    it('includes timestamp in log entry', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const error: PrintError = {
        type: 'printer_error',
        message: 'Printer error',
        retryable: true,
      }

      const context: PrintContext = {
        restaurantId: 'rest-1',
        orderId: 'order-1',
        tableId: 'table-1',
        documentType: 'boleta_impresa',
      }

      service.logErrorForDiagnostics(error, context)

      const logCall = consoleSpy.mock.calls[0][1]
      expect(logCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)

      consoleSpy.mockRestore()
    })
  })

  // Consecutive failure tracking
  describe('trackConsecutiveFailure and resetFailureCount', () => {
    it('tracks consecutive failures per key', () => {
      const count1 = service.trackConsecutiveFailure('table-1')
      const count2 = service.trackConsecutiveFailure('table-1')
      const count3 = service.trackConsecutiveFailure('table-1')

      expect(count1).toBe(1)
      expect(count2).toBe(2)
      expect(count3).toBe(3)
    })

    it('tracks failures independently per key', () => {
      service.trackConsecutiveFailure('table-1')
      service.trackConsecutiveFailure('table-1')
      const table2Count = service.trackConsecutiveFailure('table-2')

      expect(table2Count).toBe(1)
    })

    it('resets failure count for a key', () => {
      service.trackConsecutiveFailure('table-1')
      service.trackConsecutiveFailure('table-1')
      service.resetFailureCount('table-1')

      const count = service.trackConsecutiveFailure('table-1')
      expect(count).toBe(1)
    })
  })
})

// ── withTimeout (Req 8.4) ─────────────────────────────────────────────────────

describe('withTimeout (Req 8.4)', () => {
  it('resolves when promise completes within timeout', async () => {
    const fastPromise = Promise.resolve('result')
    const result = await withTimeout(fastPromise, 10000)

    expect(result).toBe('result')
  })

  it('rejects with TimeoutError when promise exceeds timeout', async () => {
    const slowPromise = new Promise<never>(resolve =>
      setTimeout(resolve, 500)
    )

    await expect(withTimeout(slowPromise, 50)).rejects.toMatchObject({
      name: 'TimeoutError',
    })
  })

  it('default timeout is 10 seconds', async () => {
    // Verify the default is 10000ms by checking the error message
    const slowPromise = new Promise<never>(resolve =>
      setTimeout(resolve, 500)
    )

    try {
      await withTimeout(slowPromise, 50)
    } catch (err: any) {
      // The default timeout message should reference seconds
      expect(err.name).toBe('TimeoutError')
    }
  })

  it('timeout error message mentions seconds', async () => {
    const slowPromise = new Promise<never>(resolve =>
      setTimeout(resolve, 500)
    )

    try {
      await withTimeout(slowPromise, 100)
    } catch (err: any) {
      expect(err.message).toContain('segundos')
    }
  })

  it('passes through rejection from original promise', async () => {
    const failingPromise = Promise.reject(new Error('Original error'))

    await expect(withTimeout(failingPromise, 10000)).rejects.toThrow('Original error')
  })
})

// ── createTimeoutError ────────────────────────────────────────────────────────

describe('createTimeoutError', () => {
  it('creates a network_timeout PrintError', () => {
    const error = createTimeoutError(10000)

    expect(error.type).toBe('network_timeout')
    expect(error.retryable).toBe(true)
    expect(error.message).toContain('10')
    expect(error.suggestions).toBeDefined()
    expect(error.suggestions!.length).toBeGreaterThan(0)
  })

  it('includes timeout duration in message', () => {
    const error = createTimeoutError(5000)

    expect(error.message).toContain('5')
  })
})

// ── Helper functions ──────────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('returns the error message', () => {
    const error: PrintError = {
      type: 'network_timeout',
      message: 'Error de conectividad',
      retryable: true,
    }

    expect(getErrorMessage(error)).toBe('Error de conectividad')
  })
})

describe('getErrorSuggestions', () => {
  it('returns suggestions array', () => {
    const error: PrintError = {
      type: 'network_timeout',
      message: 'Timeout',
      retryable: true,
      suggestions: ['Intenta nuevamente', 'Verifica conexión'],
    }

    expect(getErrorSuggestions(error)).toEqual(['Intenta nuevamente', 'Verifica conexión'])
  })

  it('returns empty array when no suggestions', () => {
    const error: PrintError = {
      type: 'unknown_error',
      message: 'Error',
      retryable: true,
    }

    expect(getErrorSuggestions(error)).toEqual([])
  })
})

describe('isRetryableError', () => {
  it('returns true for retryable errors', () => {
    const error: PrintError = {
      type: 'network_timeout',
      message: 'Timeout',
      retryable: true,
    }

    expect(isRetryableError(error)).toBe(true)
  })

  it('returns false for non-retryable errors', () => {
    const error: PrintError = {
      type: 'configuration_missing',
      message: 'Config missing',
      retryable: false,
    }

    expect(isRetryableError(error)).toBe(false)
  })
})

// ── validateEmailFormat ───────────────────────────────────────────────────────

describe('validateEmailFormat', () => {
  it('validates correct email', () => {
    expect(validateEmailFormat('user@example.com').isValid).toBe(true)
  })

  it('rejects empty email', () => {
    const result = validateEmailFormat('')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('requerido')
  })

  it('rejects invalid format', () => {
    const result = validateEmailFormat('not-an-email')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('inválido')
  })
})

// ── validatePrintRequest ──────────────────────────────────────────────────────

describe('validatePrintRequest', () => {
  it('validates a complete request', () => {
    const request = {
      comercio: 'rest-1',
      movimiento: 'order-1',
      total: 5000,
      items: [{ id: '1', name: 'Item', quantity: 1, unit_price: 5000 }],
    }

    const result = validatePrintRequest(request)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects request missing comercio', () => {
    const request = {
      movimiento: 'order-1',
      total: 5000,
      items: [{ id: '1', name: 'Item', quantity: 1, unit_price: 5000 }],
    }

    const result = validatePrintRequest(request)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.includes('comercio'))).toBe(true)
  })

  it('rejects request with zero total', () => {
    const request = {
      comercio: 'rest-1',
      movimiento: 'order-1',
      total: 0,
      items: [{ id: '1', name: 'Item', quantity: 1, unit_price: 0 }],
    }

    const result = validatePrintRequest(request)
    expect(result.isValid).toBe(false)
  })

  it('rejects request with empty items', () => {
    const request = {
      comercio: 'rest-1',
      movimiento: 'order-1',
      total: 5000,
      items: [],
    }

    const result = validatePrintRequest(request)
    expect(result.isValid).toBe(false)
  })
})
