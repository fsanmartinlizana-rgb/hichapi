import { describe, it, expect } from 'vitest'
import { sanitizeMessagePrices, recoverMessageFromRawText } from './sanitize'

describe('sanitizeMessagePrices', () => {
  // Caso real reportado por el founder (2026-04-27):
  // Haiki escribió "Entre los dos platos + postre andan en $29.400" cuando
  // la suma real era $24.400. Los precios individuales sí estaban en menú,
  // pero $29.400 no — el sanitizer debe borrar esa oración.
  it('strippea la oración con el total inventado del bug del founder', () => {
    const menu = new Set([18500, 5900, 9900, 12000])
    const message =
      '¡Felicidades! 🎉 Te recomiendo el Salmón ($18.500). ' +
      'De postre la Leche Asada ($5.900) también es sin gluten. ' +
      'Entre los dos platos + postre andan en $29.400, perfecto para tu presupuesto. ' +
      '¿Te late?'

    const { sanitized, strippedCount } = sanitizeMessagePrices(message, menu)

    expect(strippedCount).toBe(1)
    expect(sanitized).not.toContain('$29.400')
    expect(sanitized).toContain('$18.500')
    expect(sanitized).toContain('$5.900')
    expect(sanitized).toContain('¡Felicidades!')
    expect(sanitized).toContain('¿Te late?')
  })

  it('no toca nada cuando todos los precios están en el menú', () => {
    const menu = new Set([18500, 5900])
    const message = 'Te recomiendo el Salmón ($18.500) y la Leche Asada ($5.900).'
    const { sanitized, strippedCount } = sanitizeMessagePrices(message, menu)
    expect(strippedCount).toBe(0)
    expect(sanitized).toBe(message)
  })

  it('strippea oración mixta cuando UN precio no está en el menú', () => {
    const menu = new Set([18500])
    const message =
      'Te ofrezco el Salmón ($18.500). El combo total queda en $24.400 con bebida.'
    const { sanitized, strippedCount } = sanitizeMessagePrices(message, menu)
    expect(strippedCount).toBe(1)
    expect(sanitized).toContain('$18.500')
    expect(sanitized).not.toContain('$24.400')
  })

  it('reconoce $X.XXX (formato chileno) y $X (sin separador) y $X,XXX', () => {
    const menu = new Set([18500, 5900, 30000])
    expect(sanitizeMessagePrices('Cuesta $18.500.', menu).strippedCount).toBe(0)
    expect(sanitizeMessagePrices('Cuesta $18500.', menu).strippedCount).toBe(0)
    expect(sanitizeMessagePrices('Cuesta $18,500.', menu).strippedCount).toBe(0)
    expect(sanitizeMessagePrices('Cuesta $30.000.', menu).strippedCount).toBe(0)
    expect(sanitizeMessagePrices('Cuesta $99.999.', menu).strippedCount).toBe(1)
  })

  it('mensaje sin precios queda intacto', () => {
    const menu = new Set([18500])
    const message = '¡Hola! ¿En qué te ayudo?'
    const { sanitized, strippedCount } = sanitizeMessagePrices(message, menu)
    expect(strippedCount).toBe(0)
    expect(sanitized).toBe(message)
  })

  it('strings vacíos pasan limpios', () => {
    expect(sanitizeMessagePrices('', new Set([18500])).sanitized).toBe('')
  })

  it('si TODO se strippea, devuelve el original (mejor que vacío)', () => {
    const menu = new Set([18500])
    const message = 'El total es $99.999. Otra opción cuesta $88.888.'
    const { sanitized } = sanitizeMessagePrices(message, menu)
    // Cae al fallback: mensaje original (preferimos eco bruto a vacío)
    expect(sanitized).toBe(message)
  })

  it('respeta puntos dentro de números — no rompe split de oraciones', () => {
    // El "." en $18.500 es separador de miles, no fin de oración.
    const menu = new Set([18500, 5900])
    const message = 'Salmón ($18.500). Leche ($5.900).'
    const { sanitized, strippedCount } = sanitizeMessagePrices(message, menu)
    expect(strippedCount).toBe(0)
    expect(sanitized).toBe(message)
  })

  it('preserva emojis y acentos', () => {
    const menu = new Set([18500])
    const message = '¡Qué onda! 🎉 Te recomiendo el Salmón ($18.500). ¿Te late?'
    const { sanitized } = sanitizeMessagePrices(message, menu)
    expect(sanitized).toContain('🎉')
    expect(sanitized).toContain('¡Qué onda!')
    expect(sanitized).toContain('¿Te late?')
  })
})

describe('recoverMessageFromRawText', () => {
  it('extrae message de un JSON completo', () => {
    const raw = '{"message": "Hola, ¿qué pides?", "action": "chat"}'
    expect(recoverMessageFromRawText(raw)).toBe('Hola, ¿qué pides?')
  })

  it('extrae message de un JSON truncado mid-string (caso max_tokens)', () => {
    // Haiku se quedó sin tokens en medio del campo "message"
    const raw = '{"message": "Te recomiendo el salmón a la plancha que es'
    const recovered = recoverMessageFromRawText(raw)
    expect(recovered).toBe('Te recomiendo el salmón a la plancha que es')
  })

  it('decodifica escapes simples de JSON', () => {
    const raw = '{"message": "Línea 1\\nLínea 2 con \\"comillas\\""}'
    expect(recoverMessageFromRawText(raw)).toBe('Línea 1\nLínea 2 con "comillas"')
  })

  it('devuelve null si no hay campo message rescatable', () => {
    expect(recoverMessageFromRawText('texto sin estructura')).toBeNull()
    expect(recoverMessageFromRawText('{"action": "chat"}')).toBeNull()
    expect(recoverMessageFromRawText('')).toBeNull()
  })

  it('devuelve null si el message está vacío', () => {
    expect(recoverMessageFromRawText('{"message": ""}')).toBeNull()
  })
})
