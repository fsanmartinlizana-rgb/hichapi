# Manual Print Control System

This module provides comprehensive manual printing control for waiters, allowing them to control when precuentas and electronic receipts are printed while preserving automatic kitchen/bar ticket printing.

## Features

- **Manual Precuenta Control**: Waiters can request precuenta printing on-demand
- **Electronic Receipt Options**: Choose between physical printing or email delivery
- **Printer Configuration Management**: Validate and manage printer settings
- **Document History Tracking**: Track all print requests with timestamps and status
- **Comprehensive Error Handling**: User-friendly error messages and recovery suggestions
- **Integration Ready**: Designed to integrate with existing notifier endpoints

## Architecture

The system is built with a modular architecture:

```
lib/manual-print/
├── types.ts              # Core TypeScript interfaces and types
├── errors.ts             # Error handling and recovery utilities
├── printer-config.ts     # Printer configuration service
├── document-history.ts   # Document request tracking service
├── hooks.ts              # React hooks for UI integration
├── index.ts              # Main exports and utilities
└── __tests__/            # Test files
```

## Core Types

### Print Request State
```typescript
interface PrintRequestState {
  precuentaRequested: boolean
  precuentaTimestamp?: Date
  precuentaStatus: 'idle' | 'loading' | 'success' | 'error'
  precuentaError?: string
  documentHistory: DocumentRequest[]
}
```

### Document Request
```typescript
interface DocumentRequest {
  id: string
  type: 'precuenta' | 'boleta_impresa' | 'boleta_email'
  timestamp: Date
  status: 'pending' | 'completed' | 'failed'
  error?: string
  metadata?: Record<string, any>
}
```

## Services

### PrinterConfigService
Manages printer configuration and validation:

```typescript
const printerService = getPrinterConfigService()

// Get precuenta printer
const printer = await printerService.getPreCuentaPrinter(restaurantId)

// Validate configuration
const validation = await printerService.validatePrinterConfig(restaurantId, 'precuenta')
```

### DocumentHistoryService
Tracks document request history:

```typescript
const historyService = getDocumentHistoryService()

// Create new request
const result = await historyService.createDocumentRequest(
  restaurantId, tableId, orderId, 'precuenta'
)

// Get order history
const history = await historyService.getOrderDocumentHistory(orderId)
```

### ErrorRecoveryService
Handles errors and provides recovery suggestions:

```typescript
const errorService = getErrorRecoveryService()

// Classify error
const printError = classifyPrintError(error)

// Get recovery action
const recovery = errorService.handlePrintError(printError)
```

## React Hooks

### usePrecuentaRequest
Manages precuenta printing requests:

```typescript
const {
  printState,
  loading,
  canRequest,
  requestPrecuenta,
  consecutiveFailures
} = usePrecuentaRequest(restaurantId, tableId, order)
```

### useElectronicReceipt
Handles electronic receipt options:

```typescript
const {
  loading,
  emailValidation,
  validateEmail,
  requestPrintReceipt,
  requestEmailReceipt
} = useElectronicReceipt(restaurantId, orderId, total)
```

### usePrinterStatus
Monitors printer availability:

```typescript
const {
  printerStatus,
  checkPrinterStatus
} = usePrinterStatus(restaurantId)
```

## Usage Examples

### Basic Precuenta Request
```typescript
import { usePrecuentaRequest } from '@/lib/manual-print'

function PrecuentaButton({ restaurantId, tableId, order }) {
  const { canRequest, requestPrecuenta, loading } = usePrecuentaRequest(
    restaurantId, tableId, order
  )
  
  return (
    <button
      onClick={requestPrecuenta}
      disabled={!canRequest || loading}
      className="btn-primary"
    >
      {loading ? 'Solicitando...' : 'Solicitar Precuenta'}
    </button>
  )
}
```

### Electronic Receipt Options
```typescript
import { useElectronicReceipt } from '@/lib/manual-print'

function ReceiptOptions({ restaurantId, orderId, total, onComplete }) {
  const {
    loading,
    emailValidation,
    validateEmail,
    requestPrintReceipt,
    requestEmailReceipt
  } = useElectronicReceipt(restaurantId, orderId, total)
  
  const handlePrint = async () => {
    const result = await requestPrintReceipt()
    if (result.success) onComplete()
  }
  
  const handleEmail = async () => {
    if (!emailValidation.isValid) return
    const result = await requestEmailReceipt(emailValidation.email)
    if (result.success) onComplete()
  }
  
  return (
    <div>
      <button onClick={handlePrint} disabled={loading}>
        Imprimir Boleta
      </button>
      
      <div>
        <input
          type="email"
          onChange={(e) => validateEmail(e.target.value)}
          placeholder="Email del cliente"
        />
        <button 
          onClick={handleEmail} 
          disabled={loading || !emailValidation.isValid}
        >
          Enviar por Email
        </button>
      </div>
    </div>
  )
}
```

## Error Handling

The system provides comprehensive error handling with user-friendly messages:

```typescript
import { classifyPrintError, getErrorMessage } from '@/lib/manual-print'

try {
  await requestPrecuenta()
} catch (error) {
  const printError = classifyPrintError(error)
  
  // Show user-friendly message
  showError(printError.message)
  
  // Check if retryable
  if (printError.retryable) {
    showRetryOption()
  }
  
  // Show suggestions
  printError.suggestions?.forEach(suggestion => {
    showSuggestion(suggestion)
  })
}
```

## Configuration

### Restaurant Print Settings
```typescript
interface RestaurantPrintSettings {
  precuentaPrinterId?: string
  boletaPrinterId?: string
  autoPreCuenta: boolean
  emailFromAddress?: string
  printTimeout: number
}
```

### Print Server Configuration
```typescript
interface PrintServer {
  id: string
  name: string
  printer_kind: 'network' | 'usb' | 'serial'
  printer_addr: string | null
  active: boolean
}
```

## Integration with Existing Systems

The manual print control system is designed to integrate seamlessly with:

- **Existing Order Management**: Extends current order types with print state
- **Notifier Endpoints**: Integrates with `/api/pre_cuenta` and `/api/solicita_boleta_electronica`
- **Print Infrastructure**: Uses existing print server configuration
- **UI Components**: Provides hooks for easy React integration

## Testing

Run the test suite:

```bash
npm test lib/manual-print/__tests__/types.test.ts
```

The tests cover:
- Type definitions and utilities
- Error classification and handling
- Email validation
- Print request validation
- Constants and configuration

## Requirements Addressed

This implementation addresses the following requirements from the specification:

- **1.1-1.7**: Manual precuenta control and error handling
- **2.1-2.4**: Elimination of automatic precuenta printing
- **3.1-3.7**: Electronic receipt options with email support
- **5.1-5.5**: Integration with existing printer configuration
- **6.1-6.6**: Document state tracking and history
- **7.1-7.6**: Data validation for tax documents
- **8.1-8.6**: Comprehensive error handling and recovery
- **9.1-9.6**: Touch-optimized UI support

## Next Steps

To complete the implementation:

1. **Create UI Components**: Build React components using the provided hooks
2. **Implement Notifier Service**: Create actual integration with notifier endpoints
3. **Add Database Schema**: Create tables for document history tracking
4. **Integration Testing**: Test with real printer hardware and notifier service
5. **Performance Optimization**: Add caching and optimize for high-frequency usage