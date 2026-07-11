'use client'

/**
 * Pantalla intermedia post-login:
 *   - 0 restaurantes → /modulos (panel base, sin sidebar útil)
 *   - 1 restaurante  → redirect a home según rol (owner→/dashboard, garzon→/garzon, etc.)
 *   - >1 restaurantes:
 *       · si hay localStorage 'hichapi_active_restaurant' válido → respeta
 *       · sino → muestra picker para elegir
 *
 * Resuelve el caso multi-tenant: un mismo correo puede ser owner en A y garzón
 * en B; necesita saber con cuál entra. Sin esta pantalla el dashboard cargaba
 * arbitrariamente el primero de la lista, sin pedir confirmación.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Store, ChefHat, Users, ShoppingBag, ArrowRight, LogOut } from 'lucide-react'
import HiChapiLogo from '@/components/landing/HiChapiLogo'

const ROLE_HOME: Record<string, string> = {
  owner:       '/dashboard',
  admin:       '/dashboard',
  supervisor:  '/dashboard',
  super_admin: '/dashboard',
  garzon:      '/garzon',
  waiter:      '/garzon',
  anfitrion:   '/mesas',
  cocina:      '/comandas',
}

const ROLE_LABEL: Record<string, string> = {
  owner:       'Propietario',
  admin:       'Administrador',
  supervisor:  'Supervisor',
  super_admin: 'Super admin',
  garzon:      'Garzón',
  waiter:      'Garzón',
  anfitrion:   'Anfitrión',
  cocina:      'Cocina',
}

const ROLE_ICON: Record<string, React.ElementType> = {
  owner:      Store,
  admin:      Store,
  supervisor: Store,
  super_admin: Store,
  garzon:     Users,
  waiter:     Users,
  anfitrion:  ShoppingBag,
  cocina:     ChefHat,
}

const LS_KEY = 'hichapi_active_restaurant'

interface Membership {
  restaurant_id: string
  role:          string
  restaurant: {
    id:           string
    name:         string
    slug:         string
    neighborhood: string | null
  }
}

export default function SeleccionarRestaurantePage() {
  const router = useRouter()
  const [memberships, setMemberships] = useState<Membership[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data, error: err } = await supabase
        .from('team_members')
        .select('restaurant_id, role, restaurants(id, name, slug, neighborhood)')
        .eq('user_id', user.id)
        .eq('active', true)

      if (cancelled) return

      if (err) {
        setError('No pudimos cargar tus restaurantes. Refrescá la página.')
        return
      }

      const list: Membership[] = (data ?? [])
        .map(raw => {
          const m = raw as unknown as {
            restaurant_id: string
            role: string
            restaurants: Membership['restaurant'] | Membership['restaurant'][] | null
          }
          const r = Array.isArray(m.restaurants) ? m.restaurants[0] : m.restaurants
          return r
            ? { restaurant_id: m.restaurant_id, role: m.role, restaurant: r }
            : null
        })
        .filter((m): m is Membership => m !== null)

      // 0 restaurantes → módulos (caso raro: cuenta sin membership)
      if (list.length === 0) {
        router.replace('/modulos')
        return
      }

      // 1 restaurante → redirect según rol (no hay nada que elegir)
      if (list.length === 1) {
        const m = list[0]
        try { window.localStorage.setItem(LS_KEY, m.restaurant_id) } catch {}
        router.replace(ROLE_HOME[m.role] ?? '/dashboard')
        return
      }

      // >1: si hay LS válido, respeta y redirige
      let saved: string | null = null
      try { saved = window.localStorage.getItem(LS_KEY) } catch {}
      const matched = saved ? list.find(m => m.restaurant_id === saved) : null
      if (matched) {
        router.replace(ROLE_HOME[matched.role] ?? '/dashboard')
        return
      }

      // Mostramos el picker
      setMemberships(list)
    })()
    return () => { cancelled = true }
  }, [router])

  function choose(m: Membership) {
    try { window.localStorage.setItem(LS_KEY, m.restaurant_id) } catch {}
    window.location.href = ROLE_HOME[m.role] ?? '/dashboard'
  }

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    try { window.localStorage.removeItem(LS_KEY) } catch {}
    router.replace('/login')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0A0A14] text-white p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <HiChapiLogo size={44} accentColor="#FFFFFF" className="mx-auto mb-3" />
          <h1 className="text-xl font-bold">¿Con qué restaurante querés entrar?</h1>
          <p className="text-white/45 text-sm mt-1">Tu cuenta tiene acceso a varios locales.</p>
        </div>

        {!memberships && !error && (
          <div className="flex items-center justify-center gap-2 text-white/50 text-sm py-10">
            <Loader2 size={14} className="animate-spin" /> Cargando…
          </div>
        )}

        {error && (
          <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs mb-3">
            {error}
          </div>
        )}

        {memberships && (
          <>
            <div className="space-y-2">
              {memberships.map(m => {
                const Icon = ROLE_ICON[m.role] ?? Store
                return (
                  <button
                    key={m.restaurant_id}
                    onClick={() => choose(m)}
                    className="w-full bg-[#13132A] border border-white/10 hover:border-[#FF6B35]/40 hover:bg-[#FF6B35]/5 rounded-2xl p-4 transition-colors flex items-center gap-3 text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/60 group-hover:text-[#FF6B35] group-hover:border-[#FF6B35]/30 transition-colors">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{m.restaurant.name}</p>
                      <p className="text-white/40 text-xs">
                        {ROLE_LABEL[m.role] ?? m.role}{m.restaurant.neighborhood ? ` · ${m.restaurant.neighborhood}` : ''}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-white/30 group-hover:text-[#FF6B35] transition-colors" />
                  </button>
                )
              })}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-white/40 hover:text-white text-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <LogOut size={12} /> Cerrar sesión
              </button>
              <Link
                href="/agregar-restaurante"
                className="text-[#FF6B35] hover:text-[#e55a2b] text-xs inline-flex items-center gap-1 transition-colors"
              >
                + Agregar otro restaurante
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
