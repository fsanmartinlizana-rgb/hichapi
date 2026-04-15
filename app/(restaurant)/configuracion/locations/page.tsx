'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import { createClient } from '@/lib/supabase/client'
import {
  MapPin, Plus, Save, Trash2, Loader2, Store, Share2, Package, BarChart2,
  Building2, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface Location {
  id: string
  brand_id: string | null
  restaurant_id: string | null
  name: string
  slug: string | null
  address: string | null
  neighborhood: string | null
  phone: string | null
  whatsapp_number: string | null
  active: boolean
  sort_order: number
  share_menu_override: boolean | null
  share_stock_override: boolean | null
  share_reports_override: boolean | null
}

interface Brand {
  id: string
  name: string
  share_menu: boolean
  share_stock: boolean
  share_reports: boolean
}

export default function LocationsConfigPage() {
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [loading, setLoading]     = useState(true)
  const [saving,  setSaving]      = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [brand,     setBrand]     = useState<Brand | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [toast,    setToast]      = useState<string | null>(null)

  // Form state (create)
  const [form, setForm] = useState({
    name: '',
    address: '',
    neighborhood: '',
    phone: '',
    whatsapp_number: '',
  })

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    const [locsRes, brandRes] = await Promise.all([
      fetch(`/api/locations?restaurant_id=${restId}`),
      fetch(`/api/brands?restaurant_id=${restId}`),
    ])
    const locs   = await locsRes.json()
    const brandD = await brandRes.json()
    setLocations(locs.locations ?? [])
    setBrand(brandD.brand ?? null)
    setLoading(false)
  }, [restId])

  useEffect(() => { load() }, [load])

  // Realtime: cualquier cambio en locations o brand se refleja al toque
  useEffect(() => {
    if (!restId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`locations-cfg:${restId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations', filter: `restaurant_id=eq.${restId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brands' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restId, load])

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function createLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!restId || !form.name) return
    setSaving(true)
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restId, ...form }),
      })
      const j = await res.json()
      if (!res.ok) {
        notify(j.error ?? 'Error al crear local')
      } else {
        notify('Local creado')
        setShowCreate(false)
        setForm({ name: '', address: '', neighborhood: '', phone: '', whatsapp_number: '' })
        load()
      }
    } finally {
      setSaving(false)
    }
  }

  async function updateLocation(id: string, patch: Partial<Location>) {
    if (!restId) return
    const res = await fetch('/api/locations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restaurant_id: restId, ...patch }),
    })
    const j = await res.json()
    if (!res.ok) {
      notify(j.error ?? 'Error')
    } else {
      load()
    }
  }

  async function deleteLocation(id: string) {
    if (!restId) return
    if (!confirm('¿Eliminar este local? Las mesas y órdenes asociadas quedarán sin local.')) return
    const res = await fetch(`/api/locations?id=${id}&restaurant_id=${restId}`, { method: 'DELETE' })
    const j = await res.json()
    if (!res.ok) {
      notify(j.error ?? 'Error')
    } else {
      notify('Local eliminado')
      load()
    }
  }

  async function toggleBrand(field: 'share_menu' | 'share_stock' | 'share_reports', value: boolean) {
    if (!brand || !restId) return
    const res = await fetch('/api/brands', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: brand.id, restaurant_id: restId, [field]: value }),
    })
    if (res.ok) {
      setBrand(prev => prev ? { ...prev, [field]: value } : prev)
      notify(`${field.replace('_', ' ')} ${value ? 'activado' : 'desactivado'}`)
    }
  }

  const hasMultiple = locations.length > 1

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
            <Building2 size={20} className="text-[#FF6B35]" /> Locales y Marca
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            Gestiona tus sucursales y decide qué compartir entre ellas
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-black text-xs font-bold hover:bg-[#FF6B35]/90 transition-colors"
        >
          <Plus size={14} /> Agregar local
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-white/10 backdrop-blur border border-white/20 text-white px-4 py-2.5 rounded-xl text-sm animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {/* Brand sharing toggles */}
      {brand && hasMultiple && (
        <section className="bg-white/[0.02] border border-white/8 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-[#FF6B35]" />
            <h2 className="text-white font-semibold text-sm">Compartir entre locales — {brand.name}</h2>
          </div>
          <p className="text-white/40 text-xs">
            Configura qué se comparte por default entre los {locations.length} locales.
            Cada local puede override individualmente más abajo.
          </p>

          <div className="grid sm:grid-cols-3 gap-3">
            <ToggleCard
              icon={<BookIcon />}
              label="Compartir menú"
              desc="Un solo menú para todos los locales. Cambios se propagan al instante."
              value={brand.share_menu}
              onChange={v => toggleBrand('share_menu', v)}
            />
            <ToggleCard
              icon={<Package size={16} className="text-emerald-400" />}
              label="Compartir stock"
              desc="Inventario único. Ideal si compran insumos juntos."
              value={brand.share_stock}
              onChange={v => toggleBrand('share_stock', v)}
            />
            <ToggleCard
              icon={<BarChart2 size={16} className="text-blue-400" />}
              label="Reporte consolidado"
              desc="Dashboard único con métricas combinadas de todos los locales."
              value={brand.share_reports}
              onChange={v => toggleBrand('share_reports', v)}
            />
          </div>
        </section>
      )}

      {/* Locations list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
        </div>
      ) : locations.length === 0 ? (
        <EmptyState icon={MapPin} title="Sin locales" description="Todavía no tenés locales configurados. Agregá el primero arriba." />
      ) : (
        <div className="space-y-3">
          {locations.map(loc => (
            <LocationCard
              key={loc.id}
              location={loc}
              hasMultiple={hasMultiple}
              onUpdate={patch => updateLocation(loc.id, patch)}
              onDelete={() => deleteLocation(loc.id)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={createLocation} className="w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Store size={18} className="text-[#FF6B35]" /> Nuevo local
            </h3>
            <Input label="Nombre *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
            <Input label="Dirección" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} />
            <Input label="Barrio / Comuna" value={form.neighborhood} onChange={v => setForm(f => ({ ...f, neighborhood: v }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Teléfono" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
              <Input label="WhatsApp" value={form.whatsapp_number} onChange={v => setForm(f => ({ ...f, whatsapp_number: v }))} />
            </div>
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function ToggleCard({ icon, label, desc, value, onChange }: {
  icon: React.ReactNode
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`text-left p-4 rounded-xl border transition-all ${value ? 'bg-[#FF6B35]/10 border-[#FF6B35]/30' : 'bg-white/[0.02] border-white/8 hover:bg-white/5'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {icon}
        <div className={`w-9 h-5 rounded-full relative transition-colors ${value ? 'bg-[#FF6B35]' : 'bg-white/10'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-[18px]' : 'left-0.5'}`} />
        </div>
      </div>
      <p className="text-white font-semibold text-sm mb-0.5">{label}</p>
      <p className="text-white/35 text-xs leading-relaxed">{desc}</p>
    </button>
  )
}

function BookIcon() {
  return <Store size={16} className="text-yellow-400" />
}

function LocationCard({ location, hasMultiple, onUpdate, onDelete }: {
  location: Location
  hasMultiple: boolean
  onUpdate: (patch: Partial<Location>) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [name,    setName]      = useState(location.name)
  const [address, setAddress]   = useState(location.address ?? '')
  const [dirty,   setDirty]     = useState(false)

  useEffect(() => {
    setName(location.name)
    setAddress(location.address ?? '')
    setDirty(false)
  }, [location.id, location.name, location.address])

  function save() {
    onUpdate({ name, address })
    setDirty(false)
  }

  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center">
          <MapPin size={16} className="text-[#FF6B35]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{location.name}</p>
          <p className="text-white/40 text-xs truncate">{location.address ?? 'Sin dirección'}</p>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-white/40 text-xs hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-white/5 border border-white/8"
        >
          {expanded ? 'Cerrar' : 'Editar'}
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/8 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre" value={name} onChange={v => { setName(v); setDirty(true) }} />
            <Input label="Dirección" value={address} onChange={v => { setAddress(v); setDirty(true) }} />
          </div>

          {/* Override toggles — solo visibles si hay multiple locations */}
          {hasMultiple && (
            <div className="space-y-2 bg-white/[0.02] rounded-xl p-3 border border-white/5">
              <p className="text-white/50 text-xs font-medium">Override por local (deja vacío para heredar de la marca):</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Tri label="Menú"    value={location.share_menu_override}    onChange={v => onUpdate({ share_menu_override: v })} />
                <Tri label="Stock"   value={location.share_stock_override}   onChange={v => onUpdate({ share_stock_override: v })} />
                <Tri label="Reports" value={location.share_reports_override} onChange={v => onUpdate({ share_reports_override: v })} />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={12} /> Eliminar
            </button>
            <button
              onClick={save}
              disabled={!dirty}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF6B35] text-black text-xs font-bold hover:bg-[#FF6B35]/90 transition-colors disabled:opacity-40"
            >
              <Save size={12} /> Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Input({ label, value, onChange, required }: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-white/50 text-xs font-medium mb-1 block">{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#FF6B35]/40 transition-colors"
      />
    </label>
  )
}

function Tri({ label, value, onChange }: {
  label: string
  value: boolean | null
  onChange: (v: boolean | null) => void
}) {
  const states: [boolean | null, string, string][] = [
    [null,  'Heredar', 'bg-white/5 text-white/40'],
    [true,  'Sí',      'bg-emerald-500/15 text-emerald-400'],
    [false, 'No',      'bg-red-500/15 text-red-400'],
  ]
  return (
    <div>
      <p className="text-white/40 text-[10px] mb-1">{label}</p>
      <div className="flex rounded-lg overflow-hidden border border-white/8">
        {states.map(([v, txt, cls]) => (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            className={`flex-1 py-1 text-[10px] font-medium transition-colors ${value === v ? cls : 'text-white/25 hover:text-white/50'}`}
          >
            {txt}
          </button>
        ))}
      </div>
    </div>
  )
}
