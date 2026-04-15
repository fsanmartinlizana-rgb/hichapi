'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import { createClient } from '@/lib/supabase/client'
import {
  ChefHat, Plus, Save, Trash2, Loader2, Printer, MapPin,
  Flame, Snowflake, Wine, Cookie, Utensils,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface Station {
  id: string
  restaurant_id: string
  location_id: string | null
  name: string
  kind: string
  print_server_id: string | null
  color: string | null
  sort_order: number
  active: boolean
  locations?: { name: string } | null
}

interface Location { id: string; name: string }
interface PrintServer { id: string; name: string; printer_kind: string }

const KIND_OPTIONS: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: 'cocina',          label: 'Cocina (general)',  icon: <ChefHat size={14} /> },
  { value: 'cocina_caliente', label: 'Cocina caliente',   icon: <Flame size={14} /> },
  { value: 'cocina_fria',     label: 'Cocina fría',       icon: <Snowflake size={14} /> },
  { value: 'parrilla',        label: 'Parrilla',          icon: <Flame size={14} /> },
  { value: 'horno',           label: 'Horno / Pizzas',    icon: <Flame size={14} /> },
  { value: 'barra',           label: 'Barra',             icon: <Wine size={14} /> },
  { value: 'postres',         label: 'Postres',           icon: <Cookie size={14} /> },
  { value: 'panaderia',       label: 'Panadería',         icon: <Utensils size={14} /> },
  { value: 'otro',            label: 'Otro',              icon: <ChefHat size={14} /> },
]

function kindIcon(kind: string) {
  const o = KIND_OPTIONS.find(x => x.value === kind)
  return o?.icon ?? <ChefHat size={14} />
}

function kindLabel(kind: string) {
  return KIND_OPTIONS.find(x => x.value === kind)?.label ?? kind
}

