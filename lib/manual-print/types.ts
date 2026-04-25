/**
 * Core types and interfaces for manual print control system
 * 
 * This module defines the TypeScript interfaces for managing manual printing
 * of precuentas and electronic receipts, integrating with existing notifier
 * endpoints while preserving automatic kitchen/bar ticket printing.
 */

// ── Print Request State Management ───────────────────────────────────────────

export type PrintRequestStatus = 'idle' | 'loading' | 'success' | 'error'

export type DocumentType = 'precuenta' | 'boleta_impresa' | 'boleta_email'

export interface PrintRequestState {
  /** Whether precuenta has been requested for this order */
  precuentaRequested: boolean
  /** Timestamp when precuenta was requested */
  precuentaTimestamp?: Date
  /** Current status of precuenta request */
  precuentaStatus: PrintRequestStatus
  /** Error message if precuenta request failed */
  precuentaError?: string
  /** History of all document requests for this order */
  documentHistory: DocumentRequest[]
}

export interface DocumentRequest {
  /** Unique identifier for this document request */
  id: string
  /** Type of document requested */
  type: DocumentType
  /** When the request was made */
  timestamp: Date
  /** Current status of the request */
  status: 'pending' | 'completed' | 'failed'
  /** Error message if request failed */
  error?: string
  /** Additional metadata for the request */
  metadata?: {
    /** Email address for boleta_email type */
    email?: string
    /** Print server ID used for the request */
    printServer?: string
    /** Response from notifier service */
    notifierResponse?: any
  }
}

// ── Notifier Service Integration ─────────────────────────────────────────────

export interface NotifierService {
  /** Request precuenta printing */
  requestPreCuenta(params: PreCuentaRequest): Promise<PreCuentaResponse>
  /** Request electronic receipt (boleta) */
  requestBoletaElectronica(params: BoletaRequest): Promise<BoletaResponse>
}

export interface PreCuentaRequest {
  /** Restaurant identifier */
  comercio: string
  /** Printer server identifier */
  impresora: string
  /** Restaurant commune */
  comuna: string
  /** Restaurant address */
  direccion: string
  /** Order ID */
  movimiento: string
  /** Customer name (optional) */
  nombreCliente?: string
  /** Order items */
  items: NotifierOrderItem[]
  /** Total amount */
  total: number
}

export interface BoletaRequest {
  /** Restaurant identifier */
  comercio: string
  /** Printer server identifier (for physical printing) */
  impresora?: string
  /** Email address (for email delivery) */
  email?: string
  /** Order ID */
  movimiento: string
  /** Total amount */
  total: number
  /** Order items */
  items: NotifierOrderItem[]
  /** DTE selection details */
  dte: DteSelection
}

export interface NotifierOrderItem {
  /** Item ID */
  id: string
  /** Item name */
  name: string
  /** Quantity */
  quantity: number
  /** Unit price */
  unit_price: number
  /** Item notes */
  notes?: string
}

export interface DteSelection {
  /** Document type (39 = boleta, 33 = factura) */
  document_type: 39 | 33
  /** Customer RUT (for factura) */
  rut_receptor?: string
  /** Customer business name (for factura) */
  razon_receptor?: string
  /** Customer business activity (for factura) */
  giro_receptor?: string
  /** Customer address (for factura) */
  direccion_receptor?: string
  /** Customer commune (for factura) */
  comuna_receptor?: string
  /** Payment method (1=cash, 2=digital, 3=mixed) */
  fma_pago?: 1 | 2 | 3
  /** Customer email */
  email_receptor?: string
}

export interface PreCuentaResponse {
  /** Whether the request was successful */
  success: boolean
  /** Error message if request failed */
  error?: string
  /** Response data from notifier */
  data?: any
}

export interface BoletaResponse {
  /** Whether the request was successful */
  success: boolean
  /** Error message if request failed */
  error?: string
  /** Response data from notifier */
  data?: any
}

// ── Printer Configuration ────────────────────────────────────────────────────

export interface PrinterConfigService {
  /** Get printer configuration for precuenta documents */
  getPreCuentaPrinter(restaurantId: string): Promise<PrintServer | null>
  /** Get printer configuration for boleta documents */
  getBoletaPrinter(restaurantId: string): Promise<PrintServer | null>
  /** Validate printer configuration for a specific document type */
  validatePrinterConfig(
    restaurantId: string, 
    type: 'precuenta' | 'boleta'
  ): Promise<ValidationResult>
}

export interface PrintServer {
  /** Server ID */
  id: string
  /** Server name */
  name: string
  /** Printer type */
  printer_kind: 'network' | 'usb' | 'serial'
  /** Printer address */
  printer_addr: string | null
  /** Whether server is active */
  active: boolean
}

export interface ValidationResult {
  /** Whether configuration is valid */
  isValid: boolean
  /** Error message if invalid */
  error?: string
  /** List of missing configuration items */
  missingConfig?: string[]
}

// ── Error Handling ───────────────────────────────────────────────────────────

