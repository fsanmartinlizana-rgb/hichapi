/**
 * Lógica pura del checklist de onboarding ("Primeros pasos") del dashboard.
 * Aislada para unit-testear el cálculo de progreso sin React ni Supabase.
 *
 * El onboarding depende del PLAN (matriz 2026-06):
 *   - free            → perfil del restaurante + carta (vía import directo)
 *   - starter         → + mesas/QR + equipo
 *   - pro / piloto    → + stock inicial
 *   - enterprise      → igual que pro (sucursales se gestionan aparte)
 */

import { getPlanLevel } from '@/lib/plans'

export interface OnboardingFacts {
  menuItems:   number   // # de menu_items
  tables:      number   // # de mesas (QR)
  hasProfile:  boolean  // perfil del local completado (ej: barrio seteado)
  teamMembers: number   // # de miembros del equipo (incluye al dueño)
  stockItems:  number   // # de productos en stock
}

export interface OnboardingStep {
  id:    'perfil' | 'carta' | 'mesas' | 'equipo' | 'stock'
  label: string
  hint:  string
  href:  string
  cta:   string
  done:  boolean
}

const STARTER_LEVEL = getPlanLevel('starter')
const PRO_LEVEL     = getPlanLevel('pro')

/**
 * Construye los pasos del onboarding según plan + datos del restaurante.
 * El orden refleja la prioridad recomendada. Free ve solo perfil + carta;
 * la carta lleva directo al importador (?import=1) para acelerar la carga.
 */
export function computeOnboardingSteps(facts: OnboardingFacts, plan: string = 'free'): OnboardingStep[] {
  const level = getPlanLevel(plan)

  const steps: OnboardingStep[] = [
    {
      id: 'perfil',
      label: 'Completá la información de tu restaurante',
      hint: 'Dirección, barrio y datos para que HiChapi te muestre en el buscador.',
      href: '/restaurante',
      cta: 'Completar info',
      done: facts.hasProfile,
    },
    {
      id: 'carta',
      label: 'Cargá tu carta',
      hint: 'Importala en segundos desde una foto o PDF con IA.',
      href: '/carta?import=1',
      cta: 'Importar carta',
      done: facts.menuItems > 0,
    },
  ]

  if (level >= STARTER_LEVEL) {
    steps.push(
      {
        id: 'mesas',
        label: 'Creá tus mesas y códigos QR',
        hint: 'Cada mesa tiene su QR para que el cliente pida desde su celular.',
        href: '/mesas',
        cta: 'Crear mesas',
        done: facts.tables > 0,
      },
      {
        id: 'equipo',
        label: 'Invitá a tu equipo',
        hint: 'Sumá garzones y cocina para que operen desde sus celulares.',
        href: '/equipo',
        cta: 'Invitar equipo',
        done: facts.teamMembers > 1,
      },
    )
  }

  if (level >= PRO_LEVEL) {
    steps.push({
      id: 'stock',
      label: 'Cargá tu stock inicial',
      hint: 'Sacale una foto a tu inventario o boleta del proveedor y la IA lo carga.',
      href: '/stock',
      cta: 'Cargar stock',
      done: facts.stockItems > 0,
    })
  }

  return steps
}

/** % de avance (0-100) redondeado. */
export function onboardingProgress(steps: OnboardingStep[]): number {
  if (steps.length === 0) return 100
  const done = steps.filter(s => s.done).length
  return Math.round((done / steps.length) * 100)
}

/** True cuando todos los pasos están completos. */
export function isOnboardingComplete(steps: OnboardingStep[]): boolean {
  return steps.length > 0 && steps.every(s => s.done)
}
