/**
 * Tests for manual print control types and utilities
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialPrintState,
  canRequestPrecuenta,
  needsElectronicReceipt,
  formatCurrency,
  generateDocumentId,
  getDefaultPrintTimeout,
  PRINT_TIMEOUTS,
  DOCUMENT_TYPES,
  PRINT_STATUS,
  ERROR_TYPES
} from '../index'
import { 
  validateEmailFormat,
  validatePrintRequest,
  classifyPrintError
} from '../errors'

describe('Manual Print Types and Utilities', () => {
  describe('createInitialPrintState', () => {
    it('should create initial print state with correct defaults', () => {
      const state = createInitialPrintState()
      
      expect(state.precuentaRequested).toBe(false)
      expect(state.precuentaStatus).toBe('idle')
      expect(state.documentHistory).toEqual([])
      expect(state.precuentaTimestamp).toBeUndefined()
      expect(state.precuentaError).toBeUndefined()
    })
  })
  
  describe('canRequestPrecuenta', () => {
    it('should return true for valid order statuses', () => {
      expect(canRequestPrecuenta('delivered')).toBe(true)
      expect(canRequestPrecuenta('ready')).toBe(true)
      expect(canRequestPrecuenta('paying')).toBe(true)
    })
    
    it('should return false for invalid order statuses', () => {
      expect(canRequestPrecuenta('pending')).toBe(false)
      expect(canRequestPrecuenta('preparing')).toBe(false)
      expect(canRequestPrecuenta('paid')).toBe(false)
      expect(canRequestPrecuenta('cancelled')).toBe(false)
    })
  })
  
  describe('needsElectronicReceipt', () => {
    it('should return true for valid payment methods', () => {
      expect(needsElectronicReceipt('cash')).toBe(true)
      expect(needsElectronicReceipt('digital')).toBe(true)
      expect(needsElectronicReceipt('mixed')).toBe(true)
    })
    
    it('should return false for invalid payment methods', () => {
      expect(needsElectronicReceipt('invalid')).toBe(false)
      expect(needsElectronicReceipt('')).toBe(false)
    })
  })
  
  describe('formatCurrency', () => {
    it('should format currency correctly for Chilean pesos', () => {
      expect(formatCurrency(1000)).toBe('$1.000')
      expect(formatCurrency(15500)).toBe('$15.500')
      expect(formatCurrency(0)).toBe('$0')
    })
  })
  
  describe('generateDocumentId', () => {
    it('should generate unique document IDs', () => {
      const id1 = generateDocumentId()
      const id2 = generateDocumentId()
      
      expect(id1).toMatch(/^doc_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^doc_\d+_[a-z0-9]+$/)
      expect(id1).not.toBe(id2)
    })
  })
  
  describe('getDefaultPrintTimeout', () => {
    it('should return correct default timeout', () => {
      expect(getDefaultPrintTimeout()).toBe(10000)
    })
  })
  
  describe('validateEmailFormat', () => {
    it('should validate correct email formats', () => {
      expect(validateEmailFormat('test@example.com')).toEqual({ isValid: true })
      expect(validateEmailFormat('user.name@domain.co.uk')).toEqual({ isValid: true })
    })
    
    it('should reject invalid email formats', () => {
      expect(validateEmailFormat('')).toEqual({ 
        isValid: false, 
        error: 'El email es requerido' 
      })
      expect(validateEmailFormat('invalid-email')).toEqual({ 
        isValid: false, 
        error: 'Formato de email inválido' 
      })
      expect(validateEmailFormat('test@')).toEqual({ 
        isValid: false, 
        error: 'Formato de email inválido' 
      })
    })
  })
  
  describe('validatePrintRequest', () => {
    it('should validate correct print request', () => {
      const validRequest = {
        comercio: 'test-restaurant',
        movimiento: 'order-123',
        total: 1000,
        items: [{ id: '1', name: 'Test Item', quantity: 1, unit_price: 1000 }]
      }
      
      const result = validatePrintRequest(validRequest)
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })
    
    it('should reject invalid print request', () => {
      const invalidRequest = {
        // missing required fields
      }
      
      const result = validatePrintRequest(invalidRequest)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
  
  describe('classifyPrintError', () => {
    it('should classify network timeout errors', () => {
      const error = new Error('Network timeout occurred')
      const classified = classifyPrintError(error)
      
      expect(classified.type).toBe('network_timeout')
      expect(classified.retryable).toBe(true)
      expect(classified.suggestions).toBeDefined()
    })
    
    it('should classify printer offline errors', () => {
      const error = new Error('Printer is offline')
      const classified = classifyPrintError(error)
      
      expect(classified.type).toBe('printer_offline')
      expect(classified.retryable).toBe(true)
    })
    
    it('should classify unknown errors', () => {
      const error = new Error('Some unknown error')
      const classified = classifyPrintError(error)
      
      expect(classified.type).toBe('unknown_error')
      expect(classified.retryable).toBe(true)
    })
  })
  
  describe('Constants', () => {
    it('should have correct print timeouts', () => {
      expect(PRINT_TIMEOUTS.DEFAULT).toBe(10000)
      expect(PRINT_TIMEOUTS.NETWORK).toBe(15000)
      expect(PRINT_TIMEOUTS.EMAIL).toBe(30000)
    })
    
    it('should have correct document types', () => {
      expect(DOCUMENT_TYPES.PRECUENTA).toBe('precuenta')
      expect(DOCUMENT_TYPES.BOLETA_IMPRESA).toBe('boleta_impresa')
      expect(DOCUMENT_TYPES.BOLETA_EMAIL).toBe('boleta_email')
    })
    
    it('should have correct print statuses', () => {
      expect(PRINT_STATUS.IDLE).toBe('idle')
      expect(PRINT_STATUS.LOADING).toBe('loading')
      expect(PRINT_STATUS.SUCCESS).toBe('success')
      expect(PRINT_STATUS.ERROR).toBe('error')
    })
    
    it('should have correct error types', () => {
      expect(ERROR_TYPES.NETWORK_TIMEOUT).toBe('network_timeout')
      expect(ERROR_TYPES.PRINTER_OFFLINE).toBe('printer_offline')
      expect(ERROR_TYPES.PRINTER_NO_PAPER).toBe('printer_no_paper')
      expect(ERROR_TYPES.CONFIGURATION_MISSING).toBe('configuration_missing')
    })
  })
})