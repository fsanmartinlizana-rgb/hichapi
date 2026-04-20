'use client'

// ── /promociones — gestor de promociones dinámicas ──────────────────────
// Crear promos happy-hour, combos, 2x1, descuentos fijos o %. Elegir canales
// y ventana horaria. Las horas-valle detectadas por Analytics linkean acá.
//
// Sprint 2026-04-20.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  Tag, Plus, Save, Trash2, Loader2, Clock, Calendar, Percent,
  Store, ListOrdered, Sparkles, ToggleLeft, ToggleRight, X, Lightbulb,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

type PromoKind = 'discount_pct' | 'discount_amount' | '2x1' | 'combo' | 'happy_hour'

interface Promotion {
  id:             string
  name:           string
  description:    string | null
  kind:           PromoKind
  value:          number | null
  time_start:     string | null
  time_end:       string | null
  days_of_week:   number[] | null
  valid_from:     string
  valid_until:    string | null
  channel_mesa:   boolean
  channel_espera: boolean
  channel_chapi:  boolean
  menu_item_ids:  string[] | null
  active:         boolean
  created_at:     string
}

const KIND_LABELS: Record<PromoKind, string> = {
  discount_pct:    'Descuento %',
  discount_amount: 'Descuento $',
  '2x1':           '2 × 1',
  combo:           'Combo',
  happy_hour:      'Happy hour',
}

const KIND_ICONS: Record<PromoKind, React.ComponentType<{ size?: number; className?: string }>> = {
  discount_pct:    Percent,
  discount_amount: Tag,
  '2x1':           Sparkles,
  combo:           Store,
  happy_hour:      Clock,
}

const DAYS = [
  { n: 1, label: 'Lun' },
  { n: 2, label: 'Mar' },
  { n: 3, label: 'Mié' },
  { n: 4, label: 'Jue' },
  { n: 5, label: 'Vie' },
  { n: 6, label: 'Sáb' },
  { n: 0, label: 'Dom' },
]

function promoValueLabel(p: Promotion): string {
  if (p.kind === 'discount_pct' && p.value != null) return `${p.value}% off`
  if (p.kind === 'discount_amount' && p.value != null) return `- $${p.value.toLocaleString('es-CL')}`
  return KIND_LABELS[p.kind]
}

