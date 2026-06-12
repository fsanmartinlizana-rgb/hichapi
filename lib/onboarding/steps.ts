/**
 * Lógica pura del checklist de onboarding ("Primeros pasos") del dashboard.
 * Aislada para unit-testear el cálculo de progreso sin React ni Supabase.
 */

export interface OnboardingFacts {
  menuItems:   number   // # de menu_items
  tables:      number   // # de mesas (QR)
  hasProfile:  boolean  // perfil del local completado (ej: barrio seteado)
  teamMembers: number   // # de miembros del equipo (incluye al dueño)
}

export interface OnboardingStep {
  id:    'carta' | 'mesas' | 'perfil' | 'equipo'
  label: string
  hint:  string
  href:  string
  cta:   string
  done:  boolean
}

/**
 * Construye los pasos del onboarding con su estado done/pendiente a partir de
 * los datos del restaurante. El orden refleja la prioridad recomendada.
 */
export function computeOnboardingSteps(facts: OnboardingFacts): OnboardingStep[] {
  return [
    {
      id: 'carta',
      label: 'Cargá tu carta',
      hint: 'Subí tus platos (podés importarlos desde una foto o PDF).',
      href: '/carta',
      cta: 'Cargar carta',
      done: facts.menuItems > 0,
    },
    {
      id: 'mesas',
      label: 'Creá tus mesas y códigos QR',
      hint: 'Cada mesa tiene su QR para que el cliente pida desde su celular.',
      href: '/mesas',
      cta: 'Crear mesas',
      done: facts.tables > 0,
    },
    {
      id: 'perfil',
      label: 'Completá el perfil de tu local',
      hint: 'Dirección, barrio y datos para que aparezcas en el buscador.',
      href: '/restaurante',
      cta: 'Completar perfil',
      done: facts.hasProfile,
    },
    {
      id: 'equipo',
      label: 'Invitá a tu equipo',
      hint: 'Sumá garzones y cocina para que operen desde sus celulares.',
      href: '/equipo',
      cta: 'Invitar equipo',
      done: facts.teamMembers > 1,
    },
  ]
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
