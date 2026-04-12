'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bike, Check, Loader2, X, Plug, AlertCircle, RefreshCw,
  ExternalLink, Trash2, Zap,
} from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'

// ── Types ───────────────────────────────────────────────────────────────────

type PlatformId =
  | 'pedidosya'
  | 'rappi'
  | 'uber_eats'
  | 'justo'
  | 'didi_food'
  | 'cornershop'

type IntegrationStatus = 'disconnected' | 'pending' | 'connected' | 'error'

interface Integration {
  id: string
  platform: PlatformId
  status: IntegrationStatus
  external_id: string | null
  api_key_hint: string | null
  auto_sync_menu: boolean
  last_sync_at: string | null
  updated_at: string | null
}

// ── Platform catalog ────────────────────────────────────────────────────────

interface PlatformMeta {
  id: PlatformId
  name: string
  short: string
  color: string
  bg: string
  region: string
  description: string
  help: string
  docsUrl?: string
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: 'pedidosya',
    name: 'PedidosYa',
    short: 'PY',
    color: '#FA0050',
    bg: 'rgba(250, 0, 80, 0.12)',
    region: 'Chile · LATAM',
    description: 'Conecta tu tienda de PedidosYa para sincronizar menú y recibir pedidos.',
    help: 'Pide tu Merchant ID y API key al ejecutivo de PedidosYa.',
    docsUrl: 'https://partners.pedidosya.com',
  },
  {
    id: 'rappi',
    name: 'Rappi',
    short: 'R',
    color: '#FF441F',
    bg: 'rgba(255, 68, 31, 0.12)',
    region: 'Chile · LATAM',
    description: 'Integra Rappi para recibir pedidos y mantener tu carta sincronizada.',
    help: 'Requiere Store ID y credenciales del partner portal de Rappi.',
    docsUrl: 'https://partners.rappi.com',
  },
  {
    id: 'uber_eats',
    name: 'Uber Eats',
    short: 'UE',
    color: '#06C167',
    bg: 'rgba(6, 193, 103, 0.12)',
    region: 'Chile · Global',
    description: 'Conecta tu restaurante en Uber Eats para sincronizar menú automáticamente.',
    help: 'Ingresa el Store UUID y la API key del Uber Eats Manager.',
    docsUrl: 'https://merchants.ubereats.com',
  },
  {
    id: 'justo',
    name: 'Justo',
    short: 'J',
    color: '#00C27A',
    bg: 'rgba(0, 194, 122, 0.12)',
    region: 'Chile',
    description: 'Plataforma chilena con comisiones más bajas. Ideal para restaurantes locales.',
    help: 'Pide a Justo tu ID de tienda; la API key es opcional.',
    docsUrl: 'https://justo.cl',
  },
  {
    id: 'didi_food',
    name: 'DiDi Food',
    short: 'DF',
    color: '#FF7900',
    bg: 'rgba(255, 121, 0, 0.12)',
    region: 'LATAM',
    description: 'Recibe pedidos de DiDi Food y sincroniza tu menú desde HiChapi.',
    help: 'Ingresa el Store ID del portal DiDi Food.',
  },
  {
    id: 'cornershop',
    name: 'Cornershop',
    short: 'CS',
    color: '#FFB800',
    bg: 'rgba(255, 184, 0, 0.12)',
    region: 'LATAM',
    description: 'Para restaurantes con venta de productos envasados vía Cornershop.',
    help: 'Requiere Retailer ID asignado por Cornershop.',
  },
]