export type PrintErrorType = 
  | 'network_timeout'
  | 'printer_offline'
  | 'printer_no_paper'
  | 'printer_error'
  | 'configuration_missing'
  | 'invalid_data'
  | 'unknown_error'

export interface PrintError {
  /** Type of error */
  type: PrintErrorType
  /** Human-readable error message */
  message: string
  /** Technical error details */
  details?: string
  /** Whether the operation can be retried */
  retryable: boolean
  /** Suggested recovery actions */
  suggestions?: string[]
}

export interface ErrorRecoveryService {
  /** Handle print errors and suggest recovery actions */
  handlePrintError(error: PrintError): ErrorRecoveryAction
  /** Suggest alternatives after consecutive failures */
  suggestAlternatives(consecutiveFailures: number): AlternativeAction[]
  /** Log error for diagnostics */
  logErrorForDiagnostics(error: PrintError, context: PrintContext): void
}

export interface ErrorRecoveryAction {
  /** Type of recovery action */
  type: 'retry' | 'alternative' | 'escalate'
  /** User-facing message */
  message: string
  /** Action to execute */
  action?: () => Promise<void>
}

export interface AlternativeAction {
  /** Action label */
  label: string
  /** Action description */
  description: string
  /** Action to execute */
  action: () => Promise<void>
}

export interface PrintContext {
  /** Restaurant ID */
  restaurantId: string
  /** Order ID */
  orderId: string
  /** Table ID */
  tableId: string
  /** Document type being printed */
  documentType: DocumentType
  /** User ID who initiated the request */
  userId?: string
}

// ── Extended Order Types ─────────────────────────────────────────────────────

export interface OrderPrintRequests {
  /** Precuenta request details */
  precuenta?: {
    requested: boolean
    timestamp?: Date
    status: 'pending' | 'completed' | 'failed'
    error?: string
  }
  /** Boleta request details */
  boleta?: {
    method?: 'print' | 'email'
    email?: string
    timestamp?: Date
    status: 'pending' | 'completed' | 'failed'
    error?: string
  }
}

// ── Restaurant Configuration Extension ───────────────────────────────────────

export interface RestaurantPrintSettings {
  /** Printer ID for precuenta documents */
  precuentaPrinterId?: string
  /** Printer ID for boleta documents */
  boletaPrinterId?: string
  /** Whether to auto-print precuenta (false for manual control) */
  autoPreCuenta: boolean
  /** Email address for sending documents */
  emailFromAddress?: string
  /** Timeout for print requests in milliseconds */
  printTimeout: number
}

// ── Document History Storage ─────────────────────────────────────────────────

export interface DocumentHistoryRecord {
  /** Record ID */
  id: string
  /** Restaurant ID */
  restaurant_id: string
  /** Table ID */
  table_id: string
  /** Order ID */
  order_id: string
  /** Document type */
  document_type: DocumentType
  /** Request status */
  status: 'pending' | 'completed' | 'failed'
  /** When request was made */
  requested_at: Date
  /** When request was completed */
  completed_at?: Date
  /** Error message if failed */
  error_message?: string
  /** Additional metadata */
  metadata: {
    email?: string
    print_server_id?: string
    notifier_response?: any
  }
}

// ── UI Component Props ───────────────────────────────────────────────────────

export interface ManualPrintControlsProps {
  /** Table ID */
  tableId: string
  /** Current order */
  order: OrderWithPrintState
  /** Restaurant ID */
  restaurantId: string
  /** Callback when print is requested — printerName is the selected CAJA printer */
  onPrintRequest: (type: 'precuenta', printerName?: string) => Promise<void>
  /** Current print state */
  printState: PrintRequestState
}

export interface ElectronicReceiptOptionsProps {
  /** Total amount */
  total: number
  /** Restaurant ID */
  restaurantId: string
  /** Callback when print option is selected */
  onPrintSelected: () => Promise<void>
  /** Callback when email option is selected */
  onEmailSelected: (email: string) => Promise<void>
  /** Callback when cancelled */
  onCancel: () => void
  /** Whether operation is in progress */
  loading: boolean
}

export interface EmailValidationState {
  /** Email address */
  email: string
  /** Whether email is valid */
  isValid: boolean
  /** Validation error message */
  error?: string
}

// ── Extended Order Interface ─────────────────────────────────────────────────

export interface OrderWithPrintState {
  /** Order ID */
  id: string
  /** Table ID */
  table_id: string
  /** Order status */
  status: string
  /** Order total */
  total: number
  /** Number of diners */
  pax: number | null
  /** Customer name */
  client_name: string | null
  /** Order notes */
  notes: string | null
  /** Creation timestamp */
  created_at: string
  /** Last update timestamp */
  updated_at: string
  /** Order items */
  order_items: Array<{
    id: string
    name: string
    quantity: number
    unit_price: number
    notes: string | null
    status: string
    destination: string | null
  }>
  /** Print request state */
  printRequests?: OrderPrintRequests
}