/**
 * React hooks for manual print control system
 * 
 * This module provides React hooks for managing print state,
 * handling print requests, and integrating with the UI components.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { 
  PrintRequestState, 
  DocumentRequest, 
  DocumentType,
  PrintError,
  OrderWithPrintState,
  AlternativeAction
} from './types'
import { 
  createInitialPrintState,
  generateDocumentId,
  createPrintContext,
  getPrinterConfigService,
  getDocumentHistoryService,
  getErrorRecoveryService,
  getNotifierService,
  DOCUMENT_TYPES
} from './index'
import { 
  classifyPrintError,
  withTimeout
} from './errors'
import {
  getRestaurantCode,
  getRestaurantAddress,
} from './printer-config'

// ── Print State Hook ─────────────────────────────────────────────────────────

export function usePrintState(orderId: string) {
  const [printState, setPrintState] = useState<PrintRequestState>(createInitialPrintState)
  const [loading, setLoading] = useState(false)
  
  // Load initial state from document history
  useEffect(() => {
    async function loadPrintState() {
      const documentHistoryService = getDocumentHistoryService()
      const history = await documentHistoryService.getOrderDocumentHistory(orderId)
      
      // Check if precuenta was requested
      const precuentaRequest = history.find((h: any) => h.type === 'precuenta')
      
      setPrintState({
        precuentaRequested: !!precuentaRequest,
        precuentaTimestamp: precuentaRequest?.timestamp,
        precuentaStatus: precuentaRequest ? 
          (precuentaRequest.status === 'completed' ? 'success' : 
           precuentaRequest.status === 'failed' ? 'error' : 'loading') : 'idle',
        precuentaError: precuentaRequest?.error,
        documentHistory: history
      })
    }
    
    if (orderId) {
      loadPrintState()
    }
  }, [orderId])
  
  const updatePrintState = useCallback((updates: Partial<PrintRequestState>) => {
    setPrintState(prev => ({ ...prev, ...updates }))
  }, [])
  
  const addDocumentRequest = useCallback((request: DocumentRequest) => {
    setPrintState(prev => ({
      ...prev,
      documentHistory: [request, ...prev.documentHistory]
    }))
  }, [])
  
  return {
    printState,
    loading,
    setLoading,
    updatePrintState,
    addDocumentRequest
  }
}

// ── Precuenta Request Hook ───────────────────────────────────────────────────

export function usePrecuentaRequest(
  restaurantId: string,
  tableId: string,
  order: OrderWithPrintState | null
) {
  const { printState, loading, setLoading, updatePrintState, addDocumentRequest } = 
    usePrintState(order?.id || '')
  const consecutiveFailures = useRef(0)
  const [alternatives, setAlternatives] = useState<AlternativeAction[]>([])
  
  // Stable key for tracking failures per order+table combination
  const failureKey = `${restaurantId}:${tableId}:${order?.id || ''}`
  
  const requestPrecuenta = useCallback(async (printerName?: string) => {
    if (!order || loading) return
    
    setLoading(true)
    updatePrintState({ precuentaStatus: 'loading' })
    
    try {
      // Validate printer configuration
      const printerConfigService = getPrinterConfigService()
      const validation = await printerConfigService.validatePrinterConfig(
        restaurantId,
        'precuenta'
      )
      
      if (!validation.isValid) {
        throw new Error(validation.error || 'Configuración de impresora inválida')
      }
      
      // Get printer and restaurant details
      const [printer, restaurantCode, restaurantAddress] = await Promise.all([
        printerConfigService.getPreCuentaPrinter(restaurantId),
        getRestaurantCode(restaurantId),
        getRestaurantAddress(restaurantId),
      ])
      
      if (!printer) {
        throw new Error('No hay impresora configurada para precuentas')
      }
      
      // Create document request record (best-effort — doesn't block if table missing)
      const documentId = generateDocumentId()
      const documentHistoryService = getDocumentHistoryService()
      const createResult = await documentHistoryService.createDocumentRequest(
        restaurantId,
        tableId,
        order.id,
        'precuenta',
        { printServer: printer.printer_addr || printer.id }
      )
      
      // Add to local state regardless of DB result
      const documentRequest: DocumentRequest = {
        id: documentId,
        type: 'precuenta',
        timestamp: new Date(),
        status: 'pending',
        metadata: { printServer: printer.printer_addr || printer.id }
      }
      addDocumentRequest(documentRequest)
      
      // Call actual NotifierService to send precuenta to printer (Req 1.2, 1.3)
      // printer.printer_addr is the notifier base URL (e.g. https://realdev.cl)
      // Create a NotifierService instance pointing to that URL
      const { createNotifierService } = await import('./notifier-service')
      const notifierService = createNotifierService(printer.printer_addr || printer.id)
      const notifierResponse = await notifierService.requestPreCuenta({
        comercio:  restaurantId,
        impresora: printerName || printer.name || 'CAJA',
        comuna:    restaurantAddress?.comuna || '',
        direccion: restaurantAddress?.direccion || '',
        movimiento: order.id,
        nombreCliente: order.client_name || undefined,
        items: order.order_items.map(item => ({
          id:        item.id,
          name:      item.name,
          quantity:  item.quantity,
          unit_price: item.unit_price,
          notes:     item.notes || undefined,
        })),
        total: order.total,
      })
      
      if (!notifierResponse.success) {
        throw new Error(notifierResponse.error || 'Error al solicitar precuenta')
      }
      
      // Update success state
      updatePrintState({
        precuentaRequested: true,
        precuentaTimestamp: new Date(),
        precuentaStatus: 'success',
        precuentaError: undefined
      })
      
      // Update document history (best-effort)
      if (createResult.id) {
        await documentHistoryService.updateDocumentStatus(createResult.id, 'completed').catch(() => {})
      }
      
      // Reset failure tracking on success (Req 8.5)
      consecutiveFailures.current = 0
      const errorRecoveryService = getErrorRecoveryService()
      errorRecoveryService.resetFailureCount(failureKey)
      setAlternatives([])
      
    } catch (error) {
      const printError = classifyPrintError(error)
      
      updatePrintState({
        precuentaStatus: 'error',
        precuentaError: printError.message
      })
      
      // Log error for diagnostics with full context (Req 8.6)
      const context = createPrintContext(
        restaurantId,
        order.id,
        tableId,
        'precuenta'
      )
      const errorRecoveryService = getErrorRecoveryService()
      errorRecoveryService.logErrorForDiagnostics(printError, context)
      
      // Track consecutive failures using the service (Req 8.5)
      const failureCount = errorRecoveryService.trackConsecutiveFailure(failureKey)
      consecutiveFailures.current = failureCount
      
      // After 3+ consecutive failures, surface alternative suggestions (Req 8.5)
      if (failureCount >= 3) {
        const suggested = errorRecoveryService.suggestAlternatives(failureCount)
        setAlternatives(suggested)
      }
      
      // Update document history with error
      if (printState.documentHistory.length > 0) {
        const latestDoc = printState.documentHistory[0]
        const documentHistoryService = getDocumentHistoryService()
        await documentHistoryService.updateDocumentStatus(
          latestDoc.id,
          'failed',
          printError.message
        )
      }
    } finally {
      setLoading(false)
    }
  }, [
    order, 
    loading, 
    restaurantId, 
    tableId,
    failureKey,
    printState.documentHistory,
    setLoading, 
    updatePrintState, 
    addDocumentRequest
  ])
  
  const canRequest = order && 
    ['delivered', 'ready', 'paying'].includes(order.status) &&
    !printState.precuentaRequested &&
    !loading
  
  return {
    printState,
    loading,
    canRequest,
    requestPrecuenta,   // (printerName?: string) => Promise<void>
    consecutiveFailures: consecutiveFailures.current,
    alternatives
  }
}

// ── Electronic Receipt Hook ──────────────────────────────────────────────────

export function useElectronicReceipt(
  restaurantId: string,
  orderId: string,
  total: number
) {
  const [loading, setLoading] = useState(false)
  const [emailValidation, setEmailValidation] = useState({
    email: '',
    isValid: false,
    error: undefined as string | undefined
  })
  
  const validateEmail = useCallback((email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isValid = emailRegex.test(email.trim())
    
    setEmailValidation({
      email,
      isValid,
      error: isValid ? undefined : 'Formato de email inválido'
    })
  }, [])
  
  const requestPrintReceipt = useCallback(async () => {
    if (loading) return
    
    setLoading(true)
    try {
      // Validate printer configuration
      const printerConfigService = getPrinterConfigService()
      const validation = await printerConfigService.validatePrinterConfig(
        restaurantId,
        'boleta'
      )
      
      if (!validation.isValid) {
        throw new Error(validation.error || 'Configuración de impresora inválida')
      }
      
      // TODO: Implement actual boleta printing
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      return { success: true }
    } catch (error) {
      const printError = classifyPrintError(error)
      return { 
        success: false, 
        error: printError.message 
      }
    } finally {
      setLoading(false)
    }
  }, [restaurantId, loading])
  
  const requestEmailReceipt = useCallback(async (email: string) => {
    if (loading || !emailValidation.isValid) return
    
    setLoading(true)
    try {
      // TODO: Implement actual email boleta
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      return { success: true }
    } catch (error) {
      const printError = classifyPrintError(error)
      return { 
        success: false, 
        error: printError.message 
      }
    } finally {
      setLoading(false)
    }
  }, [loading, emailValidation.isValid])
  
  return {
    loading,
    emailValidation,
    validateEmail,
    requestPrintReceipt,
    requestEmailReceipt
  }
}

// ── Printer Status Hook ──────────────────────────────────────────────────────

export function usePrinterStatus(restaurantId: string) {
  const [printerStatus, setPrinterStatus] = useState<{
    precuenta: { available: boolean; error?: string }
    boleta: { available: boolean; error?: string }
  }>({
    precuenta: { available: false },
    boleta: { available: false }
  })
  
  const checkPrinterStatus = useCallback(async () => {
    const printerConfigService = getPrinterConfigService()
    const [precuentaValidation, boletaValidation] = await Promise.all([
      printerConfigService.validatePrinterConfig(restaurantId, 'precuenta'),
      printerConfigService.validatePrinterConfig(restaurantId, 'boleta')
    ])
    
    setPrinterStatus({
      precuenta: {
        available: precuentaValidation.isValid,
        error: precuentaValidation.error
      },
      boleta: {
        available: boletaValidation.isValid,
        error: boletaValidation.error
      }
    })
  }, [restaurantId])
  
  // Check status on mount and when restaurant changes
  useEffect(() => {
    if (restaurantId) {
      checkPrinterStatus()
    }
  }, [restaurantId, checkPrinterStatus])
  
  return {
    printerStatus,
    checkPrinterStatus
  }
}

// ── Document History Hook ────────────────────────────────────────────────────

export function useDocumentHistory(orderId: string) {
  const [history, setHistory] = useState<DocumentRequest[]>([])
  const [loading, setLoading] = useState(false)
  
  const loadHistory = useCallback(async () => {
    if (!orderId) return
    
    setLoading(true)
    try {
      const documentHistoryService = getDocumentHistoryService()
      const documents = await documentHistoryService.getOrderDocumentHistory(orderId)
      setHistory(documents)
    } catch (error) {
      console.error('Error loading document history:', error)
    } finally {
      setLoading(false)
    }
  }, [orderId])
  
  useEffect(() => {
    loadHistory()
  }, [loadHistory])
  
  return {
    history,
    loading,
    refreshHistory: loadHistory
  }
}