const STATUS_LABELS: Record<IntegrationStatus, { label: string; color: string; bg: string }> = {
  disconnected: { label: 'Sin conectar',    color: '#71717A', bg: 'rgba(113, 113, 122, 0.12)' },
  pending:      { label: 'Pendiente',       color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  connected:    { label: 'Conectado',       color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  error:        { label: 'Error',           color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function IntegracionesPage() {
  const { restaurant, loading: ctxLoading } = useRestaurant()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationPending, setMigrationPending] = useState(false)
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformMeta | null>(null)

  const load = useCallback(async () => {
    if (!restaurant?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/delivery-integrations?restaurant_id=${restaurant.id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar integraciones')
      setIntegrations(json.integrations ?? [])
      setMigrationPending(Boolean(json.migration_pending))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [restaurant?.id])

  useEffect(() => { load() }, [load])

  const byPlatform = new Map(integrations.map(i => [i.platform, i]))

  async function handleDisconnect(platform: PlatformId) {
    if (!restaurant?.id) return
    if (!confirm('¿Desconectar esta integración? Podrás volver a conectarla después.')) return
    try {
      const res = await fetch('/api/delivery-integrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurant.id, platform }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Error al desconectar')
      }
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  // Metrics
  const connectedCount = integrations.filter(i => i.status === 'connected').length
  const pendingCount   = integrations.filter(i => i.status === 'pending').length

  if (ctxLoading || !restaurant) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/15 border border-[#FF6B35]/25 flex items-center justify-center">
              <Bike size={18} className="text-[#FF6B35]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Integraciones de delivery</h1>
              <p className="text-white/50 text-sm">
                Conecta tu restaurante con plataformas externas para centralizar pedidos y carta.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <MetricCard icon={Plug}  label="Conectadas" value={connectedCount} color="#10B981" />
        <MetricCard icon={Zap}   label="Pendientes" value={pendingCount}   color="#F59E0B" />
        <MetricCard icon={Bike}  label="Disponibles" value={PLATFORMS.length} color="#FF6B35" />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Migration pending banner */}
      {migrationPending && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-amber-300 text-sm font-medium">Módulo pendiente de activar</p>
            <p className="text-amber-200/70 text-xs mt-0.5">
              Para guardar integraciones, aplica la migración <code className="font-mono text-[11px]">20260411_033_delivery_integrations.sql</code> en tu base de datos. Mientras tanto puedes explorar las plataformas disponibles.
            </p>
          </div>
        </div>
      )}

      {/* Platform cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map(p => {
          const integ = byPlatform.get(p.id)
          return (
            <PlatformCard
              key={p.id}
              platform={p}
              integration={integ}
              onConnect={() => setConnectingPlatform(p)}
              onDisconnect={() => handleDisconnect(p.id)}
            />
          )
        })}
      </div>

      {/* Help footer */}
      <div className="mt-8 p-4 rounded-2xl bg-white/3 border border-white/8">
        <h3 className="text-white font-semibold text-sm mb-1">¿Cómo funcionan las integraciones?</h3>
        <p className="text-white/50 text-xs leading-relaxed">
          Cada plataforma requiere sus propias credenciales (Merchant ID / Store ID y, en algunos casos, una API key).
          HiChapi guarda solo los últimos 4 caracteres de la API key como referencia — nunca el token completo.
          Para conectarte, revisa el portal de partner de cada plataforma. Si tienes dudas, contáctanos por soporte.
        </p>
      </div>

      {/* Connect modal */}
      {connectingPlatform && (
        <ConnectModal
          platform={connectingPlatform}
          existing={byPlatform.get(connectingPlatform.id)}
          restaurantId={restaurant.id}
          onClose={() => setConnectingPlatform(null)}
          onSaved={async () => {
            setConnectingPlatform(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

// ── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon, label, value, color,
}: {
  icon: typeof Bike
  label: string
  value: number
  color: string
}) {
  return (
    <div className="p-4 rounded-2xl bg-white/3 border border-white/8">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} style={{ color }} />
        <span className="text-white/50 text-[11px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className="text-white text-2xl font-bold leading-none">{value}</p>
    </div>
  )
}

// ── Platform Card ───────────────────────────────────────────────────────────

function PlatformCard({
  platform, integration, onConnect, onDisconnect,
}: {
  platform: PlatformMeta
  integration?: Integration
  onConnect: () => void
  onDisconnect: () => void
}) {
  const status = integration?.status ?? 'disconnected'
  const statusMeta = STATUS_LABELS[status]
  const isConnected = status === 'connected' || status === 'pending'

  return (
    <div
      className="p-5 rounded-2xl bg-white/3 border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all"
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: platform.bg, color: platform.color }}
        >
          {platform.short}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-white font-semibold text-base truncate">{platform.name}</h3>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: statusMeta.bg, color: statusMeta.color }}
            >
              {statusMeta.label}
            </span>
          </div>
          <p className="text-white/40 text-[11px]">{platform.region}</p>
        </div>
      </div>

      <p className="text-white/60 text-xs leading-relaxed mb-4 min-h-[32px]">
        {platform.description}
      </p>

      {/* Connected details */}
      {isConnected && integration && (
        <div className="mb-4 p-3 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
          {integration.external_id && (
            <Row label="Store / Merchant ID" value={integration.external_id} />
          )}
          {integration.api_key_hint && (
            <Row label="API key" value={integration.api_key_hint} mono />
          )}
          <Row
            label="Sync automática"
            value={integration.auto_sync_menu ? 'Activada' : 'Desactivada'}
          />
          <Row label="Última sincronización" value={formatDate(integration.last_sync_at)} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <button
              onClick={onConnect}
              className="flex-1 px-3 py-2 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-white text-xs font-medium transition-all"
            >
              Editar
            </button>
            <button
              onClick={onDisconnect}
              className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 hover:text-red-200 text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <Trash2 size={12} />
              Desconectar
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            className="flex-1 px-3 py-2 rounded-lg bg-[#FF6B35] hover:bg-[#FF7A47] text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          >
            <Plug size={12} />
            Conectar
          </button>
        )}
        {platform.docsUrl && (
          <a
            href={platform.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
            title="Portal de partner"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40 text-[10px] uppercase tracking-wider">{label}</span>
      <span className={`text-white/80 text-[11px] truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ── Connect Modal ───────────────────────────────────────────────────────────

function ConnectModal({
  platform, existing, restaurantId, onClose, onSaved,
}: {
  platform: PlatformMeta
  existing?: Integration
  restaurantId: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const [externalId, setExternalId] = useState(existing?.external_id ?? '')
  const [apiKey, setApiKey] = useState('')
  const [autoSync, setAutoSync] = useState(existing?.auto_sync_menu ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!externalId.trim()) {
      setError('Debes indicar el Store / Merchant ID')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/delivery-integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          platform: platform.id,
          external_id: externalId.trim(),
          api_key: apiKey.trim() || null,
          auto_sync_menu: autoSync,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar')
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A1A2E] border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: platform.bg, color: platform.color }}
            >
              {platform.short}
            </div>
            <div>
              <h3 className="text-white font-semibold">{existing ? 'Editar' : 'Conectar'} {platform.name}</h3>
              <p className="text-white/40 text-[11px]">{platform.region}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-[#FF6B35]/8 border border-[#FF6B35]/20">
            <p className="text-[#FFAD8A] text-xs leading-relaxed">
              <strong className="text-[#FF6B35]">Cómo obtener tus credenciales:</strong>
              <br />
              {platform.help}
            </p>
          </div>

          <Field label="Store / Merchant ID" required>
            <input
              type="text"
              value={externalId}
              onChange={e => setExternalId(e.target.value)}
              placeholder="ej: 123456"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#FF6B35]/50"
            />
          </Field>

          <Field label="API key (opcional)">
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={existing?.api_key_hint ?? 'pega aquí tu token'}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono placeholder-white/30 focus:outline-none focus:border-[#FF6B35]/50"
            />
            <p className="text-white/40 text-[10px] mt-1">
              HiChapi guarda solo los últimos 4 caracteres como referencia; nunca el token completo.
            </p>
          </Field>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={e => setAutoSync(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-[#FF6B35]"
            />
            <div>
              <p className="text-white text-sm font-medium">Sincronización automática</p>
              <p className="text-white/50 text-[11px]">
                Al actualizar tu carta en HiChapi, se enviará automáticamente a {platform.name}.
              </p>
            </div>
          </label>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/8 flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-[#FF6B35] hover:bg-[#FF7A47] text-white text-sm font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Guardando…' : existing ? 'Actualizar' : 'Conectar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-white/60 text-[11px] font-semibold uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-[#FF6B35]">*</span>}
      </label>
      {children}
    </div>
  )
}
