/**
 * Validación de RUT chileno.
 *
 * Formato aceptado: con o sin puntos, guión opcional, dígito verificador 0-9 o K.
 *   - "12.345.678-9"
 *   - "12345678-9"
 *   - "123456789" (sin guión, último char es DV)
 *
 * Implementa el algoritmo módulo-11 oficial del SII para el dígito verificador.
 *
 * Ley 19.628 (Protección de Datos): el RUT es PII. NUNCA loguearlo en plain
 * (audit logs, console.log, Sentry). Acá solo lo validamos y normalizamos.
 */

const RUT_BODY_RE = /^[0-9]+$/

/** Quita puntos y guiones, deja solo dígitos y la K/k del DV. */
export function normalizeRut(input: string): string {
  return input.replace(/[^0-9kK]/g, '').toUpperCase()
}

/** Calcula el dígito verificador usando módulo 11. */
function computeDV(body: string): string {
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const r = 11 - (sum % 11)
  if (r === 11) return '0'
  if (r === 10) return 'K'
  return String(r)
}

/** Valida un RUT chileno completo. Acepta múltiples formatos de entrada. */
export function isValidRut(input: string | null | undefined): boolean {
  if (!input) return false
  const norm = normalizeRut(input)
  if (norm.length < 2 || norm.length > 9) return false
  const body = norm.slice(0, -1)
  const dv = norm.slice(-1)
  if (!RUT_BODY_RE.test(body)) return false
  return computeDV(body) === dv
}

/** Formatea un RUT al estilo "12.345.678-9". Pasa el valor original si es
 *  inválido — el caller debe validar antes con isValidRut. */
export function formatRut(input: string): string {
  const norm = normalizeRut(input)
  if (norm.length < 2) return input
  const body = norm.slice(0, -1)
  const dv = norm.slice(-1)
  // Insert thousand separators
  const reversed = body.split('').reverse().join('')
  const grouped = reversed.match(/.{1,3}/g)?.join('.') ?? body
  const bodyFormatted = grouped.split('').reverse().join('')
  return `${bodyFormatted}-${dv}`
}