export default function PromocionesPage() {
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [promos, setPromos]   = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast]     = useState<string | null>(null)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    const res = await fetch(`/api/promotions?restaurant_id=${restId}`)
    const data = await res.json()
    setPromos((data.promotions ?? []) as Promotion[])
    setLoading(false)
  }, [restId])

  useEffect(() => { load() }, [load])

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function toggleActive(p: Promotion) {
    if (!restId) return
    await fetch('/api/promotions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, restaurant_id: restId, active: !p.active }),
    })
    load()
  }

  async function remove(id: string) {
    if (!restId) return
    if (!confirm('¿Eliminar promoción? Esta acción no se puede deshacer.')) return
    const res = await fetch(`/api/promotions?id=${id}&restaurant_id=${restId}`, { method: 'DELETE' })
    if (res.ok) {
      notify('Promoción eliminada')
      load()
    }
  }

  const activePromos   = useMemo(() => promos.filter(p => p.active), [promos])
  const inactivePromos = useMemo(() => promos.filter(p => !p.active), [promos])

  if (!restaurant) {
    return <div className="flex items-center justify-center h-screen"><Loader2 size={22} className="text-[#FF6B35] animate-spin" /></div>
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <Tag size={20} className="text-[#FF6B35]" /> Promociones
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            Creá happy hours, combos o descuentos para llenar el salón en horas valle
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-black text-xs font-bold hover:bg-[#FF6B35]/90 transition-colors"
        >
          <Plus size={14} /> Nueva promoción
        </button>
      </div>

      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-sm">
          {toast}
        </div>
      )}

      {/* Tip */}
      <div className="flex items-start gap-2 rounded-xl border border-[#FF6B35]/20 bg-[#FF6B35]/5 px-4 py-3">
        <Lightbulb size={14} className="text-[#FF6B35] mt-0.5 shrink-0" />
        <p className="text-[#FF6B35]/90 text-[11px] leading-relaxed">
          <span className="font-semibold">Tip:</span> Usá Analytics para identificar tus horas valle
          y creá acá una promo para ese bloque horario. Chapi la promocionará automáticamente
          a los clientes que entren al salón.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 size={20} className="text-[#FF6B35] animate-spin" /></div>
      ) : promos.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Sin promociones"
          description="Creá la primera promoción para atraer clientes en horarios bajos."
        />
      ) : (
        <>
          {activePromos.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-white/50 text-xs uppercase tracking-wider">Activas · {activePromos.length}</h2>
              {activePromos.map(p => (
                <PromoCard key={p.id} promo={p} onEdit={() => setEditing(p)} onToggle={() => toggleActive(p)} onDelete={() => remove(p.id)} />
              ))}
            </section>
          )}

          {inactivePromos.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-white/50 text-xs uppercase tracking-wider">Pausadas · {inactivePromos.length}</h2>
              {inactivePromos.map(p => (
                <PromoCard key={p.id} promo={p} onEdit={() => setEditing(p)} onToggle={() => toggleActive(p)} onDelete={() => remove(p.id)} />
              ))}
            </section>
          )}
        </>
      )}

      {(creating || editing) && restId && (
        <PromoForm
          restId={restId}
          initial={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => {
            notify(editing ? 'Promoción actualizada' : 'Promoción creada')
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function PromoCard({ promo, onEdit, onToggle, onDelete }: {
  promo: Promotion
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const Icon = KIND_ICONS[promo.kind]
  const isActive = promo.active
  const schedule = (promo.time_start && promo.time_end)
    ? `${promo.time_start}–${promo.time_end}`
    : 'Todo el día'
  const days = promo.days_of_week && promo.days_of_week.length > 0 && promo.days_of_week.length < 7
    ? DAYS.filter(d => promo.days_of_week!.includes(d.n)).map(d => d.label).join(', ')
    : 'Todos los días'

  return (
    <div className={`flex items-center gap-4 rounded-xl border p-4 ${isActive ? 'bg-white/[0.02] border-white/8' : 'bg-white/[0.01] border-white/5 opacity-60'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-[#FF6B35]/10 border border-[#FF6B35]/20' : 'bg-white/5 border border-white/10'}`}>
        <Icon size={16} className={isActive ? 'text-[#FF6B35]' : 'text-white/30'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-white text-sm font-semibold truncate">{promo.name}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF6B35]/15 text-[#FF6B35] font-semibold">{promoValueLabel(promo)}</span>
          {!isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">Pausada</span>}
        </div>
        <p className="text-white/50 text-[11px] flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1"><Clock size={10} /> {schedule}</span>
          <span className="flex items-center gap-1"><Calendar size={10} /> {days}</span>
          {promo.valid_until && (
            <span className="text-white/30">Hasta {promo.valid_until}</span>
          )}
        </p>
        {promo.description && (
          <p className="text-white/40 text-[11px] mt-1 line-clamp-1">{promo.description}</p>
        )}
      </div>
      <button
        onClick={onToggle}
        className={`p-2 rounded-lg border transition-colors ${isActive ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-white/40 border-white/10 bg-white/5 hover:bg-white/10'}`}
        title={isActive ? 'Pausar' : 'Activar'}
      >
        {isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
      </button>
      <button
        onClick={onEdit}
        className="p-2 rounded-lg border border-white/10 text-white/40 bg-white/5 hover:text-white transition-colors"
      >
        <Save size={12} />
      </button>
      <button
        onClick={onDelete}
        className="p-2 rounded-lg border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/15 transition-colors"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function PromoForm({ restId, initial, onClose, onSaved }: {
  restId: string
  initial?: Promotion
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [kind, setKind]         = useState<PromoKind>(initial?.kind ?? 'discount_pct')
  const [value, setValue]       = useState(initial?.value?.toString() ?? '20')
  const [timeStart, setTimeStart] = useState(initial?.time_start ?? '15:00')
  const [timeEnd, setTimeEnd]   = useState(initial?.time_end ?? '17:00')
  const [allDay, setAllDay]     = useState(!initial?.time_start)
  const [days, setDays]         = useState<number[]>(initial?.days_of_week ?? [1, 2, 3, 4])
  const [validFrom, setValidFrom] = useState(initial?.valid_from ?? new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState(initial?.valid_until ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [channelMesa, setChannelMesa]     = useState(initial?.channel_mesa ?? true)
  const [channelEspera, setChannelEspera] = useState(initial?.channel_espera ?? true)
  const [channelChapi, setChannelChapi]   = useState(initial?.channel_chapi ?? true)
  const [saving, setSaving] = useState(false)

  function toggleDay(n: number) {
    setDays(prev => prev.includes(n) ? prev.filter(d => d !== n) : [...prev, n].sort())
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        restaurant_id: restId,
        name,
        description:   description || undefined,
        kind,
        value:         value ? parseInt(value) : undefined,
        time_start:    allDay ? null : timeStart,
        time_end:      allDay ? null : timeEnd,
        days_of_week:  days.length === 7 ? null : days,
        valid_from:    validFrom,
        valid_until:   validUntil || null,
        channel_mesa:  channelMesa,
        channel_espera: channelEspera,
        channel_chapi: channelChapi,
      }
      const res = await fetch('/api/promotions', {
        method:  initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(initial ? { id: initial.id, ...payload } : payload),
      })
      if (res.ok) onSaved()
      else {
        const d = await res.json()
        alert(d.error ?? 'Error al guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-[#111111] border border-white/10 rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Tag size={18} className="text-[#FF6B35]" /> {initial ? 'Editar' : 'Nueva'} promoción
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        <label className="block">
          <span className="text-white/50 text-xs font-medium mb-1 block">Nombre *</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Happy hour de tarde"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-white/50 text-xs font-medium mb-1 block">Tipo</span>
            <select
              value={kind}
              onChange={e => setKind(e.target.value as PromoKind)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40"
            >
              {Object.entries(KIND_LABELS).map(([k, l]) => (
                <option key={k} value={k} className="bg-[#1C1C2E]">{l}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-white/50 text-xs font-medium mb-1 block">
              {kind === 'discount_pct' ? 'Porcentaje (%)' : kind === 'discount_amount' ? 'Monto ($)' : 'Valor'}
            </span>
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              disabled={kind === '2x1'}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40 disabled:opacity-40"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-white/50 text-xs font-medium mb-1 block">Descripción</span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Mensaje que verán los clientes"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40 resize-none"
          />
        </label>

        {/* Horario */}
        <div className="rounded-xl border border-white/5 p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
            <span className="text-white text-xs">Aplica todo el día</span>
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-white/50 text-[10px] mb-0.5 block">Desde</span>
                <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40" />
              </label>
              <label className="block">
                <span className="text-white/50 text-[10px] mb-0.5 block">Hasta</span>
                <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40" />
              </label>
            </div>
          )}
        </div>

        {/* Días de semana */}
        <div>
          <p className="text-white/50 text-xs mb-2">Días aplicables</p>
          <div className="flex gap-1.5 flex-wrap">
            {DAYS.map(d => {
              const active = days.includes(d.n)
              return (
                <button
                  key={d.n}
                  type="button"
                  onClick={() => toggleDay(d.n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35]'
                      : 'bg-white/[0.02] border-white/5 text-white/40 hover:text-white/60'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Ventana calendaria */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-white/50 text-xs mb-1 block">Válida desde</span>
            <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40" />
          </label>
          <label className="block">
            <span className="text-white/50 text-xs mb-1 block">Hasta (opcional)</span>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/40" />
          </label>
        </div>

        {/* Canales */}
        <div>
          <p className="text-white/50 text-xs mb-2">Mostrar en</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: 'mesa',   label: 'Mesa (QR)',     value: channelMesa,   setter: setChannelMesa,   icon: Store },
              { k: 'espera', label: 'Lista espera',  value: channelEspera, setter: setChannelEspera, icon: ListOrdered },
              { k: 'chapi',  label: 'Chat Chapi',    value: channelChapi,  setter: setChannelChapi,  icon: Sparkles },
            ].map(({ k, label, value: v, setter, icon: Icon }) => (
              <button
                key={k}
                type="button"
                onClick={() => setter(!v)}
                className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                  v ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35]' : 'bg-white/[0.02] border-white/5 text-white/40'
                }`}
              >
                <Icon size={14} />
                <span className="font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !name}
            className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] text-black text-sm font-bold hover:bg-[#FF6B35]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