export default function EstacionesPage() {
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [loading, setLoading]     = useState(true)
  const [stations, setStations]   = useState<Station[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [printers,  setPrinters]  = useState<PrintServer[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    kind: 'cocina',
    location_id: '',
    print_server_id: '',
  })

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    const [sRes, lRes, pRes] = await Promise.all([
      fetch(`/api/stations?restaurant_id=${restId}`),
      fetch(`/api/locations?restaurant_id=${restId}`),
      fetch(`/api/print/servers?restaurant_id=${restId}`),
    ])
    const [s, l, p] = await Promise.all([sRes.json(), lRes.json(), pRes.json()])
    setStations(s.stations ?? [])
    setLocations(l.locations ?? [])
    setPrinters(p.servers ?? [])
    setLoading(false)
  }, [restId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!restId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`stations-cfg:${restId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stations', filter: `restaurant_id=eq.${restId}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restId, load])

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function createStation(e: React.FormEvent) {
    e.preventDefault()
    if (!restId || !form.name) return
    const res = await fetch('/api/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id:   restId,
        name:            form.name,
        kind:            form.kind,
        location_id:     form.location_id || null,
        print_server_id: form.print_server_id || null,
      }),
    })
    const j = await res.json()
    if (!res.ok) {
      notify(j.error ?? 'Error')
    } else {
      notify('Estación creada')
      setShowCreate(false)
      setForm({ name: '', kind: 'cocina', location_id: '', print_server_id: '' })
      load()
    }
  }

  async function updateStation(id: string, patch: Partial<Station>) {
    if (!restId) return
    const res = await fetch('/api/stations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restaurant_id: restId, ...patch }),
    })
    if (res.ok) load()
  }

  async function deleteStation(id: string) {
    if (!restId) return
    if (!confirm('¿Eliminar esta estación? Los items ruteados acá quedarán sin estación asignada.')) return
    const res = await fetch(`/api/stations?id=${id}&restaurant_id=${restId}`, { method: 'DELETE' })
    if (res.ok) {
      notify('Estación eliminada')
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

  // Agrupar stations por location
  const byLocation = new Map<string, Station[]>()
  byLocation.set('__noloc__', [])
  locations.forEach(l => byLocation.set(l.id, []))
  stations.forEach(s => {
    const key = s.location_id ?? '__noloc__'
    if (!byLocation.has(key)) byLocation.set(key, [])
    byLocation.get(key)!.push(s)
  })

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <ChefHat size={20} className="text-[#FF6B35]" /> Estaciones de preparación
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            Define dónde se prepara cada tipo de plato y a qué impresora envía
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-black text-xs font-bold hover:bg-[#FF6B35]/90 transition-colors"
        >
          <Plus size={14} /> Nueva estación
        </button>
      </div>

      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-white/10 backdrop-blur border border-white/20 text-white px-4 py-2.5 rounded-xl text-sm animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
        </div>
      ) : stations.length === 0 ? (
        <EmptyState icon={ChefHat} title="Sin estaciones" description="Agregá la primera estación arriba (Cocina, Barra, Parrilla, etc.)" />
      ) : (
        <div className="space-y-6">
          {[...byLocation.entries()].map(([locKey, sts]) => {
            if (sts.length === 0 && locKey === '__noloc__') return null
            const locName = locKey === '__noloc__' ? 'Sin local asignado' : locations.find(l => l.id === locKey)?.name
            return (
              <section key={locKey}>
                <h2 className="text-white/50 text-xs uppercase tracking-wide mb-3 flex items-center gap-2">
                  <MapPin size={12} /> {locName}
                </h2>
                <div className="space-y-2">
                  {sts.map(st => (
                    <StationRow
                      key={st.id}
                      station={st}
                      locations={locations}
                      printers={printers}
                      onUpdate={patch => updateStation(st.id, patch)}
                      onDelete={() => deleteStation(st.id)}
                    />
                  ))}
                  {sts.length === 0 && locKey !== '__noloc__' && (
                    <p className="text-white/30 text-xs italic pl-2">Sin estaciones en este local</p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={createStation} className="w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <ChefHat size={18} className="text-[#FF6B35]" /> Nueva estación
            </h3>

            <label className="block">
              <span className="text-white/50 text-xs font-medium mb-1 block">Nombre *</span>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Cocina caliente JW"
                required
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#FF6B35]/40"
              />
            </label>

            <label className="block">
              <span className="text-white/50 text-xs font-medium mb-1 block">Tipo</span>
              <select
                value={form.kind}
                onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40"
              >
                {KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-white/50 text-xs font-medium mb-1 block">Local</span>
              <select
                value={form.location_id}
                onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40"
              >
                <option value="">— Sin local asignado —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-white/50 text-xs font-medium mb-1 block">Impresora (opcional)</span>
              <select
                value={form.print_server_id}
                onChange={e => setForm(f => ({ ...f, print_server_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40"
              >
                <option value="">— Sin impresora —</option>
                {printers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.printer_kind})</option>)}
              </select>
            </label>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={!form.name} className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] text-black text-sm font-bold hover:bg-[#FF6B35]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} /> Crear
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function StationRow({ station, locations, printers, onUpdate, onDelete }: {
  station: Station
  locations: Location[]
  printers: PrintServer[]
  onUpdate: (patch: Partial<Station>) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const printer = printers.find(p => p.id === station.print_server_id)

  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-9 h-9 rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center text-[#FF6B35]">
          {kindIcon(station.kind)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{station.name}</p>
          <p className="text-white/40 text-xs flex items-center gap-2 flex-wrap">
            <span>{kindLabel(station.kind)}</span>
            {printer && <><span>·</span><span className="flex items-center gap-1"><Printer size={10} /> {printer.name}</span></>}
            {!station.active && <><span>·</span><span className="text-red-400">Inactiva</span></>}
          </p>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-white/40 text-xs hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-white/5 border border-white/8"
        >
          {expanded ? 'Cerrar' : 'Editar'}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/8 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Sel label="Local" value={station.location_id ?? ''} onChange={v => onUpdate({ location_id: v || null })}>
              <option value="">Sin local</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Sel>
            <Sel label="Impresora" value={station.print_server_id ?? ''} onChange={v => onUpdate({ print_server_id: v || null })}>
              <option value="">Sin impresora</option>
              {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Sel>
          </div>
          <Sel label="Tipo" value={station.kind} onChange={v => onUpdate({ kind: v })}>
            {KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Sel>
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 text-xs text-white/60">
              <input type="checkbox" checked={station.active} onChange={e => onUpdate({ active: e.target.checked })} />
              Activa
            </label>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={12} /> Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Sel({ label, value, onChange, children }: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-white/50 text-xs font-medium mb-1 block">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40"
      >
        {children}
      </select>
    </label>
  )
}
