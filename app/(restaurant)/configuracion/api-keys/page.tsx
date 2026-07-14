'use client'

// ── /configuracion/api-keys — gestor de API keys ───────────────────────────
// Feature enterprise. Permite al owner/admin crear, listar y revocar keys
// para su restaurant.
//
// Sprint 5 (2026-04-19).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import { canAccessModule } from '@/lib/plans'
import {
  KeyRound, Plus, Copy, Check, Trash2, Loader2, AlertTriangle, ShieldCheck,
  ExternalLink, X,
} from 'lucide-react'

interface ApiKey {
  id:            string
  name:          string
  prefix:        string
  scopes:        string[]
  rate_limit:    number
  last_used_at:  string | null
  expires_at:    string | null
  revoked_at:    string | null
  created_at:    string
}

const ALL_SCOPES: { value: string; label: string }[] = [
  { value: 'menu:read',         label: 'Leer menú' },
  { value: 'menu:write',        label: 'Editar menú' },
  { value: 'orders:read',       label: 'Leer pedidos' },
  { value: 'orders:write',      label: 'Crear/actualizar pedidos' },
  { value: 'reservations:read', label: 'Leer reservas' },
  { value: 'reservations:write',label: 'Crear reservas' },
  { value: 'stock:read',        label: 'Leer stock' },
  { value: 'stock:write',       label: 'Actualizar stock' },
]

