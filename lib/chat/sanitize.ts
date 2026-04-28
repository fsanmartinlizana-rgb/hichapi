/**
 * Guardrails para los mensajes que el LLM devuelve en el chat de mesa
 * (`app/api/chat/table/route.ts`). Aislados acá para poder unit-testearlos
 * sin levantar la ruta entera con Supabase, Anthropic, etc.
 *
 * Por qué existen:
 *  - Haiku ocasionalmente inventa totales mal calculados aunque el prompt los
 *    prohíba (ej: "$18.500 + $5.900 = $29.400"). Si esto llega al cliente,
 *    perdemos confianza. `sanitizeMessagePrices` strippea oraciones con
 *    montos no presentes en el menú.
 *  - Cuando max_tokens corta la respuesta de Haiku a la mitad, `JSON.parse`
 *    truena y el usuario veía "Ups, no entendí bien". `recoverMessageFromRawText`
 *    extrae el campo `message` en bruto para degradar a `chat` action limpio.
 */

/** Una entrada como `$18.500` o `$5.900` o `$30000`. */
const PRICE_REGEX = /\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)/g

/**
 * Strippea oraciones del mensaje del modelo que contengan un `$X` que NO
 * coincida con ningún precio del menú. Defensa contra aritmética inventada
 * por el LLM (sumas/totales mal calculados).
 *
 * Si una oración tiene varios `$X` y al menos uno NO está en el menú, la
 * oración entera se elimina (preferimos perder contexto a mostrar precios
 * incorrectos).
 *
 * Edge case: si todas las oraciones se strippean, devuelve el original
 * para evitar mensaje vacío.
 */
export function sanitizeMessagePrices(
  message: string,
  menuPrices: Set<number>,
): { sanitized: string; strippedCount: number } {
  if (!message) return { sanitized: message, strippedCount: 0 }
  const sentences = message.split(/(?<=[.!?])\s+/)
  let strippedCount = 0
  const kept = sentences.filter(s => {
    const matches = [...s.matchAll(PRICE_REGEX)]
    if (matches.length === 0) return true
    const allValid = matches.every(m => {
      const num = parseInt(m[1].replace(/[.,]/g, ''), 10)
      return menuPrices.has(num)
    })
    if (!allValid) strippedCount++
    return allValid
  })
  const result = kept.join(' ').trim()
  return {
    sanitized: result || message,
    strippedCount,
  }
}

/**
 * Cuando el JSON del modelo viene truncado o malformado, intenta extraer
 * al menos el campo `message` del texto crudo y degradar a una respuesta
 * usable. Mejor mostrar el mensaje incompleto que el genérico "Ups, no
 * entendí bien" — el cliente al menos entiende algo.
 *
 * Returns null si no encuentra un message field rescatable.
 */
export function recoverMessageFromRawText(rawText: string): string | null {
  if (!rawText) return null
  // Match el campo message (con escape de comillas), abierto OK
  // (no requiere comilla de cierre — sirve para mid-stream cortado).
  const match = rawText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (!match) return null
  const raw = match[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim()
  return raw || null
}
