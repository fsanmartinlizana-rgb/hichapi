import { describe, it, expect } from 'vitest'
import { normalizeWhatsappPhone, buildWhatsappWaitlistUrl } from './whatsapp'

describe('normalizeWhatsappPhone', () => {
  it('formato chileno completo con + y espacios → 56 + dígitos', () => {
    expect(normalizeWhatsappPhone('+56 9 1234 5678')).toBe('56912345678')
  })

  it('móvil sin código país → antepone 56', () => {
    expect(normalizeWhatsappPhone('9 1234 5678')).toBe('56912345678')
    expect(normalizeWhatsappPhone('912345678')).toBe('56912345678')
  })

  it('ya tiene 56 → no duplica', () => {
    expect(normalizeWhatsappPhone('56912345678')).toBe('56912345678')
    expect(normalizeWhatsappPhone('+56912345678')).toBe('56912345678')
  })

  it('limpia guiones, paréntesis y puntos', () => {
    expect(normalizeWhatsappPhone('(56) 9-1234.5678')).toBe('56912345678')
  })

  it('vacío / null / undefined → null (degradar a marcar avisado)', () => {
    expect(normalizeWhatsappPhone('')).toBeNull()
    expect(normalizeWhatsappPhone(null)).toBeNull()
    expect(normalizeWhatsappPhone(undefined)).toBeNull()
    expect(normalizeWhatsappPhone('   ')).toBeNull()
    expect(normalizeWhatsappPhone('---')).toBeNull()
  })
})

describe('buildWhatsappWaitlistUrl', () => {
  it('construye wa.me con teléfono normalizado y mensaje encodeado', () => {
    const url = buildWhatsappWaitlistUrl('+56 9 1234 5678', 'María', 'Sazón Patagónica')
    expect(url).toMatch(/^https:\/\/wa\.me\/56912345678\?text=/)
    expect(url).toContain(encodeURIComponent('Hola María'))
    expect(url).toContain(encodeURIComponent('Sazón Patagónica'))
  })

  it('mensaje incluye nombre del cliente y del restaurante', () => {
    const url = buildWhatsappWaitlistUrl('912345678', 'Juan', 'Osaka')!
    const decoded = decodeURIComponent(url.split('text=')[1])
    expect(decoded).toContain('Hola Juan')
    expect(decoded).toContain('Osaka')
    expect(decoded).toContain('tu mesa ya está lista')
  })

  it('sin teléfono → null (no abre pestaña rota)', () => {
    expect(buildWhatsappWaitlistUrl('', 'Ana', 'X')).toBeNull()
    expect(buildWhatsappWaitlistUrl(null, 'Ana', 'X')).toBeNull()
  })

  it('caracteres especiales en nombres se encodean (no rompen la URL)', () => {
    const url = buildWhatsappWaitlistUrl('912345678', 'José & Cía', 'Bar #1')!
    // No debe contener & ni # crudos en el querystring del mensaje
    const text = url.split('text=')[1]
    expect(text).not.toContain(' ')
    expect(decodeURIComponent(text)).toContain('José & Cía')
  })
})
