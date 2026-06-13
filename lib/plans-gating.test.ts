import { describe, it, expect } from 'vitest'
import { requiredPlanForRoute, canAccessRoute, ROUTE_PLAN_REQUIRED } from './plans-gating'

describe('requiredPlanForRoute', () => {
  it('rutas no listadas → free (presencia digital base)', () => {
    expect(requiredPlanForRoute('/dashboard')).toBe('free')
    expect(requiredPlanForRoute('/carta')).toBe('free')
    expect(requiredPlanForRoute('/restaurante')).toBe('free')
    expect(requiredPlanForRoute('/modulos')).toBe('free')
  })

  it('matriz 2026-06: salón → starter, inteligencia → pro, escala → enterprise', () => {
    expect(requiredPlanForRoute('/mesas')).toBe('starter')
    expect(requiredPlanForRoute('/promociones')).toBe('starter')  // movido desde Pro
    expect(requiredPlanForRoute('/stock')).toBe('pro')
    expect(requiredPlanForRoute('/clientes')).toBe('pro')         // comensales
    expect(requiredPlanForRoute('/configuracion/geofencing')).toBe('enterprise')
  })

  it('matchea por prefijo para subrutas dinámicas (/mesas/123 → starter)', () => {
    expect(requiredPlanForRoute('/mesas/abc-123')).toBe('starter')
    expect(requiredPlanForRoute('/stock/items/xyz')).toBe('pro')
    expect(requiredPlanForRoute('/comandas/456')).toBe('starter')
  })

  it('el match más específico gana: /configuracion/comensales → pro, no starter de /configuracion/locations', () => {
    expect(requiredPlanForRoute('/configuracion/comensales')).toBe('pro')
    expect(requiredPlanForRoute('/configuracion/locations')).toBe('starter')
    expect(requiredPlanForRoute('/configuracion/api-keys')).toBe('enterprise')
  })

  it('no matchea prefijos parciales (/mes no debe matchear /mesas)', () => {
    expect(requiredPlanForRoute('/mes')).toBe('free')
  })
})

describe('canAccessRoute (combina jerarquía y alias Piloto)', () => {
  it('free puede al dashboard/carta pero NO a operación', () => {
    expect(canAccessRoute('free', '/dashboard')).toBe(true)
    expect(canAccessRoute('free', '/carta')).toBe(true)
    expect(canAccessRoute('free', '/mesas')).toBe(false)
    expect(canAccessRoute('free', '/stock')).toBe(false)
  })

  it('starter puede a salón pero NO a inteligencia', () => {
    expect(canAccessRoute('starter', '/mesas')).toBe(true)
    expect(canAccessRoute('starter', '/promociones')).toBe(true)
    expect(canAccessRoute('starter', '/stock')).toBe(false)
    expect(canAccessRoute('starter', '/clientes')).toBe(false)
  })

  it('pro entra a inteligencia pero NO a escala enterprise', () => {
    expect(canAccessRoute('pro', '/stock')).toBe(true)
    expect(canAccessRoute('pro', '/mermas')).toBe(true)
    expect(canAccessRoute('pro', '/configuracion/api-keys')).toBe(false)
  })

  it('piloto: mismo acceso que pro (alias)', () => {
    expect(canAccessRoute('piloto', '/stock')).toBe(true)
    expect(canAccessRoute('piloto', '/mermas')).toBe(true)
    expect(canAccessRoute('piloto', '/clientes')).toBe(true)
    expect(canAccessRoute('piloto', '/mesas')).toBe(true)
    expect(canAccessRoute('piloto', '/configuracion/api-keys')).toBe(false)
  })

  it('enterprise entra a todo', () => {
    expect(canAccessRoute('enterprise', '/mesas')).toBe(true)
    expect(canAccessRoute('enterprise', '/stock')).toBe(true)
    expect(canAccessRoute('enterprise', '/configuracion/geofencing')).toBe(true)
    expect(canAccessRoute('enterprise', '/agregar-sucursal')).toBe(true)
  })

  it('sidebar y URL guard usan la misma fuente: ROUTE_PLAN_REQUIRED', () => {
    // Smoke check: la matriz importada existe y tiene las rutas críticas
    expect(ROUTE_PLAN_REQUIRED['/mesas']).toBeDefined()
    expect(ROUTE_PLAN_REQUIRED['/stock']).toBeDefined()
    expect(ROUTE_PLAN_REQUIRED['/agregar-sucursal']).toBeDefined()
  })
})
