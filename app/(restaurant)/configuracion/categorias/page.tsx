'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, Plus, Save, Trash2, Loader2, MapPin, ChefHat, Check, X,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface Category {
  id: string
  brand_id: string | null
  restaurant_id: string | null
  name: string
  slug: string | null
  sort_order: number
  active: boolean
}

interface Station {
  id: string
  restaurant_id: string
  location_id: string | null
  name: string
  kind: string
  locations?: { id: string; name: string } | null
}

interface Route {
  id: string
  category_id: string
  station_id: string
  is_primary: boolean
  stations: {
    id: string
    name: string
    kind: string
    location_id: string | null
    locations: { id: string; name: string } | null
  } | null
}

export default function CategoriasPage() {
  const { restaurant } = useRestaurant()
  const restId  = restaurant?.id
  const brandId = restaurant?.brand_id ?? null

  const [loading, setLoading]       = useState(true)
  const [saving,  setSaving]        = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [stations,   setStations]   = useState<Station[]>([])
  const [routes,     setRoutes]     = useState<Route[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [toast,    setToast]        = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', shared_in_brand: true })

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    const catsUrl     = brandId ? `/api/categories?brand_id=${brandId}` : `/api/categories?restaurant_id=${restId}`
    const stationsUrl = brandId ? `/api/stations?brand_id=${brandId}`   : `/api/stations?restaurant_id=${restId}`
    const [cRes, sRes, rRes] = await Promise.all([
      fetch(catsUrl),
      fetch(stationsUrl),
      fetch(`/api/category-routing?restaurant_id=${restId}`),
    ])
    const [c, s, r] = await Promise.all([cRes.json(), sRes.json(), rRes.json()])
    setCategories(c.categories ?? [])
    setStations(s.stations ?? [])
    setRoutes(r.routes ?? [])
    setLoading(false)
  }, [restId, brandId])

  useEffect(() => { load() }, [load])

  // Realtime: reflejar cambios en categories o routing
  useEffect(() => {
    if (!restId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`cats-cfg:${restId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_category_station' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restId, load])

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!restId || !form.name) return
    setSaving(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id:   restId,
          name:            form.name,
          shared_in_brand: form.shared_in_brand && !!brandId,
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        notify(j.error ?? 'Error al crear categoría')
      } else {
        notify('Categoría creada')
        setShowCreate(false)
        setForm({ name: '', shared_in_brand: true })
        load()
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteCategory(id: string) {
    if (!restId) return
    if (!confirm('¿Eliminar categoría? Los platos que la usen no se borran, pero quedarán sin routing default.')) return
    const res = await fetch(`/api/categories?id=${id}&restaurant_id=${restId}`, { method: 'DELETE' })
    if (res.ok) {
      notify('Categoría eliminada')
      load()
    }
  }

  async function saveRouting(categoryId: string, stationIds: string[], primaryId: string | null) {
    if (!restId) return
    const res = await fetch('/api/category-routing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: restId,
        category_id:   categoryId,
        station_ids:   stationIds,
        primary_id:    primaryId,
      }),
    })
    const j = await res.json()
    if (!res.ok) {
      notify(j.error ?? 'Error al guardar ruteo')
    } else {
      notify('Ruteo guardado')
      load()
    }
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <BookOpen size={20} className="text-[#FF6B35]" /> Categorías y ruteo
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            Define qué categoría va a qué estación (cocina, barra, horno) en cada local
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-black text-xs font-bold hover:bg-[#FF6B35]/90 transition-colors"
        >
          <Plus size={14} /> Nueva categoría
        </button>
      </div>

      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-white/10 backdrop-blur border border-white/20 text-white px-4 py-2.5 rounded-xl text-sm animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {stations.length === 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-300/90 flex gap-2">
          <ChefHat size={16} className="shrink-0 mt-0.5" />
          <div>
            No hay estaciones creadas aún. Anda a <span className="font-semibold">Configuración → Estaciones</span> para crear al menos una (Cocina, Barra, Horno, etc.) y después volver acá a rutear las categorías.
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Sin categorías"
          description="Creá la primera categoría (ej: Pizzas, Hamburguesas, Entradas). Después le asignás a qué estación se rutea."
        />
      ) : (
        <div className="space-y-3">
          {categories.map(cat => {
            const catRoutes = routes.filter(r => r.category_id === cat.id)
            return (
              <CategoryCard
                key={cat.id}
                category={cat}
                stations={stations}
                routes={catRoutes}
                onSaveRouting={(stationIds, primaryId) => saveRouting(cat.id, stationIds, primaryId)}
                onDelete={() => deleteCategory(cat.id)}
              />
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={createCategory} className="w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <BookOpen size={18} className="text-[#FF6B35]" /> Nueva categoría
            </h3>
            <label className="block">
              <span className="text-white/50 text-xs font-medium mb-1 block">Nombre *</span>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Pizzas, Hamburguesas, Entradas"
                required
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#FF6B35]/40"
              />
            </label>

            {brandId && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.shared_in_brand}
                  onChange={e => setForm(f => ({ ...f, shared_in_brand: e.target.checked }))}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-white text-xs font-medium">Compartir con todos los locales de la marca</p>
                  <p className="text-white/35 text-[10px]">Si la destildas, esta categoría solo existe en el local actual.</p>
                </div>
              </label>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving || !form.name} className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] text-black text-sm font-bold hover:bg-[#FF6B35]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Crear
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ── Category card with routing editor ────────────────────────────────────────

function CategoryCard({ category, stations, routes, onSaveRouting, onDelete }: {
  category: Category
  stations: Station[]
  routes: Route[]
  onSaveRouting: (stationIds: string[], primaryId: string | null) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const initialIds   = routes.map(r => r.station_id)
  const initialPrim  = routes.find(r => r.is_primary)?.station_id ?? null
  const [selected,  setSelected]  = useState<string[]>(initialIds)
  const [primary,   setPrimary]   = useState<string | null>(initialPrim)

  useEffect(() => {
    if (!editing) {
      setSelected(initialIds)
      setPrimary(initialPrim)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, editing])

  function toggleStation(id: string) {
    setSelected(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      // Si quitamos la primary, reseteamos primary
      if (!next.includes(primary ?? '')) setPrimary(next[0] ?? null)
      return next
    })
  }

  async function save() {
    await onSaveRouting(selected, primary)
    setEditing(false)
  }

  // Agrupar stations por location
  const byLocation = new Map<string, Station[]>()
  stations.forEach(s => {
    const loc = s.locations?.name ?? 'Sin local'
    if (!byLocation.has(loc)) byLocation.set(loc, [])
    byLocation.get(loc)!.push(s)
  })

  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center">
          <BookOpen size={16} className="text-[#FF6B35]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-semibold text-sm">{category.name}</p>
            {category.brand_id && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300/90 font-semibold">Compartida</span>
            )}
            {!category.active && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">Inactiva</span>
            )}
          </div>
          <p className="text-white/40 text-xs flex items-center gap-1.5 flex-wrap mt-0.5">
            {routes.length === 0 ? (
              <span className="text-yellow-400/70">Sin ruteo — no se envía a ninguna estación</span>
            ) : (
              routes.map(r => (
                <span key={r.id} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${r.is_primary ? 'bg-[#FF6B35]/15 text-[#FF6B35]' : 'bg-white/5 text-white/50'}`}>
                  <ChefHat size={9} /> {r.stations?.name ?? '?'}
                  {r.stations?.locations && <><span>·</span><MapPin size={9} /> {r.stations.locations.name}</>}
                  {r.is_primary && <span className="text-[9px] opacity-80">(principal)</span>}
                </span>
              ))
            )}
          </p>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className="text-white/40 text-xs hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-white/5 border border-white/8"
        >
          {editing ? 'Cerrar' : 'Rutear'}
        </button>
      </div>

      {editing && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/8 pt-4">
          {stations.length === 0 ? (
            <p className="text-white/40 text-xs italic">No hay estaciones creadas. Creá al menos una en Configuración → Estaciones.</p>
          ) : (
            <>
              <p className="text-white/60 text-xs font-medium">Estaciones que reciben esta categoría:</p>
              <div className="space-y-3">
                {[...byLocation.entries()].map(([locName, sts]) => (
                  <div key={locName}>
                    <p className="text-white/35 text-[10px] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <MapPin size={10} /> {locName}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {sts.map(s => {
                        const checked = selected.includes(s.id)
                        const isPrim  = primary === s.id
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleStation(s.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors text-left ${
                              checked
                                ? isPrim
                                  ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35]'
                                  : 'bg-white/10 border-white/20 text-white'
                                : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5'
                            }`}
                          >
                            {checked ? <Check size={12} /> : <ChefHat size={12} />}
                            <span className="flex-1 truncate">{s.name}</span>
                            {checked && (
                              <span
                                role="button"
                                onClick={(ev) => { ev.stopPropagation(); setPrimary(s.id) }}
                                className={`text-[9px] px-1 py-0.5 rounded ${isPrim ? 'bg-[#FF6B35] text-black' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
                              >
                                {isPrim ? 'Principal' : 'Set'}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-white/25 text-[10px]">
                Marcá con &quot;Set&quot; para elegir la station <span className="text-[#FF6B35]">principal</span> donde se prepara el plato (las otras reciben notificación).
              </p>
            </>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={12} /> Eliminar categoría
            </button>
            <button
              onClick={() => { setEditing(false); setSelected(initialIds); setPrimary(initialPrim) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 transition-colors"
            >
              <X size={12} /> Cancelar
            </button>
            <button
              onClick={save}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF6B35] text-black text-xs font-bold hover:bg-[#FF6B35]/90 transition-colors"
            >
              <Save size={12} /> Guardar ruteo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
