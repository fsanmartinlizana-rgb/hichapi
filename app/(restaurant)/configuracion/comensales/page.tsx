'use client'

/**
 * /configuracion/comensales — Geofence y fidelidad para app comensal
 * Requirements: 5.3, 8.4, 8.5, 8.6
 */
import { useCallback, useEffect, useState } from 'react'
import { Gift, MapPin, Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import type { CustomerGeofenceRestaurantConfig } from '@/lib/customer/restaurant-customers'

export default function ComensalesConfigPage() {
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [config, setConfig] = useState<CustomerGeofenceRestaurantConfig>({
    geofence_enabled: false,
    geofence_radius_m: 300,
    geofence_message: null,
    points_multiplier: 1,
    lat: null,
    lng: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    try {
      const res = await fetch('/api/restaurant/customers/config', {
        headers: { 'x-restaurant-id': restId },
      })
      const data = await res.json()
      if (data.config) {
        setConfig({
          geofence_enabled: data.config.geofence_enabled ?? false,
          geofence_radius_m: data.config.geofence_radius_m ?? 300,
          geofence_message: data.config.geofence_message ?? '',
          points_multiplier: data.config.points_multiplier ?? 1,
          lat: data.config.lat,
          lng: data.config.lng,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [restId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!restId) return
    setSaving(true)
    try {
      const res = await fetch('/api/restaurant/customers/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-id': restId,
        },
        body: JSON.stringify({
          geofence_enabled: config.geofence_enabled,
          geofence_radius_m: config.geofence_radius_m ?? 300,
          geofence_message: config.geofence_message || undefined,
          points_multiplier: config.points_multiplier,
        }),
      })
      if (res.ok) {
        setToast('Configuración guardada')
        setTimeout(() => setToast(null), 2500)
      } else {
        const err = await res.json()
        setToast(err.error ?? 'Error al guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={22} className="text-[#E55A2B] animate-spin" />
      </div>
    )
  }

  const hasCoords = config.lat != null && config.lng != null

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 px-4 py-2 rounded-xl text-sm">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-[var(--text-strong)] flex items-center gap-2">
          <Gift size={20} className="text-[#E55A2B]" />
          Comensales — Geofence y Fidelidad
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Configuración para la app de comensales: notificaciones de proximidad y acumulación de puntos.
        </p>
      </div>

      {/* Fidelidad */}
      <section className="bg-white/[0.02] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-4">
        <h2 className="text-[var(--text-strong)] text-sm font-semibold">Multiplicador de puntos</h2>
        <p className="text-[var(--text-muted)] text-xs">
          Los comensales ganan <code className="text-[var(--text-muted)]">floor(total/100) × multiplicador</code> puntos por pedido.
        </p>
        <label className="block">
          <span className="text-[var(--text-muted)] text-xs mb-1 block">
            Multiplicador ({config.points_multiplier.toFixed(1)}×)
          </span>
          <input
            type="range"
            min={0.5}
            max={5}
            step={0.5}
            value={config.points_multiplier}
            onChange={(e) =>
              setConfig((c) => ({ ...c, points_multiplier: parseFloat(e.target.value) }))
            }
            className="w-full accent-[#FF6B35]"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
            <span>0.5×</span>
            <span>5.0×</span>
          </div>
        </label>
      </section>

      {/* Geofence comensal */}
      <section className="bg-white/[0.02] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[#E55A2B]" />
            <h2 className="text-[var(--text-strong)] text-sm font-semibold">Geofence (app comensal)</h2>
          </div>
          <button
            type="button"
            onClick={() =>
              setConfig((c) => ({ ...c, geofence_enabled: !c.geofence_enabled }))
            }
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${
              config.geofence_enabled
                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] border-[var(--border-subtle)]'
            }`}
          >
            {config.geofence_enabled ? (
              <><ToggleRight size={14} /> Activo</>
            ) : (
              <><ToggleLeft size={14} /> Inactivo</>
            )}
          </button>
        </div>

        {!hasCoords && (
          <p className="text-amber-700/90 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Configurá la ubicación del local en Mi restaurante para activar el geofence.
          </p>
        )}

        <label className="block">
          <span className="text-[var(--text-muted)] text-xs mb-1 block">
            Radio ({config.geofence_radius_m ?? 300} m)
          </span>
          <input
            type="range"
            min={100}
            max={2000}
            step={50}
            value={config.geofence_radius_m ?? 300}
            onChange={(e) =>
              setConfig((c) => ({ ...c, geofence_radius_m: parseInt(e.target.value, 10) }))
            }
            className="w-full accent-[#FF6B35]"
            disabled={!config.geofence_enabled}
          />
        </label>

        <label className="block">
          <span className="text-[var(--text-muted)] text-xs mb-1 block">
            Mensaje push (máx. 140 caracteres)
          </span>
          <textarea
            value={config.geofence_message ?? ''}
            onChange={(e) =>
              setConfig((c) => ({ ...c, geofence_message: e.target.value.slice(0, 140) }))
            }
            maxLength={140}
            rows={2}
            placeholder="¡Estás cerca! Pasa por un café de cortesía…"
            disabled={!config.geofence_enabled}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm resize-none focus:outline-none focus:border-[#FF6B35]/40 disabled:opacity-50"
          />
          <p className="text-[var(--text-muted)] text-[10px] mt-1 text-right">
            {(config.geofence_message ?? '').length}/140
          </p>
        </label>
      </section>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Guardar configuración
      </button>
    </div>
  )
}
