import { describe, it, expect } from 'vitest'
import {
  computeOnboardingSteps, onboardingProgress, isOnboardingComplete,
  type OnboardingFacts,
} from './steps'

const facts = (over: Partial<OnboardingFacts> = {}): OnboardingFacts => ({
  menuItems: 0, tables: 0, hasProfile: false, teamMembers: 1, ...over,
})

describe('computeOnboardingSteps', () => {
  it('restaurante vacío → todos pendientes', () => {
    const steps = computeOnboardingSteps(facts())
    expect(steps.map(s => s.done)).toEqual([false, false, false, false])
    expect(steps.map(s => s.id)).toEqual(['carta', 'mesas', 'perfil', 'equipo'])
  })

  it('con carta → solo carta done', () => {
    const steps = computeOnboardingSteps(facts({ menuItems: 5 }))
    expect(steps.find(s => s.id === 'carta')?.done).toBe(true)
    expect(steps.find(s => s.id === 'mesas')?.done).toBe(false)
  })

  it('con mesas → mesas done', () => {
    expect(computeOnboardingSteps(facts({ tables: 8 })).find(s => s.id === 'mesas')?.done).toBe(true)
  })

  it('perfil done solo si hasProfile', () => {
    expect(computeOnboardingSteps(facts({ hasProfile: true })).find(s => s.id === 'perfil')?.done).toBe(true)
  })

  it('equipo done solo con MÁS de 1 miembro (el dueño solo no cuenta)', () => {
    expect(computeOnboardingSteps(facts({ teamMembers: 1 })).find(s => s.id === 'equipo')?.done).toBe(false)
    expect(computeOnboardingSteps(facts({ teamMembers: 2 })).find(s => s.id === 'equipo')?.done).toBe(true)
  })

  it('cada paso tiene href y cta', () => {
    for (const s of computeOnboardingSteps(facts())) {
      expect(s.href).toMatch(/^\//)
      expect(s.cta.length).toBeGreaterThan(0)
    }
  })
})

describe('onboardingProgress', () => {
  it('0% vacío, 100% completo, 50% mitad', () => {
    expect(onboardingProgress(computeOnboardingSteps(facts()))).toBe(0)
    expect(onboardingProgress(computeOnboardingSteps(facts({ menuItems: 1, tables: 1, hasProfile: true, teamMembers: 3 })))).toBe(100)
    expect(onboardingProgress(computeOnboardingSteps(facts({ menuItems: 1, tables: 1 })))).toBe(50)
  })
})

describe('isOnboardingComplete', () => {
  it('true solo cuando todo está done', () => {
    expect(isOnboardingComplete(computeOnboardingSteps(facts()))).toBe(false)
    expect(isOnboardingComplete(computeOnboardingSteps(facts({ menuItems: 1, tables: 1, hasProfile: true, teamMembers: 2 })))).toBe(true)
  })
})
