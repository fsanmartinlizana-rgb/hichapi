'use client'

// ── /configuracion/geofencing — config + audit ─────────────────────────────
// Feature enterprise. Permite al owner definir el centro y radio del
// geofence y ver los últimos eventos de check-in.
//
// Sprint 6 (2026-04-19).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import { canAccessModule } from '@/lib/plans'
import {
  MapPin, Save, Loader2, ToggleLeft, ToggleRight, AlertCircle, Crosshair,
  CheckCircle2, XCircle,
} from 'lucide-react'

interface GeofenceConfig {
  geofence_lat:      number | null
  geofence_lng:      number | null
  geofence_radius_m: number | null
  geofence_enabled:  boolean
}

interface Event {
  id:             string
  lat:            number
  lng:            number
  within_radius:  boolean
  distance_m:     number
  trigger_source: string
  created_at:     string
}

export default function GeofencingPage() {
  const { restaurant, loading: ctxLoading } = useRestaurant()
  const restId = restaurant?.id
  const canUse = useMemo(() => canAccessModule(restaurant?.plan ?? 'free', 'enterprise'), [restaurant])

  const [config, setConfig] = useState<GeofenceConfig>({
    geofence_lat:      null,
    geofence_lng:      null,
    geofence_radius_m: 150,
    geofence_enabled:  false,
  })
  const [events,   setEvents]   = useState<Event[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    const res = await fetch(`/api/geofence/config?restaurant_id=${restId}`)
    const d   = await res.json()
    if (d.config) {
      setConfig({
        geofence_lat:      d.config.geofence_lat      ?? null,
        geofence_lng:      d.config.geofence_lng      ?? null,
        geofence_radius_m: d.config.geofence_radius_m ?? 150,
        geofence_enabled:  d.config.geofence_enabled  ?? false,
      })
    }
    setEvents((d.events ?? []) as Event[])
    setLoading(false)
  }, [restId])

  useEffect(() => {
    if (canUse) load()
    else setLoading(false)
  }, [load, canUse])

  async function save() {
    if (!restId) return
    setSaving(true)
    try {
      const res = await fetch('/api/geofence/config', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          restaurant_id: restId,
          lat:           config.geofence_lat,
          lng:           config.geofence_lng,
          radius_m:      config.geofence_radius_m ?? 150,
          enabled:       config.geofence_enabled,
        }),
      })
      if (res.ok) {
        setToast('Configuración guardada')
        setTimeout(() => setToast(null), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => setConfig(c => ({ ...c, geofence_lat: pos.coords.latitude, geofence_lng: pos.coords.longitude })),
      err => alert(`No se pudo obtener tu ubicación: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  if (ctxLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 size={22} className="text-[#FF6B35] animate-spin" /></div>
  }

  if (!canUse) {
    return (
      <div className="p-6">
        <div className="max-w-xl mx-auto text-center py-16 space-y-4">
          <MapPin size={36} className="text-[#FF6B35] mx-auto" />
          <h1 className="text-white text-xl font-bold">Geofencing</h1>
          <p className="text-white/50 text-sm">
            Detectá automáticamente cuando un cliente está dentro de tu local.
            Disponible en plan Enterprise.
          </p>
          <a href="/modulos" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors">
            Ver planes
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-white text-xl font-bold flex items-center gap-2">
          <MapPin size={20} className="text-[#FF6B35]" /> Geofencing
        </h1>
        <p className="text-white/40 text-sm mt-0.5">
          Definí una zona circular alrededor de tu local. Los clientes que abran tu página desde adentro activan check-in automático.
        </p>
      </div>

      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-sm">
          {toast}
        </div>
      )}

      {/* Config card */}
      <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold">Estado</p>
            <p className="text-white/40 text-xs">Activá para empezar a detectar check-ins</p>
          </div>
          <button
            onClick={() => setConfig(c => ({ ...c, geofence_enabled: !c.geofence_enabled }))}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold ${
              config.geofence_enabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/10'
            }`}
          >
            {config.geofence_enabled ? <><ToggleRight size={14} /> Activo</> : <><ToggleLeft size={14} /> Inactivo</>}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-white/50 text-xs font-medium mb-1 block">Latitud</span>
            <input
              type="number"
              step="0.000001"
              value={config.geofence_lat ?? ''}
              onChange={e => setConfig(c => ({ ...c, geofence_lat: e.target.value ? parseFloat(e.target.value) : null }))}
              placeholder="-33.437222"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm font-mono focus:outline-none focus:border-[#FF6B35]/40"
            />
          </label>
          <label className="block">
            <span className="text-white/50 text-xs font-medium mb-1 block">Longitud</span>
            <input
              type="number"
              step="0.000001"
              value={config.geofence_lng ?? ''}
              onChange={e => setConfig(c => ({ ...c, geofence_lng: e.target.value ? parseFloat(e.target.value) : null }))}
              placeholder="-70.650556"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm font-mono focus:outline-none focus:border-[#FF6B35]/40"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-white/50 text-xs font-medium mb-1 block">Radio (metros) · {config.geofence_radius_m}m</span>
          <input
            type="range"
            min={20}
            max={500}
            step={10}
            value={config.geofence_radius_m ?? 150}
            onChange={e => setConfig(c => ({ ...c, geofence_radius_m: parseInt(e.target.value) }))}
            className="w-full accent-[#FF6B35]"
          />
          <div className="flex justify-between text-white/25 text-[10px] mt-1">
            <span>20m (interior muy chico)</span>
            <span>500m (manzana completa)</span>
          </div>
        </label>

        <div className="flex gap-2">
          <button
            onClick={useMyLocation}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:text-white hover:border-white/25 transition-colors"
          >
            <Crosshair size={12} /> Usar mi ubicación actual
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#e55a2b] disabled:opacity-50 transition-colors ml-auto"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
          </button>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
        <AlertCircle size={14} className="text-blue-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-blue-300 text-xs font-medium">Privacidad</p>
          <p className="text-blue-200/80 text-[11px] leading-relaxed">
            El cliente debe dar permiso de ubicación explícito en su navegador. Solo enviamos la coord cuando abre tu página pública o escanea un QR, nunca en background. Los eventos quedan asociados al restaurant, no al usuario personal.
          </p>
        </div>
      </div>

      {/* Events */}
      <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white text-sm font-semibold">Últimos 20 check-ins</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 size={18} className="text-[#FF6B35] animate-spin" /></div>
        ) : events.length === 0 ? (
          <p className="text-white/30 text-xs italic">Sin eventos registrados aún</p>
        ) : (
          <div className="space-y-1.5">
            {events.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                {e.within_radius
                  ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  : <XCircle size={13} className="text-white/30 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-xs">
                    {e.within_radius ? 'Dentro del radio' : 'Fuera del radio'} · {e.distance_m}m · <span className="text-white/40">{e.trigger_source}</span>
                  </p>
                  <p className="text-white/30 text-[10px] font-mono">{e.lat.toFixed(5)}, {e.lng.toFixed(5)}</p>
                </div>
                <span className="text-white/30 text-[10px]">{new Date(e.created_at).toLocaleString('es-CL')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
