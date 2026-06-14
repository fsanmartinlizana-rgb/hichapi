'use client'

/**
 * /perfil/restaurantes — "Mis restaurantes"
 *
 * Vista para que el usuario vea todos los locales donde tiene membresía activa,
 * con su rol en cada uno, y pueda salir voluntariamente (revocar su propia
 * membresía). No permite salir si es el único owner activo: en ese caso
 * mostramos un mensaje claro y bloqueamos la acción del lado server también.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  Loader2, Store, ChefHat, Users, ShoppingBag, LogOut, AlertCircle,
  ArrowRight, ExternalLink, Plus,
} from 'lucide-react'

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
  owner: Store, admin: Store, supervisor: Store, super_admin: Store,
  garzon: Users, waiter: Users,
  anfitrion: ShoppingBag, cocina: ChefHat,
}

interface Membership {
  team_member_id: string
  restaurant_id:  string
  role:           string
  name:           string
  slug:           string
  neighborhood:   string | null
}

export default function MisRestaurantesPage() {
  const router = useRouter()
  const { refresh, restaurant: current } = useRestaurant()

  const [list, setList]       = useState<Membership[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [leaving, setLeaving] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState<Membership | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    const { data, error: err } = await supabase
      .from('team_members')
      .select('id, role, restaurant_id, restaurants(name, slug, neighborhood)')
      .eq('user_id', user.id)
      .eq('active', true)

    if (err) {
      setError('No pudimos cargar tus restaurantes.')
      setLoading(false)
      return
    }

    const out: Membership[] = (data ?? []).map(m => {
      const r = (m as { restaurants: unknown }).restaurants
      const rest = Array.isArray(r) ? r[0] : r
      return {
        team_member_id: (m as { id: string }).id,
        restaurant_id:  (m as { restaurant_id: string }).restaurant_id,
        role:           (m as { role: string }).role,
        name:           (rest as { name: string })?.name ?? '—',
        slug:           (rest as { slug: string })?.slug ?? '',
        neighborhood:   (rest as { neighborhood: string | null })?.neighborhood ?? null,
      }
    })
    setList(out)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  async function doLeave(m: Membership) {
    setLeaving(m.restaurant_id)
    setError(null)
    try {
      const res = await fetch('/api/me/memberships/leave', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ restaurant_id: m.restaurant_id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No pudimos procesar la salida.')
        setLeaving(null)
        setConfirmLeave(null)
        return
      }
      setConfirmLeave(null)
      // Si salí del restaurante actual, recargamos contexto y mandamos a elegir
      if (current?.id === m.restaurant_id) {
        try { window.localStorage.removeItem('hichapi_active_restaurant') } catch {}
        await refresh()
        router.replace('/seleccionar-restaurante')
        return
      }
      await load()
      await refresh()
    } finally {
      setLeaving(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-white text-2xl font-bold">Mis restaurantes</h1>
          <p className="text-white/50 text-sm mt-1">
            Locales donde tu cuenta tiene acceso. Podés cambiar entre ellos desde la barra lateral.
          </p>
        </div>
        <Link
          href="/agregar-restaurante"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/30 text-[#FF6B35] text-xs font-semibold hover:bg-[#FF6B35]/15 transition-colors"
        >
          <Plus size={12} /> Agregar restaurante
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs mb-4">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 text-white/50 text-sm py-10">
          <Loader2 size={14} className="animate-spin" /> Cargando…
        </div>
      )}

      {!loading && list && list.length === 0 && (
        <p className="text-white/40 text-sm py-8 text-center">No tenés restaurantes activos.</p>
      )}

      {!loading && list && list.length > 0 && (
        <div className="space-y-2">
          {list.map(m => {
            const Icon = ROLE_ICON[m.role] ?? Store
            const isCurrent = current?.id === m.restaurant_id
            return (
              <div
                key={m.team_member_id}
                className={`bg-[#13132A] border rounded-2xl p-4 flex items-center gap-3 ${
                  isCurrent ? 'border-[#FF6B35]/40' : 'border-white/10'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/60 shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {m.name}
                    {isCurrent && <span className="ml-2 text-[10px] uppercase tracking-wider text-[#FF6B35]/80">actual</span>}
                  </p>
                  <p className="text-white/40 text-xs">
                    {ROLE_LABEL[m.role] ?? m.role}
                    {m.neighborhood ? ` · ${m.neighborhood}` : ''}
                  </p>
                </div>
                <Link
                  href={`/r/${m.slug}`}
                  target="_blank"
                  className="text-white/40 hover:text-white text-xs inline-flex items-center gap-1 transition-colors"
                  title="Ver perfil público"
                >
                  <ExternalLink size={12} />
                </Link>
                <button
                  onClick={() => setConfirmLeave(m)}
                  disabled={leaving === m.restaurant_id}
                  className="text-white/40 hover:text-red-300 text-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {leaving === m.restaurant_id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <LogOut size={12} />
                  )}
                  Salir
                </button>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-white/30 text-[11px] mt-6 leading-relaxed">
        Al salir de un local, perdés acceso a su panel. Si sos el único propietario activo,
        tenés que transferir la propiedad o dar de baja el restaurante antes de salir.
        El historial de tu participación se conserva.
      </p>

      {/* Modal de confirmación */}
      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmLeave(null)} />
          <div className="relative bg-[#161622] border border-white/10 rounded-2xl w-full max-w-md p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-300 shrink-0">
                <LogOut size={16} />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Salir de {confirmLeave.name}</h3>
                <p className="text-white/50 text-xs mt-1">
                  Vas a perder acceso al panel de este restaurante. Para volver a entrar, el propietario
                  tendrá que invitarte de nuevo. ¿Confirmás?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => doLeave(confirmLeave)}
                disabled={!!leaving}
                className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {leaving && <Loader2 size={14} className="animate-spin" />}
                Sí, salir
              </button>
              <button
                onClick={() => setConfirmLeave(null)}
                className="w-full py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
