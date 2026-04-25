/**
 * Error handling utilities for manual print control system
 * 
 * This module provides comprehensive error handling, recovery mechanisms,
 * and user-friendly error messages for print operations.
 */

import type { 
  PrintError, 
  PrintErrorType, 
  ErrorRecoveryAction, 
  AlternativeAction,
  PrintContext 
} from './types'

// ── Error Classification ─────────────────────────────────────────────────────

export function classifyPrintError(error: unknown): PrintError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    // Timeout errors (check error name first)
    if (error.name === 'TimeoutError' || message.includes('timeout') || message.includes('tardó más')) {
      return {
        type: 'network_timeout',
        message: error.message,
        details: error.message,
        retryable: true,
        suggestions: [
          'Verifica tu conexión a internet',
          'Intenta nuevamente en unos segundos',
          'Contacta al administrador si el problema persiste'
        ]
      }
    }
    
    // Validation errors (check error name first)
    if (error.name === 'ValidationError' || message.includes('inválido') || message.includes('requerido')) {
      return {
        type: 'invalid_data',
        message: error.message,
        details: error.message,
        retryable: false,
        suggestions: [
          'Verifica que todos los campos estén completos',
          'Revisa el formato de los datos ingresados',
          'Contacta al soporte técnico'
        ]
      }
    }
    
    // Network errors
    if (message.includes('network') || message.includes('conectividad')) {
      return {
        type: 'network_timeout',
        message: 'Error de conectividad con el sistema de impresión',
        details: error.message,
        retryable: true,
        suggestions: [
          'Verifica tu conexión a internet',
          'Intenta nuevamente en unos segundos',
          'Contacta al administrador si el problema persiste'
        ]
      }
    }
    
    // Printer offline errors
    if (message.includes('offline') || message.includes('apagada')) {
      return {
        type: 'printer_offline',
        message: 'La impresora está apagada o desconectada',
        details: error.message,
        retryable: true,
        suggestions: [
          'Verifica que la impresora esté encendida',
          'Revisa la conexión de red de la impresora',
          'Reinicia la impresora si es necesario'
        ]
      }
    }
    
    // Paper errors
    if (message.includes('paper') || message.includes('papel')) {
      return {
        type: 'printer_no_paper',
        message: 'La impresora no tiene papel',
        details: error.message,
        retryable: true,
        suggestions: [
          'Agrega papel a la impresora',
          'Verifica que el papel esté correctamente instalado',
          'Intenta imprimir nuevamente'
        ]
      }
    }
    
    // Configuration errors
    if (message.includes('config') || message.includes('configuración')) {
      return {
        type: 'configuration_missing',
        message: 'Configuración de impresora incompleta',
        details: error.message,
        retryable: false,
        suggestions: [
          'Configura las impresoras en el panel de administración',
          'Verifica que la impresora esté asignada correctamente',
          'Contacta al administrador del sistema'
        ]
      }
    }
    
    // Generic printer errors
    if (message.includes('printer') || message.includes('impresora')) {
      return {
        type: 'printer_error',
        message: error.message, // Use the actual error message
        details: error.message,
        retryable: true,
        suggestions: [
          'Verifica el estado de la impresora',
          'Reinicia la impresora',
          'Contacta al soporte técnico'
        ]
      }
    }
    
    // For any other error, return the actual message
    return {
      type: 'unknown_error',
      message: error.message,
      details: error.message,
      retryable: true,
      suggestions: [
        'Intenta nuevamente',
        'Verifica tu conexión',
        'Contacta al soporte técnico si el problema persiste'
      ]
    }
  }
  
  // Unknown error fallback
  return {
    type: 'unknown_error',
    message: 'Error desconocido en el sistema de impresión',
    details: error instanceof Error ? error.message : String(error),
    retryable: true,
    suggestions: [
      'Intenta nuevamente',
      'Verifica tu conexión',
      'Contacta al soporte técnico si el problema persiste'
    ]
  }
}

// ── Error Recovery Service ───────────────────────────────────────────────────

class ErrorRecoveryService {
  private consecutiveFailures = new Map<string, number>()
  
