/**
 * DTE (Documento Tributario Electrónico) Validation Service
 *
 * Provides comprehensive validation for boleta and factura data,
 * including Chilean RUT validation and automatic formatting.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BoletaData {
  /** Total amount — must be > 0 */
  total: number
  /** Order items — must have at least one item with price */
  items: DteItem[]
  /** Emisor (restaurant) data */
  emisor?: {
    rut?: string
    razon_social?: string
    giro?: string
  }
}

export interface FacturaData extends BoletaData {
  /** Receptor RUT — required for factura */
  rut_receptor: string
  /** Receptor business name — required for factura */
  razon_receptor: string
  /** Receptor business activity — required for factura */
  giro_receptor: string
  /** Receptor address — required for factura */
  direccion_receptor: string
  /** Receptor commune — required for factura */
  comuna_receptor: string
  /** Receptor email — optional */
  email_receptor?: string
}

export interface DteItem {
  /** Item name */
  name: string
  /** Quantity — must be > 0 */
  quantity: number
  /** Unit price — must be >= 0 */
  unit_price: number
}

export interface DteValidationResult {
  /** Whether all validation passed */
  isValid: boolean
  /** Field-specific error messages */
  errors: DteFieldError[]
}

export interface DteFieldError {
  /** Field identifier */
  field: string
  /** Human-readable error message in Spanish */
  message: string
}

export interface RutValidationResult {
  /** Whether the RUT is valid */
  isValid: boolean
  /** Error message if invalid */
  error?: string
}

// ── RUT Utilities ─────────────────────────────────────────────────────────────

/**
 * Strips formatting characters (dots and dashes) from a RUT string,
 * returning only digits and the check digit character.
 */
function stripRut(rut: string): string {
  return rut.replace(/\./g, '').replace(/-/g, '').trim()
}

/**
 * Computes the expected check digit for a Chilean RUT body (digits only).
 *
 * Algorithm:
 *   1. Multiply each digit from right to left by the sequence [2,3,4,5,6,7,2,3,…]
 *   2. Sum all products
 *   3. Compute 11 − (sum mod 11)
 *   4. Map: 11 → '0', 10 → 'K', otherwise the digit as string
 */
function computeCheckDigit(body: string): string {
  const digits = body.split('').reverse()
  const multipliers = [2, 3, 4, 5, 6, 7]
  let sum = 0

  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i], 10) * multipliers[i % multipliers.length]
  }

  const remainder = 11 - (sum % 11)

  if (remainder === 11) return '0'
  if (remainder === 10) return 'K'
  return String(remainder)
}

/**
 * Validates a Chilean RUT.
 *
 * Accepts formats:
 *   - With dots and dash: "76.354.771-K"
 *   - With dash only:     "76354771-K"
 *   - Raw:                "76354771K"
 *
 * Rules:
 *   - Body must be 7–8 digits
 *   - Check digit must be 0–9 or K (case-insensitive)
 *   - Check digit must match the computed value
 *
 * Validates: Requirement 7.4
 */
export function validateRut(rut: string): RutValidationResult {
  if (!rut || !rut.trim()) {
    return { isValid: false, error: 'El RUT es requerido' }
  }

  const stripped = stripRut(rut)

  // Must be 8–9 chars: 7-8 digit body + 1 check digit
  if (stripped.length < 8 || stripped.length > 9) {
    return {
      isValid: false,
      error: 'Formato de RUT inválido. Ej: 76.354.771-K'
    }
  }

  const body = stripped.slice(0, -1)
  const checkDigit = stripped.slice(-1).toUpperCase()

  // Body must be all digits
  if (!/^\d+$/.test(body)) {
    return {
      isValid: false,
      error: 'Formato de RUT inválido. Ej: 76.354.771-K'
    }
  }

  // Check digit must be digit or K
  if (!/^[\dK]$/.test(checkDigit)) {
    return {
      isValid: false,
      error: 'Dígito verificador inválido. Debe ser un número o K'
    }
  }

  const expected = computeCheckDigit(body)
  if (checkDigit !== expected) {
    return {
      isValid: false,
      error: `RUT inválido: dígito verificador incorrecto`
    }
  }

  return { isValid: true }
}

/**
 * Formats a Chilean RUT with dots and dash.
 *
 * Examples:
 *   "76354771K"   → "76.354.771-K"
 *   "76354771-K"  → "76.354.771-K"
 *   "12345678-9"  → "12.345.678-9"
 *   "9876543-3"   → "9.876.543-3"
 *
 * Returns the input unchanged if it cannot be parsed.
 *
 * Validates: Requirement 7.5
 */
