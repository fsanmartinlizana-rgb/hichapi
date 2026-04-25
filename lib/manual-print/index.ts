/**
 * Manual Print Control System
 * 
 * This module provides comprehensive manual printing control for waiters,
 * allowing them to control when precuentas and electronic receipts are printed.
 * 
 * Key Features:
 * - Manual precuenta printing control
 * - Electronic receipt options (print vs email)
 * - Printer configuration management
 * - Document history tracking
 * - Comprehensive error handling
 * - Integration with existing notifier endpoints
 */

// ── Internal type imports (for lazy-loaded singleton declarations) ────────────

import type { NotifierServiceImpl } from './notifier-service'
import type { PrinterConfigServiceImpl } from './printer-config'
import type { DocumentHistoryService } from './document-history'
import type { ErrorRecoveryService } from './errors'
import type { PrintRequestState, DocumentType, PrintContext } from './types'

// ── Core Types ───────────────────────────────────────────────────────────────

export type {
  // Print Request State
  PrintRequestStatus,
  DocumentType,
  PrintRequestState,
  DocumentRequest,
  
  // Notifier Service
  NotifierService,
  PreCuentaRequest,
  BoletaRequest,
  NotifierOrderItem,
  DteSelection,
  PreCuentaResponse,
  BoletaResponse,
  
  // Printer Configuration
  PrinterConfigService,
  PrintServer,
  ValidationResult,
  
  // Error Handling
  PrintErrorType,
  PrintError,
  ErrorRecoveryAction,
  AlternativeAction,
  PrintContext,
  
  // Extended Types
  OrderPrintRequests,
  RestaurantPrintSettings,
  DocumentHistoryRecord,
  
  // UI Component Props
  ManualPrintControlsProps,
  ElectronicReceiptOptionsProps,
  EmailValidationState,
  OrderWithPrintState
} from './types'

// ── Services ─────────────────────────────────────────────────────────────────

export { 
  NotifierServiceImpl,
  createNotifierService,
  createMockNotifierService,
  validateNotifierRequest
} from './notifier-service'

export { 
  PrinterConfigServiceImpl,
  getRestaurantCode,
  getRestaurantAddress,
  validatePrinterConnectivity
} from './printer-config'

export {
  DocumentHistoryService,
  formatDocumentType,
  getDocumentTypeIcon,
  formatDocumentStatus,
  isRecentRequest,
  getTimeElapsed
} from './document-history'

export {
  ErrorRecoveryService,
  classifyPrintError,
  getErrorMessage,
  getErrorSuggestions,
  isRetryableError,
  createTimeoutError,
  withTimeout,
  validateEmailFormat,
  validatePrintRequest
} from './errors'

// ── DTE Validation ───────────────────────────────────────────────────────────

export type {
  BoletaData,
  FacturaData,
  DteItem,
  DteValidationResult,
  DteFieldError,
  RutValidationResult
} from './dte-validation'

export {
  validateRut,
  formatRut,
  validateBoletaData,
  validateFacturaData,
  validateDteData,
  getFieldErrors
} from './dte-validation'

// ── React Hooks ──────────────────────────────────────────────────────────────

export {
  usePrintState,
  usePrecuentaRequest,
  useElectronicReceipt,
  usePrinterStatus,
  useDocumentHistory
} from './hooks'

// ── Service Instances (lazy-loaded) ──────────────────────────────────────────

let _notifierService: NotifierServiceImpl | null = null
let _printerConfigService: PrinterConfigServiceImpl | null = null
let _documentHistoryService: DocumentHistoryService | null = null
let _errorRecoveryService: ErrorRecoveryService | null = null

export function getNotifierService(): NotifierServiceImpl {
  if (!_notifierService) {
    const { NotifierServiceImpl } = require('./notifier-service')
    _notifierService = new NotifierServiceImpl()
  }
  return _notifierService!
}

export function getPrinterConfigService(): PrinterConfigServiceImpl {
  if (!_printerConfigService) {
    const { PrinterConfigServiceImpl } = require('./printer-config')
    _printerConfigService = new PrinterConfigServiceImpl()
  }
  return _printerConfigService!
}

export function getDocumentHistoryService(): DocumentHistoryService {
  if (!_documentHistoryService) {
    const { DocumentHistoryService } = require('./document-history')
    _documentHistoryService = new DocumentHistoryService()
  }
  return _documentHistoryService!
}

export function getErrorRecoveryService(): ErrorRecoveryService {
  if (!_errorRecoveryService) {
    const { ErrorRecoveryService } = require('./errors')
    _errorRecoveryService = new ErrorRecoveryService()
  }
  return _errorRecoveryService!
}

// ── Utility Functions ────────────────────────────────────────────────────────

/**
 * Create initial print request state
 */
export function createInitialPrintState(): PrintRequestState {
  return {
    precuentaRequested: false,
    precuentaStatus: 'idle',
    documentHistory: []
  }
}

/**
 * Check if order can request precuenta
 */
export function canRequestPrecuenta(orderStatus: string): boolean {
  return ['delivered', 'ready', 'paying'].includes(orderStatus)
}

/**
 * Check if order needs electronic receipt
 */
export function needsElectronicReceipt(paymentMethod: string): boolean {
  return ['cash', 'digital', 'mixed'].includes(paymentMethod)
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Generate unique document request ID
 */
export function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Check if printer is available for document type
 */
export async function isPrinterAvailable(
  restaurantId: string,
  documentType: 'precuenta' | 'boleta'
): Promise<boolean> {
  try {
    const printerService = getPrinterConfigService()
    const validation = await printerService.validatePrinterConfig(
      restaurantId,
      documentType
    )
    return validation.isValid
  } catch {
    return false
  }
}

/**
 * Get default print timeout
 */
export function getDefaultPrintTimeout(): number {
  return 10000 // 10 seconds
}

/**
 * Create print context for error logging
 */
export function createPrintContext(
  restaurantId: string,
  orderId: string,
  tableId: string,
  documentType: DocumentType | string,
  userId?: string
): PrintContext {
  return {
    restaurantId,
    orderId,
    tableId,
    documentType: documentType as DocumentType,
    userId
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

export const PRINT_TIMEOUTS = {
  DEFAULT: 10000,
  NETWORK: 15000,
  EMAIL: 30000
} as const

export const DOCUMENT_TYPES = {
  PRECUENTA: 'precuenta' as const,
  BOLETA_IMPRESA: 'boleta_impresa' as const,
  BOLETA_EMAIL: 'boleta_email' as const
}

export const PRINT_STATUS = {
  IDLE: 'idle' as const,
  LOADING: 'loading' as const,
  SUCCESS: 'success' as const,
  ERROR: 'error' as const
}

export const ERROR_TYPES = {
  NETWORK_TIMEOUT: 'network_timeout' as const,
  PRINTER_OFFLINE: 'printer_offline' as const,
  PRINTER_NO_PAPER: 'printer_no_paper' as const,
  PRINTER_ERROR: 'printer_error' as const,
  CONFIGURATION_MISSING: 'configuration_missing' as const,
  INVALID_DATA: 'invalid_data' as const,
  UNKNOWN_ERROR: 'unknown_error' as const
}