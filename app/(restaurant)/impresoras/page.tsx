'use client'

import { useEffect, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  Printer, Plus, Loader2, AlertCircle, Trash2, ChefHat, Wine, CreditCard, Package,
  Pencil, Check, X,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type PrinterKind = 'cocina' | 'barra' | 'caja' | 'otro'

interface PrinterRow {
  id:            string
  name:          string
  description:   string | null
  kind:          PrinterKind
  active:        boolean
  created_at:    string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<PrinterKind, { label: string; icon: typeof ChefHat; color: string }> = {
  cocina: { label: 'Cocina',  icon: ChefHat,     color: '#FBBF24' },
  barra:  { label: 'Barra',   icon: Wine,        color: '#60A5FA' },
  caja:   { label: 'Caja',    icon: CreditCard,  color: '#34D399' },
  otro:   { label: 'Otro',    icon: Package,     color: '#A78BFA' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImpresorasPage() {
  const { restaurant } = useRestaurant()
  const [printers, setPrinters] = useState<PrinterRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  // Add form
  const [showAdd,   setShowAdd]   = useState(false)
  const [newName,   setNewName]   = useState('')
  const [newDesc,   setNewDesc]   = useState('')
  const [newKind,   setNewKind]   = useState<PrinterKind>('cocina')
  const [creating,  setCreating]  = useState(false)
  const [addError,  setAddError]  = useState<string | null>(null)

  // Edit inline
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editName,  setEditName]  = useState('')
  const [editDesc,  setEditDesc]  = useState('')
  const [editKind,  setEditKind]  = useState<PrinterKind>('cocina')
  const [saving,    setSaving]    = useState(false)

  async function load() {
    if (!restaurant) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/printers?restaurant_id=${restaurant.id}`)
      const data = await res.json()
      setPrinters(data.printers ?? [])
    } catch {
      setError('No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [restaurant])

  async function createPrinter() {
    if (!restaurant || !newName.trim()) return
    setCreating(true)
    setAddError(null)
    try {
      const res  = await fetch('/api/printers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          name:          newName.trim(),
          description:   newDesc.trim() || undefined,
          kind:          newKind,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error ?? 'No se pudo crear'); return }
      setShowAdd(false)
      setNewName(''); setNewDesc(''); setNewKind('cocina')
      await load()
    } finally {
      setCreating(false)
    }
  }

  function startEdit(p: PrinterRow) {
    setEditId(p.id)
    setEditName(p.name)
    setEditDesc(p.description ?? '')
    setEditKind(p.kind)
  }

  async function saveEdit() {
    if (!restaurant || !editId) return
    setSaving(true)
    try {
      await fetch('/api/printers', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:            editId,
          restaurant_id: restaurant.id,
          name:          editName.trim(),
          description:   editDesc.trim() || null,
          kind:          editKind,
        }),
      })
      setEditId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function deletePrinter(id: string) {
    if (!restaurant) return
    if (!confirm('¿Eliminar esta impresora?')) return
    await fetch(`/api/printers?id=${id}&restaurant_id=${restaurant.id}`, { method: 'DELETE' })
    await load()
  }

  async function toggleActive(p: PrinterRow) {
    if (!restaurant) return
    await fetch('/api/printers', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, restaurant_id: restaurant.id, active: !p.active }),
    })
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  // Group by kind for display
  const grouped = printers.reduce<Record<PrinterKind, PrinterRow[]>>(
    (acc, p) => { acc[p.kind] = [...(acc[p.kind] ?? []), p]; return acc },
    {} as Record<PrinterKind, PrinterRow[]>
  )

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <Printer size={20} className="text-[#FF6B35]" />
            Impresoras
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            Nombres de impresoras registradas en el notifier de impresión
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setAddError(null) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#e85d2a] transition-colors"
        >
          <Plus size={13} />
          Agregar impresora
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
        <Printer size={14} className="text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-300 text-xs font-semibold">Cómo funciona</p>
          <p className="text-white/40 text-xs mt-0.5">
            Cada impresora tiene un nombre (ej: <span className="font-mono text-white/60">COCINA1</span>) que se envía al notifier{' '}
            <span className="font-mono text-white/50">api.notifier.realdev.cl</span>.
            El notifier enruta a la impresora física según ese nombre.
            Los productos y categorías pueden apuntar a una impresora específica.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle size={14} className="text-red-300 shrink-0 mt-0.5" />
          <p className="text-red-200 text-xs">{error}</p>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-[#161622] border border-white/8 rounded-2xl p-5 space-y-4">
          <p className="text-white font-semibold text-sm">Nueva impresora</p>

          {addError && (
            <p className="text-red-400 text-xs">{addError}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">
                Nombre <span className="text-white/20">(se enviará en mayúsculas)</span>
              </label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="COCINA1, BARRA, CAJA…"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors font-mono"
              />
            </div>

            {/* Kind */}
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Tipo</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.entries(KIND_CONFIG) as [PrinterKind, typeof KIND_CONFIG[PrinterKind]][]).map(([k, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <button
                      key={k}
                      onClick={() => setNewKind(k)}
                      className={`py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        newKind === k
                          ? 'border-opacity-50 text-white'
                          : 'bg-white/3 border-white/8 text-white/30 hover:text-white/60'
                      }`}
                      style={newKind === k ? { background: cfg.color + '20', borderColor: cfg.color + '60', color: cfg.color } : {}}
                    >
                      <Icon size={11} />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Description */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Descripción <span className="text-white/20">(opcional)</span></label>
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Ej: Impresora cocina planta baja"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowAdd(false); setAddError(null) }}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={createPrinter}
              disabled={creating || !newName.trim()}
              className="flex-[2] py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Agregar
            </button>
          </div>
        </div>
      )}

      {/* Printers list */}
      {printers.length === 0 ? (
        <div className="bg-[#161622] border border-white/5 rounded-2xl">
          <EmptyState
            icon={Printer}
            title="Aún no tienes impresoras registradas"
            description="Agrega las impresoras que tiene tu local (COCINA1, BARRA, CAJA…)"
            action={{ label: 'Agregar impresora', onClick: () => setShowAdd(true) }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {(Object.entries(KIND_CONFIG) as [PrinterKind, typeof KIND_CONFIG[PrinterKind]][])
            .filter(([k]) => grouped[k]?.length > 0)
            .map(([kind, cfg]) => {
              const Icon = cfg.icon
              return (
                <div key={kind} className="bg-[#161622] border border-white/5 rounded-2xl overflow-hidden">
                  {/* Kind header */}
                  <div
                    className="flex items-center gap-2 px-5 py-3 border-b border-white/5"
                    style={{ background: cfg.color + '08' }}
                  >
                    <Icon size={13} style={{ color: cfg.color }} />
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: cfg.color }}>
                      {cfg.label}
                    </p>
                    <span className="text-[10px] text-white/25 ml-1">({grouped[kind].length})</span>
                  </div>

                  {/* Printers in this kind */}
                  <div className="divide-y divide-white/5">
                    {grouped[kind].map(p => (
                      <div key={p.id} className="px-5 py-3.5 flex items-center gap-3">
                        {editId === p.id ? (
                          /* ── Edit mode ── */
                          <div className="flex-1 flex items-center gap-2 flex-wrap">
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white text-sm font-mono focus:outline-none focus:border-[#FF6B35]/50 w-36"
                            />
                            <input
                              value={editDesc}
                              onChange={e => setEditDesc(e.target.value)}
                              placeholder="Descripción…"
                              className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50 min-w-0"
                            />
                            <div className="flex gap-1">
                              {(Object.entries(KIND_CONFIG) as [PrinterKind, typeof KIND_CONFIG[PrinterKind]][]).map(([k, c]) => (
                                <button
                                  key={k}
                                  onClick={() => setEditKind(k)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                    editKind === k ? 'text-white' : 'bg-white/3 text-white/30'
                                  }`}
                                  style={editKind === k ? { background: c.color + '25', color: c.color } : {}}
                                >
                                  {c.label}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                            >
                              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          /* ── View mode ── */
                          <>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-white">{p.name}</span>
                                {!p.active && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/30">
                                    inactiva
                                  </span>
                                )}
                              </div>
                              {p.description && (
                                <p className="text-white/35 text-xs mt-0.5">{p.description}</p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Toggle active */}
                              <button
                                onClick={() => toggleActive(p)}
                                title={p.active ? 'Desactivar' : 'Activar'}
                                className={`w-8 h-5 rounded-full transition-colors relative ${
                                  p.active ? 'bg-[#FF6B35]' : 'bg-white/15'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                    p.active ? 'translate-x-3' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>

                              <button
                                onClick={() => startEdit(p)}
                                className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/5 transition-colors"
                              >
                                <Pencil size={13} />
                              </button>

                              <button
                                onClick={() => deletePrinter(p.id)}
                                className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