  handlePrintError(error: PrintError): ErrorRecoveryAction {
    switch (error.type) {
      case 'network_timeout':
        return {
          type: 'retry',
          message: 'Error de conectividad con el sistema de impresión. ¿Reintentar?',
          action: async () => {
            // Retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      
      case 'printer_offline':
      case 'printer_no_paper':
        return {
          type: 'retry',
          message: error.message + '. ¿Reintentar después de solucionarlo?'
        }
      
      case 'configuration_missing':
        return {
          type: 'escalate',
          message: 'Error de configuración. Debes revisar la configuración de impresoras.'
        }
      
      case 'invalid_data':
        return {
          type: 'alternative',
          message: 'Datos inválidos. Revisa la información e intenta nuevamente.'
        }
      
      default:
        return {
          type: 'retry',
          message: 'Error inesperado. ¿Reintentar?'
        }
    }
  }
  
  suggestAlternatives(consecutiveFailures: number): AlternativeAction[] {
    const alternatives: AlternativeAction[] = []
    
    if (consecutiveFailures >= 2) {
      alternatives.push({
        label: 'Continuar sin imprimir',
        description: 'Proceder con el pago sin generar el documento físico',
        action: async () => {
          // Allow payment to continue without printing
        }
      })
    }
    
    if (consecutiveFailures >= 3) {
      alternatives.push({
        label: 'Enviar por email',
        description: 'Solicitar email del cliente para envío digital',
        action: async () => {
          // Switch to email delivery
        }
      })
      
      alternatives.push({
        label: 'Contactar administrador',
        description: 'Reportar el problema al equipo técnico',
        action: async () => {
          // Log issue for admin review
        }
      })
    }
    
    return alternatives
  }
  
  logErrorForDiagnostics(error: PrintError, context: PrintContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        type: error.type,
        message: error.message,
        details: error.details
      },
      context: {
        restaurantId: context.restaurantId,
        orderId: context.orderId,
        tableId: context.tableId,
        documentType: context.documentType,
        userId: context.userId
      },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server'
    }
    
    // Log to console for development
    console.error('[PrintError]', logEntry)
    
    // In production, this would send to logging service
    // await sendToLoggingService(logEntry)
  }
  
  trackConsecutiveFailure(key: string): number {
    const current = this.consecutiveFailures.get(key) || 0
    const updated = current + 1
    this.consecutiveFailures.set(key, updated)
    return updated
  }
  
  resetFailureCount(key: string): void {
    this.consecutiveFailures.delete(key)
  }
}

// ── Error Message Helpers ────────────────────────────────────────────────────

export function getErrorMessage(error: PrintError): string {
  return error.message
}

export function getErrorSuggestions(error: PrintError): string[] {
  return error.suggestions || []
}

export function isRetryableError(error: PrintError): boolean {
  return error.retryable
}

// ── Network Error Utilities ──────────────────────────────────────────────────

export function createTimeoutError(timeoutMs: number): PrintError {
  return {
    type: 'network_timeout',
    message: `La operación tardó más de ${timeoutMs / 1000} segundos`,
    details: `Timeout after ${timeoutMs}ms`,
    retryable: true,
    suggestions: [
      'Verifica tu conexión a internet',
      'Intenta nuevamente',
      'Contacta al soporte si el problema persiste'
    ]
  }
}

export function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number = 10000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error(`La operación tardó más de ${timeoutMs / 1000} segundos`)
        timeoutError.name = 'TimeoutError'
        reject(timeoutError)
      }, timeoutMs)
    })
  ])
}

// ── Validation Helpers ───────────────────────────────────────────────────────

export function validateEmailFormat(email: string): { isValid: boolean; error?: string } {
  if (!email.trim()) {
    return { isValid: false, error: 'El email es requerido' }
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Formato de email inválido' }
  }
  
  return { isValid: true }
}

export function validatePrintRequest(request: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!request.comercio) {
    errors.push('Código de comercio requerido')
  }
  
  if (!request.movimiento) {
    errors.push('ID de orden requerido')
  }
  
  if (!request.total || request.total <= 0) {
    errors.push('Total debe ser mayor a 0')
  }
  
  if (!request.items || !Array.isArray(request.items) || request.items.length === 0) {
    errors.push('Debe incluir al menos un item')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ── Export class for instantiation ──────────────────────────────────────────

export { ErrorRecoveryService }