import { describe, it, expect } from 'vitest'
import {
  computeOnboardingSteps, onboardingProgress, isOnboardingComplete,
  type OnboardingFacts,
} from './steps'

const facts = (over: Partial<OnboardingFacts> = {}): OnboardingFacts => ({
  menuItems: 0, tables: 0, hasProfile: false, teamMembers: 1, stockItems: 0, ...over,
})

describe('computeOnboardingSteps — por plan (matriz 2026-06)', () => {
  it('FREE: solo perfil + carta, en ese orden', () => {
    const steps = computeOnboardingSteps(facts(), 'free')
    expect(steps.map(s => s.id)).toEqual(['perfil', 'carta'])
  })

  it('FREE: la carta lleva directo al importador', () => {
    const carta = computeOnboardingSteps(facts(), 'free').find(s => s.id === 'carta')!
    expect(carta.href).toBe('/carta?import=1')
  })

  it('STARTER: + mesas + equipo', () => {
    const steps = computeOnboardingSteps(facts(), 'starter')
    expect(steps.map(s => s.id)).toEqual(['perfil', 'carta', 'mesas', 'equipo'])
  })

  it('PRO: + stock', () => {
    const steps = computeOnboardingSteps(facts(), 'pro')
    expect(steps.map(s => s.id)).toEqual(['perfil', 'carta', 'mesas', 'equipo', 'stock'])
  })

  it('PILOTO: mismo onboarding que Pro (alias de nivel)', () => {
    const piloto = computeOnboardingSteps(facts(), 'piloto').map(s => s.id)
    const pro    = computeOnboardingSteps(facts(), 'pro').map(s => s.id)
    expect(piloto).toEqual(pro)
  })

  it('ENTERPRISE: igual que Pro', () => {
    const steps = computeOnboardingSteps(facts(), 'enterprise')
    expect(steps.map(s => s.id)).toEqual(['perfil', 'carta', 'mesas', 'equipo', 'stock'])
  })

  it('plan desconocido o vacío → trata como free', () => {
    expect(computeOnboardingSteps(facts(), 'cualquiercosa').map(s => s.id)).toEqual(['perfil', 'carta'])
  })

  it('marca done según los datos', () => {
    const steps = computeOnboardingSteps(facts({ menuItems: 5, hasProfile: true }), 'free')
    expect(steps.find(s => s.id === 'perfil')?.done).toBe(true)
    expect(steps.find(s => s.id === 'carta')?.done).toBe(true)
  })

  it('equipo done solo con MÁS de 1 miembro; stock done con stockItems>0', () => {
    const steps = computeOnboardingSteps(facts({ teamMembers: 2, stockItems: 3 }), 'pro')
    expect(steps.find(s => s.id === 'equipo')?.done).toBe(true)
    expect(steps.find(s => s.id === 'stock')?.done).toBe(true)
  })
})

describe('onboardingProgress / isOnboardingComplete', () => {
  it('FREE completo con solo perfil + carta', () => {
    const steps = computeOnboardingSteps(facts({ menuItems: 1, hasProfile: true }), 'free')
    expect(onboardingProgress(steps)).toBe(100)
    expect(isOnboardingComplete(steps)).toBe(true)
  })

  it('PRO a mitad de camino', () => {
    // perfil ✓, carta ✓, mesas ✗, equipo ✗, stock ✗ → 2/5 = 40%
    const steps = computeOnboardingSteps(facts({ menuItems: 1, hasProfile: true }), 'pro')
    expect(onboardingProgress(steps)).toBe(40)
    expect(isOnboardingComplete(steps)).toBe(false)
  })
})
