import { describe, it, expect } from 'vitest'
import {
  PLANS, PLAN_COMMISSION_RATE, getPlanLevel, canAccessModule,
  MENU_IMPORT_AI_LIMIT,
} from './plans'

describe('matriz de planes 2026-06', () => {
  it('Piloto existe: $0 con comisión 2%', () => {
    expect(PLANS.piloto).toBeDefined()
    expect(PLANS.piloto.price).toBe(0)
    expect(PLAN_COMMISSION_RATE.piloto).toBe(0.02)
  })

  it('todos los demás planes tienen comisión 1%', () => {
    for (const p of ['free', 'starter', 'pro', 'enterprise']) {
      expect(PLAN_COMMISSION_RATE[p]).toBe(0.01)
    }
  })

  it('Piloto accede a nivel Pro (alias), no a Enterprise', () => {
    expect(getPlanLevel('piloto')).toBe(getPlanLevel('pro'))
    expect(canAccessModule('piloto', 'pro')).toBe(true)
    expect(canAccessModule('piloto', 'starter')).toBe(true)
    expect(canAccessModule('piloto', 'enterprise')).toBe(false)
  })

  it('Enterprise: precio de lista $79.990', () => {
    expect(PLANS.enterprise.price).toBe(79990)
    expect(PLANS.enterprise.priceLabel).toBe('$79.990')
  })

  it('Starter incluye reservas y promociones; ya no lista delivery', () => {
    expect(PLANS.starter.modules).toContain('reservations')
    expect(PLANS.starter.modules).toContain('promotions')
    expect(PLANS.starter.modules).not.toContain('delivery')
  })

  it('Pro incluye comensales (CRM) y dashboards configurables', () => {
    expect(PLANS.pro.modules).toContain('customers')
    expect(PLANS.pro.modules).toContain('configurable_dashboard')
  })

  it('Piloto tiene tope de import IA nivel Pro', () => {
    expect(MENU_IMPORT_AI_LIMIT.piloto).toBe(MENU_IMPORT_AI_LIMIT.pro)
  })

  it('jerarquía de acceso: free < starter < pro < enterprise', () => {
    expect(getPlanLevel('free')).toBeLessThan(getPlanLevel('starter'))
    expect(getPlanLevel('starter')).toBeLessThan(getPlanLevel('pro'))
    expect(getPlanLevel('pro')).toBeLessThan(getPlanLevel('enterprise'))
  })

  it('plan desconocido cae a nivel free (no rompe el gating)', () => {
    expect(getPlanLevel('inventado')).toBe(0)
  })
})
