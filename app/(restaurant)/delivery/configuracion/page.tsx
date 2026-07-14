/**
 * /delivery/configuracion — Zone, fee tiers, vehicle restrictions
 * Requirements: 7.3, 7.4, 7.5, 7.6
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Save, Plus, Trash2, MapPin, DollarSign, Truck } from 'lucide-react'
import type { DeliveryZone, DeliveryFeeTier, VehicleType } from '@/lib/delivery/types'
import { useRestaurant } from '@/lib/restaurant-context'

const VEHICLE_LABELS: Record<VehicleType, string> = {
  bicycle:    'Bicicleta',
  motorcycle: 'Moto',
  car:        'Auto',
  cargo_bike: 'Cargo bike',
}

export default function DeliveryConfiguracionPage() {
  const [zone, setZone] = useState<Partial<DeliveryZone>>({ radius_km: 5, center_lat: -33.4489, center_lng: -70.6693, active: true })
  const [tiers, setTiers] = useState<Partial<DeliveryFeeTier>[]>([
    { min_km: 0, max_km: 3, fee_clp: 2000, vehicle_types: [] },
    { min_km: 3, max_km: 7, fee_clp: 3500, vehicle_types: [] },
    { min_km: 7, max_km: null, fee_clp: 5000, vehicle_types: [] },
  ])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deliveryEnabled, setDeliveryEnabled] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)

  const { restaurant } = useRestaurant()
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!restaurant?.id) return
    Promise.all([
      fetch('/api/delivery/configuracion/zone', { headers: { 'x-restaurant-id': restaurant.id } }).then(r => r.json()),
      fetch('/api/delivery/configuracion/tiers', { headers: { 'x-restaurant-id': restaurant.id } }).then(r => r.json())
    ]).then(([zoneData, tiersData]) => {
      if (zoneData && !zoneData.error) {
        setZone(zoneData)
        setDeliveryEnabled(zoneData.active)
      }
      if (tiersData && Array.isArray(tiersData) && tiersData.length > 0) {
        setTiers(tiersData)
      }
    }).catch(console.error).finally(() => setInitialLoading(false))
  }, [restaurant?.id])

  // Mapbox initialization
  useEffect(() => {
    if (initialLoading) return
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return
    if (!mapContainer.current) return
    if (mapRef.current) return // Already initialized

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

    const centerLng = zone.center_lng ?? -70.6693
    const centerLat = zone.center_lat ?? -33.4489

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [centerLng, centerLat],
      zoom: 11,
    })
    mapRef.current = map

    map.on('load', () => {
      map.addSource('zone-circle', {
        type: 'geojson',
        data: createGeoJSONCircle([centerLng, centerLat], zone.radius_km ?? 5) as any
      })
      map.addLayer({
        id: 'zone-fill',
        type: 'fill',
        source: 'zone-circle',
        paint: {
          'fill-color': '#FF6B35',
          'fill-opacity': 0.2
        }
      })
      map.addLayer({
        id: 'zone-line',
        type: 'line',
        source: 'zone-circle',
        paint: {
          'line-color': '#FF6B35',
          'line-width': 2
        }
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [initialLoading])

  // Update map source when zone changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource('zone-circle') as mapboxgl.GeoJSONSource
    if (source && zone.center_lat && zone.center_lng && zone.radius_km) {
      source.setData(createGeoJSONCircle([zone.center_lng, zone.center_lat], zone.radius_km) as any)
      map.flyTo({ center: [zone.center_lng, zone.center_lat] })
    }
  }, [zone.center_lat, zone.center_lng, zone.radius_km])

  function createGeoJSONCircle(center: [number, number], radiusInKm: number, points = 64) {
    const distanceX = radiusInKm / (111.32 * Math.cos((center[1] * Math.PI) / 180))
    const distanceY = radiusInKm / 110.574
    const coords = []
    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI)
      const x = distanceX * Math.cos(theta)
      const y = distanceY * Math.sin(theta)
      coords.push([center[0] + x, center[1] + y])
    }
    coords.push(coords[0])
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] }
    }
  }

  function addTier() {
    setTiers(prev => [...prev, { min_km: 0, max_km: null, fee_clp: 0, vehicle_types: [] }])
  }

  function removeTier(i: number) {
    setTiers(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateTier(i: number, field: string, value: unknown) {
    setTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  function toggleVehicle(tierIdx: number, v: VehicleType) {
    setTiers(prev => prev.map((t, idx) => {
      if (idx !== tierIdx) return t
      const types = (t.vehicle_types ?? []) as VehicleType[]
      return {
        ...t,
        vehicle_types: types.includes(v) ? types.filter(x => x !== v) : [...types, v],
      }
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      // Save zone
      const resZone = await fetch('/api/delivery/configuracion/zone', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-restaurant-id': restaurant?.id ?? ''
        },
        body: JSON.stringify({ ...zone, active: deliveryEnabled }),
      })
      if (!resZone.ok) throw new Error('Error al guardar zona')
      
      // Save tiers
      const resTiers = await fetch('/api/delivery/configuracion/tiers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-restaurant-id': restaurant?.id ?? ''
        },
        body: JSON.stringify({ tiers }),
      })
      if (!resTiers.ok) throw new Error('Error al guardar tarifas')

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setSaveError(err.message || 'Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)]">Configuración de Delivery</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Define tu zona de cobertura y estructura de tarifas</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white rounded-lg text-sm font-medium hover:bg-[#e55a25] transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saved ? 'Guardado ✓' : saving ? 'Guardando…' : 'Guardar'}
          </button>
          {saveError && <p className="text-[var(--danger-text)] text-xs">{saveError}</p>}
        </div>
      </div>

      {/* Enable/disable delivery */}
      <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--text-strong)] font-medium">Delivery habilitado</p>
            <p className="text-[var(--text-muted)] text-sm">Activa o desactiva el módulo de delivery para tu restaurante</p>
          </div>
          <button
            onClick={() => setDeliveryEnabled(v => !v)}
            className={`w-12 h-6 rounded-full transition-colors ${deliveryEnabled ? 'bg-[#FF6B35]' : 'bg-[var(--surface-sunken)]'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${deliveryEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Delivery zone */}
      <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-[#E55A2B]" />
          <h2 className="text-[var(--text-strong)] font-semibold">Zona de cobertura</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs mb-1 block">Radio (km)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={zone.radius_km ?? ''}
              onChange={e => {
                const val = parseFloat(e.target.value)
                setZone(z => ({ ...z, radius_km: Number.isNaN(val) ? undefined : val }))
              }}
              className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]"
            />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs mb-1 block">Latitud centro</label>
            <input
              type="number"
              step="0.0001"
              value={zone.center_lat ?? ''}
              onChange={e => {
                const val = parseFloat(e.target.value)
                setZone(z => ({ ...z, center_lat: Number.isNaN(val) ? undefined : val }))
              }}
              placeholder="-33.4489"
              className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]"
            />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs mb-1 block">Longitud centro</label>
            <input
              type="number"
              step="0.0001"
              value={zone.center_lng ?? ''}
              onChange={e => {
                const val = parseFloat(e.target.value)
                setZone(z => ({ ...z, center_lng: Number.isNaN(val) ? undefined : val }))
              }}
              placeholder="-70.6693"
              className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]"
            />
          </div>
        </div>

        {/* Mapbox container */}
        <div className="mt-4 rounded-xl overflow-hidden border border-[var(--border-subtle)] h-[300px] bg-[var(--surface-sunken)] relative">
          <div ref={mapContainer} className="w-full h-full" />
          {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[var(--text-muted)] text-sm">
              Mapbox token no configurado
            </div>
          )}
        </div>
      </div>

      {/* Fee tiers */}
      <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-[#E55A2B]" />
            <h2 className="text-[var(--text-strong)] font-semibold">Tarifas por distancia</h2>
          </div>
          <button
            onClick={addTier}
            className="flex items-center gap-1.5 text-xs text-[#E55A2B] hover:text-[var(--text-strong)] transition-colors"
          >
            <Plus size={13} /> Agregar tramo
          </button>
        </div>

        <div className="space-y-3">
          {tiers.map((tier, i) => (
            <div key={i} className="bg-[var(--surface-sunken)] rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[var(--text-muted)] text-xs mb-1 block">Desde (km)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={tier.min_km ?? ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      updateTier(i, 'min_km', Number.isNaN(val) ? undefined : val)
                    }}
                    className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]"
                  />
                </div>
                <div>
                  <label className="text-[var(--text-muted)] text-xs mb-1 block">Hasta (km, vacío=∞)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={tier.max_km ?? ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      updateTier(i, 'max_km', Number.isNaN(val) ? null : val)
                    }}
                    placeholder="Sin límite"
                    className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]"
                  />
                </div>
                <div>
                  <label className="text-[var(--text-muted)] text-xs mb-1 block">Tarifa (CLP)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={tier.fee_clp ?? ''}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10)
                      updateTier(i, 'fee_clp', Number.isNaN(val) ? undefined : val)
                    }}
                    className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]"
                  />
                </div>
              </div>

              {/* Vehicle type restrictions */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Truck size={12} className="text-[var(--text-muted)]" />
                  <span className="text-[var(--text-muted)] text-xs">Vehículos permitidos (vacío = todos)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(VEHICLE_LABELS) as VehicleType[]).map(v => {
                    const selected = ((tier.vehicle_types ?? []) as VehicleType[]).includes(v)
                    return (
                      <button
                        key={v}
                        onClick={() => toggleVehicle(i, v)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                          selected
                            ? 'bg-[#FF6B35] text-white'
                            : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]'
                        }`}
                      >
                        {VEHICLE_LABELS[v]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {tiers.length > 1 && (
                <button
                  onClick={() => removeTier(i)}
                  className="flex items-center gap-1 text-xs text-[var(--danger-text)] hover:text-[var(--danger-text)] transition-colors"
                >
                  <Trash2 size={12} /> Eliminar tramo
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