export default function ApiKeysPage() {
  const { restaurant, loading: ctxLoading } = useRestaurant()
  const restId = restaurant?.id
  const canUse = useMemo(() => canAccessModule(restaurant?.plan ?? 'free', 'enterprise'), [restaurant])

  const [keys, setKeys]         = useState<ApiKey[]>([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [freshSecret, setFreshSecret] = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    const res = await fetch(`/api/api-keys?restaurant_id=${restId}`)
    const d   = await res.json()
    setKeys((d.keys ?? []) as ApiKey[])
    setLoading(false)
  }, [restId])

  useEffect(() => {
    if (canUse) load()
    else setLoading(false)
  }, [load, canUse])

  async function revoke(id: string) {
    if (!restId) return
    if (!confirm('¿Revocar esta key? Las integraciones que la usen dejarán de funcionar.')) return
    const res = await fetch(`/api/api-keys?id=${id}&restaurant_id=${restId}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  async function copySecret() {
    if (!freshSecret) return
    await navigator.clipboard.writeText(freshSecret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={22} className="text-[#E55A2B] animate-spin" />
      </div>
    )
  }

  if (!canUse) {
    return (
      <div className="p-6">
        <div className="max-w-xl mx-auto text-center py-16 space-y-4">
          <KeyRound size={36} className="text-[#E55A2B] mx-auto" />
          <h1 className="text-[var(--text-strong)] text-xl font-bold">API pública</h1>
          <p className="text-[var(--text-muted)] text-sm">
            Creá API keys para integrar HiChapi con tu stack (POS, ERP, app propia).
            Esta feature está disponible en el plan Enterprise.
          </p>
          <a href="/modulos" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors">
            Ver planes
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[var(--text-strong)] text-xl font-bold flex items-center gap-2">
            <KeyRound size={20} className="text-[#E55A2B]" /> API pública
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            Keys con scopes para tu integración. Endpoint base: <span className="font-mono text-[var(--text-muted)]">/api/v1/public/</span>
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-black text-xs font-bold hover:bg-[#FF6B35] transition-colors"
        >
          <Plus size={14} /> Crear key
        </button>
      </div>

      {/* Fresh secret reveal */}
      {freshSecret && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[var(--success-text)]" />
            <p className="text-[var(--success-text)] font-semibold text-sm">Key creada — guardala ahora</p>
          </div>
          <p className="text-[var(--text-body)] text-xs">
            Este es el único momento en que vas a ver el secret completo. Copiala y guardala en tu gestor de secretos. Después solo verás el prefix.
          </p>
          <div className="flex items-center gap-2 bg-black/40 rounded-xl px-3 py-2 font-mono text-sm">
            <span className="flex-1 text-[var(--text-body)] break-all">{freshSecret}</span>
            <button
              onClick={copySecret}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-sunken)] text-[var(--text-strong)] text-xs hover:bg-[var(--surface-sunken)] transition-colors"
            >
              {copied ? <Check size={11} className="text-[var(--success-text)]" /> : <Copy size={11} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <button
            onClick={() => setFreshSecret(null)}
            className="text-[var(--text-muted)] text-xs hover:text-[var(--text-strong)] underline"
          >
            Ya la guardé, cerrar
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="text-[#E55A2B] animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          Sin keys. Creá la primera para empezar a consumir la API pública.
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(k => {
            const isRevoked = !!k.revoked_at
            return (
              <div key={k.id} className={`rounded-2xl border p-4 flex items-center gap-4 ${isRevoked ? 'bg-white/[0.01] border-[var(--border-subtle)] opacity-60' : 'bg-white/[0.02] border-[var(--border-subtle)]'}`}>
                <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center shrink-0">
                  <KeyRound size={14} className="text-[#E55A2B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-[var(--text-strong)] text-sm font-semibold">{k.name}</p>
                    {isRevoked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-[var(--danger-text)] font-semibold">Revocada</span>}
                    {k.expires_at && new Date(k.expires_at) < new Date() && !isRevoked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-[var(--warning-text)]">Expirada</span>
                    )}
                  </div>
                  <p className="text-[var(--text-muted)] text-[11px] font-mono mb-1">{k.prefix}…</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {k.scopes.map(s => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface-sunken)] text-[var(--text-muted)]">{s}</span>
                    ))}
                  </div>
                  <p className="text-[var(--text-muted)] text-[10px] mt-1">
                    Rate: {k.rate_limit}/min ·
                    Última uso: {k.last_used_at ? new Date(k.last_used_at).toLocaleString('es-CL') : 'nunca'} ·
                    Creada: {new Date(k.created_at).toLocaleDateString('es-CL')}
                  </p>
                </div>
                {!isRevoked && (
                  <button
                    onClick={() => revoke(k.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[var(--danger-text)] text-xs hover:bg-red-500/20 transition-colors shrink-0"
                  >
                    <Trash2 size={11} /> Revocar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Security tip */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <AlertTriangle size={14} className="text-[var(--warning-text)] mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-[var(--warning-text)] text-xs font-medium">Seguridad</p>
          <p className="text-amber-200/80 text-[11px] leading-relaxed">
            Nunca pegues una API key en código público (GitHub, apps mobile, etc.). Usala solo en servidores backend. Si creés que una key se filtró, revocala de inmediato y creá una nueva.
          </p>
        </div>
      </div>

      {showCreate && (
        <CreateKeyModal
          restaurantId={restId!}
          onClose={() => setShowCreate(false)}
          onCreated={(secret) => {
            setFreshSecret(secret)
            setShowCreate(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function CreateKeyModal({ restaurantId, onClose, onCreated }: {
  restaurantId: string
  onClose:      () => void
  onCreated:    (secret: string) => void
}) {
  const [name, setName]       = useState('')
  const [scopes, setScopes]   = useState<string[]>(['menu:read'])
  const [rateLimit, setRateLimit] = useState(1000)
  const [saving, setSaving]   = useState(false)

  function toggleScope(s: string) {
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function save() {
    if (!name || scopes.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/api-keys', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ restaurant_id: restaurantId, name, scopes, rate_limit: rateLimit }),
      })
      const d = await res.json()
      if (d.secret) onCreated(d.secret as string)
      else alert(d.error ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[var(--text-strong)] font-bold text-lg flex items-center gap-2">
            <KeyRound size={18} className="text-[#E55A2B]" /> Nueva API key
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"><X size={16} /></button>
        </div>

        <label className="block">
          <span className="text-[var(--text-muted)] text-xs font-medium mb-1 block">Nombre *</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Integración POS externo"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/40"
          />
        </label>

        <div>
          <p className="text-[var(--text-muted)] text-xs font-medium mb-2">Permisos (scopes)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_SCOPES.map(s => {
              const active = scopes.includes(s.value)
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleScope(s.value)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    active
                      ? 'bg-[#FF6B35]/15 border-[#FF6B35]/30 text-[#E55A2B]'
                      : 'bg-white/[0.02] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]'
                  }`}
                >
                  <p className="font-semibold">{s.label}</p>
                  <p className="font-mono text-[10px] opacity-70">{s.value}</p>
                </button>
              )
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-[var(--text-muted)] text-xs font-medium mb-1 block">Rate limit (requests/min)</span>
          <input
            type="number"
            min={60}
            max={10000}
            value={rateLimit}
            onChange={e => setRateLimit(parseInt(e.target.value) || 1000)}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]/40"
          />
        </label>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm hover:bg-[var(--surface-sunken)] transition-colors">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !name || scopes.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] text-black text-sm font-bold hover:bg-[#FF6B35] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear
          </button>
        </div>

        <p className="text-[var(--text-muted)] text-[10px] text-center">
          Vas a ver el secret completo solo una vez después de crear la key.
        </p>
      </div>
    </div>
  )
}