export function formatRut(rut: string): string {
  if (!rut || !rut.trim()) return rut

  const stripped = stripRut(rut)

  if (stripped.length < 2) return rut

  const body = stripped.slice(0, -1)
  const checkDigit = stripped.slice(-1).toUpperCase()

  if (!/^\d+$/.test(body)) return rut

  // Add dots every 3 digits from the right
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${formattedBody}-${checkDigit}`
}

// ── Boleta Validation ─────────────────────────────────────────────────────────

/**
 * Validates data required for a boleta electrónica (document type 39).
 *
 * Checks:
 *   - total > 0
 *   - at least one item with valid quantity and price
 *
 * Validates: Requirement 7.1
 */
export function validateBoletaData(data: BoletaData): DteValidationResult {
  const errors: DteFieldError[] = []

  // Validate total
  if (data.total === undefined || data.total === null || isNaN(data.total)) {
    errors.push({
      field: 'total',
      message: 'El total es requerido'
    })
  } else if (data.total <= 0) {
    errors.push({
      field: 'total',
      message: 'El total debe ser mayor a 0'
    })
  }

  // Validate items
  if (!data.items || data.items.length === 0) {
    errors.push({
      field: 'items',
      message: 'Debe incluir al menos un item en la orden'
    })
  } else {
    data.items.forEach((item, index) => {
      if (!item.name || !item.name.trim()) {
        errors.push({
          field: `items[${index}].name`,
          message: `El item ${index + 1} debe tener un nombre`
        })
      }
      if (item.quantity === undefined || item.quantity <= 0) {
        errors.push({
          field: `items[${index}].quantity`,
          message: `El item ${index + 1} debe tener una cantidad válida`
        })
      }
      if (item.unit_price === undefined || item.unit_price < 0) {
        errors.push({
          field: `items[${index}].unit_price`,
          message: `El item ${index + 1} debe tener un precio válido`
        })
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ── Factura Validation ────────────────────────────────────────────────────────

/**
 * Validates data required for a factura electrónica (document type 33).
 *
 * Extends boleta validation with receptor fields:
 *   - rut_receptor (validated with check digit)
 *   - razon_receptor
 *   - giro_receptor
 *   - direccion_receptor
 *   - comuna_receptor
 *
 * Validates: Requirements 7.2, 7.3, 7.4
 */
export function validateFacturaData(data: FacturaData): DteValidationResult {
  // Start with boleta validation
  const boletaResult = validateBoletaData(data)
  const errors: DteFieldError[] = [...boletaResult.errors]

  // Validate RUT receptor
  if (!data.rut_receptor || !data.rut_receptor.trim()) {
    errors.push({
      field: 'rut_receptor',
      message: 'El RUT del receptor es requerido'
    })
  } else {
    const rutResult = validateRut(data.rut_receptor)
    if (!rutResult.isValid) {
      errors.push({
        field: 'rut_receptor',
        message: rutResult.error ?? 'RUT inválido'
      })
    }
  }

  // Validate razón social
  if (!data.razon_receptor || !data.razon_receptor.trim()) {
    errors.push({
      field: 'razon_receptor',
      message: 'La razón social del receptor es requerida'
    })
  }

  // Validate giro
  if (!data.giro_receptor || !data.giro_receptor.trim()) {
    errors.push({
      field: 'giro_receptor',
      message: 'El giro del receptor es requerido'
    })
  }

  // Validate dirección
  if (!data.direccion_receptor || !data.direccion_receptor.trim()) {
    errors.push({
      field: 'direccion_receptor',
      message: 'La dirección del receptor es requerida'
    })
  }

  // Validate comuna
  if (!data.comuna_receptor || !data.comuna_receptor.trim()) {
    errors.push({
      field: 'comuna_receptor',
      message: 'La comuna del receptor es requerida'
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ── Unified Entry Point ───────────────────────────────────────────────────────

/**
 * Unified DTE validation entry point.
 *
 * Routes to the appropriate validator based on document type:
 *   - 39 (boleta): validates total and items
 *   - 33 (factura): validates total, items, and all receptor fields
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function validateDteData(
  documentType: 39 | 33,
  data: BoletaData | FacturaData
): DteValidationResult {
  if (documentType === 33) {
    return validateFacturaData(data as FacturaData)
  }
  return validateBoletaData(data)
}

/**
 * Returns a map of field → error message for quick lookup in UI components.
 * Only includes fields that have errors.
 */
export function getFieldErrors(
  result: DteValidationResult
): Record<string, string> {
  return result.errors.reduce<Record<string, string>>((acc, err) => {
    acc[err.field] = err.message
    return acc
  }, {})
}
