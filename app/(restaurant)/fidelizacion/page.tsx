'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Gift, Sparkles, Trophy, Ticket, Plus, Trash2, Loader2, Save, CheckCircle2 } from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import { formatCurrency } from '@/lib/i18n'

// ── Types ────────────────────────────────────────────────────────────────────

type Mechanic = 'stamps' | 'points' | 'both'
type StampTrigger = 'per_visit' | 'per_order' | 'per_amount'
type RewardType = 'free_item' | 'discount_percent' | 'discount_amount' | 'free_category'

interface Program {
  id: string
  restaurant_id: string
  name: string
  active: boolean
  mechanic: Mechanic
  stamps_per_reward: number
  stamp_trigger: StampTrigger
  stamp_amount_threshold: number | null
  points_per_clp: number
  welcome_points: number
  multi_location: boolean
}

interface Reward {
  id: string
  program_id: string
  restaurant_id: string
  type: RewardType
  name: string
  description: string | null
  value: Record<string, unknown>
  points_cost: number | null
  stamps_cost: number | null
  active: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const clp = (n: number) => formatCurrency(n)

async function jsonFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `Error ${res.status}`)
  }
  return res.json()
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FidelizacionPage() {
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState<Program | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Draft state for the program form (uncontrolled until we save)
  const [draft, setDraft] = useState<Partial<Program>>({})

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    try {
      const data = await jsonFetch<{ program: Program | null; rewards: Reward[] }>(
        `/api/loyalty/program?restaurant_id=${restId}`,
      )
      setProgram(data.program)
      setDraft(data.program ?? {
        name: 'Programa de fidelidad',
        active: false,
        mechanic: 'stamps',
        stamps_per_reward: 10,
        stamp_trigger: 'per_visit',
        stamp_amount_threshold: null,
        points_per_clp: 0.01,
        welcome_points: 0,
        multi_location: false,
      })
      setRewards(data.rewards ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [restId])

  useEffect(() => { load() }, [load])

  const saveProgram = useCallback(async () => {
    if (!restId) return
    setSaving(true)
    setErr(null)
    try {
      const body = { restaurant_id: restId, ...draft }
      const res = await jsonFetch<{ program: Program }>('/api/loyalty/program', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setProgram(res.program)
      setSavedAt(Date.now())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [restId, draft])

  const dirty = useMemo(() => {
    if (!program) return true
    return (Object.keys(draft) as (keyof Program)[]).some(k => draft[k] !== program[k])
  }, [draft, program])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={20} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5 pb-20">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <Gift size={18} className="text-[#FF6B35]" /> Fidelización
          </h1>
          <p className="text-white/40 text-xs mt-0.5">
            Premia a quienes vuelven — sellos, puntos y cupones con canje seguro.
          </p>
        </div>
        {program?.active && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 size={10} /> Activo
          </span>
        )}
      </div>

      {err && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {err}
        </div>
      )}

      {/* Program card */}
      <section className="bg-[#161622] border border-white/8 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Sparkles size={14} className="text-[#FF6B35]" /> Configuración del programa
          </h2>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-white/60 text-xs">{draft.active ? 'Encendido' : 'Apagado'}</span>
            <input
              type="checkbox"
              checked={!!draft.active}
              onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))}
              className="sr-only"
            />
            <span
              className={`w-9 h-5 rounded-full transition-colors relative ${draft.active ? 'bg-[#FF6B35]' : 'bg-white/15'}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${draft.active ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nombre del programa">
            <input
              value={draft.name ?? ''}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none"
            />
          </Field>

          <Field label="Mecánica">
            <select
              value={draft.mechanic ?? 'stamps'}
              onChange={e => setDraft(d => ({ ...d, mechanic: e.target.value as Mechanic }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm cursor-pointer focus:border-[#FF6B35]/40 focus:outline-none"
            >
              <option value="stamps">Sellos (tarjeta)</option>
              <option value="points">Puntos (por gasto)</option>
              <option value="both">Ambos</option>
            </select>
          </Field>

          {(draft.mechanic === 'stamps' || draft.mechanic === 'both') && (
            <>
              <Field label="Sellos para premio">
                <input
                  type="number" min={1} max={100}
                  value={draft.stamps_per_reward ?? 10}
                  onChange={e => setDraft(d => ({ ...d, stamps_per_reward: Number(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none"
                />
              </Field>

              <Field label="Disparador de sello">
                <select
                  value={draft.stamp_trigger ?? 'per_visit'}
                  onChange={e => setDraft(d => ({ ...d, stamp_trigger: e.target.value as StampTrigger }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm cursor-pointer focus:border-[#FF6B35]/40 focus:outline-none"
                >
                  <option value="per_visit">Por visita</option>
                  <option value="per_order">Por pedido</option>
                  <option value="per_amount">Por monto mínimo</option>
                </select>
              </Field>

              {draft.stamp_trigger === 'per_amount' && (
                <Field label="Monto mínimo (CLP)">
                  <input
                    type="number" min={100} step={500}
                    value={draft.stamp_amount_threshold ?? 5000}
                    onChange={e => setDraft(d => ({ ...d, stamp_amount_threshold: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none"
                  />
                </Field>
              )}
            </>
          )}

          {(draft.mechanic === 'points' || draft.mechanic === 'both') && (
            <>
              <Field label="Puntos por $1 CLP">
                <input
                  type="number" min={0} step={0.001} max={1}
                  value={draft.points_per_clp ?? 0.01}
                  onChange={e => setDraft(d => ({ ...d, points_per_clp: Number(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none"
                />
                <p className="text-white/30 text-[10px] mt-1">
                  Ej: 0.01 → 1 punto cada $100
                </p>
              </Field>

              <Field label="Puntos de bienvenida (una vez por cliente)">
                <input
                  type="number" min={0} max={100000}
                  value={draft.welcome_points ?? 0}
                  onChange={e => setDraft(d => ({ ...d, welcome_points: Number(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none"
                />
              </Field>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/6">
          <p className="text-white/35 text-xs">
            {savedAt && Date.now() - savedAt < 3000
              ? '✓ Guardado'
              : dirty ? 'Hay cambios sin guardar' : 'Todo al día'}
          </p>
          <button
            onClick={saveProgram}
            disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar programa
          </button>
        </div>
      </section>

      {/* Reward catalog */}
      <section className="bg-[#161622] border border-white/8 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Trophy size={14} className="text-[#FF6B35]" /> Catálogo de recompensas
          </h2>
          <span className="text-white/40 text-xs">{rewards.filter(r => r.active).length} activas</span>
        </div>

        {rewards.length === 0 ? (
          <p className="text-white/25 text-sm py-2">Aún no hay recompensas.</p>
        ) : (
          <div className="space-y-2">
            {rewards.map(r => (
              <RewardRow
                key={r.id}
                reward={r}
                onChanged={load}
                restId={restId!}
              />
            ))}
          </div>
        )}

        <RewardCreate
          disabled={!program}
          restId={restId!}
          onCreated={load}
        />
      </section>

      {/* Manual coupon issuance */}
      <section className="bg-[#161622] border border-white/8 rounded-2xl p-4 space-y-3">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2">
          <Ticket size={14} className="text-[#FF6B35]" /> Emitir cupón manual
        </h2>
        <p className="text-white/40 text-xs">
          Pega el ID de cliente y elige una recompensa. El cupón generado se valida server-side al canjear.
        </p>
        <ManualIssue restId={restId!} rewards={rewards.filter(r => r.active)} />
      </section>
    </div>
  )
}

// ── Sub: labeled field wrapper ──────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-white/50 text-[11px] font-semibold uppercase tracking-wide mb-1 block">
        {label}
      </span>
      {children}
    </label>
  )
}

// ── Sub: reward row (edit + toggle active + delete) ─────────────────────────

function RewardRow({ reward, onChanged, restId }: { reward: Reward; onChanged: () => void; restId: string }) {
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    try {
      await jsonFetch('/api/loyalty/rewards', {
        method: 'PATCH',
        body: JSON.stringify({ id: reward.id, restaurant_id: restId, active: !reward.active }),
      })
      onChanged()
    } finally { setBusy(false) }
  }

  async function del() {
    if (!confirm(`¿Dar de baja "${reward.name}"?`)) return
    setBusy(true)
    try {
      await jsonFetch('/api/loyalty/rewards', {
        method: 'DELETE',
        body: JSON.stringify({ id: reward.id, restaurant_id: restId }),
      })
      onChanged()
    } finally { setBusy(false) }
  }

  const typeLabel: Record<RewardType, string> = {
    free_item: 'Plato gratis',
    discount_percent: 'Descuento %',
    discount_amount: 'Descuento $',
    free_category: 'Categoría gratis',
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${reward.active ? 'bg-white/3 border-white/8' : 'bg-white/2 border-white/5 opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{reward.name}</p>
        <p className="text-white/40 text-[11px]">
          {typeLabel[reward.type]} · {reward.points_cost ? `${reward.points_cost} pts` : ''} {reward.stamps_cost ? `· ${reward.stamps_cost} sellos` : ''}
        </p>
      </div>
      <button onClick={toggle} disabled={busy} className="text-[11px] font-semibold text-white/50 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5">
        {reward.active ? 'Pausar' : 'Activar'}
      </button>
      <button onClick={del} disabled={busy} className="text-red-400/70 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Sub: create reward ──────────────────────────────────────────────────────

function RewardCreate({ disabled, restId, onCreated }: { disabled: boolean; restId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<RewardType>('discount_percent')
  const [name, setName] = useState('')
  const [points, setPoints] = useState<number | ''>(200)
  const [stamps, setStamps] = useState<number | ''>('')
  const [percent, setPercent] = useState<number>(10)
  const [amount, setAmount] = useState<number>(2000)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setErr(null)
    if (!name.trim()) { setErr('Nombre requerido'); return }
    if (!points && !stamps) { setErr('Define costo en puntos o sellos'); return }

    let value: Record<string, unknown> = {}
    if (type === 'discount_percent') value = { percent }
    if (type === 'discount_amount') value = { amount }

    setBusy(true)
    try {
      await jsonFetch('/api/loyalty/rewards', {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id: restId,
          type, name, value,
          points_cost: points || null,
          stamps_cost: stamps || null,
        }),
      })
      setOpen(false)
      setName(''); setPoints(200); setStamps(''); setPercent(10); setAmount(2000)
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al crear')
    } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/15 text-white/50 text-xs font-semibold hover:border-[#FF6B35]/40 hover:text-[#FF6B35] transition-colors disabled:opacity-40"
      >
        <Plus size={13} /> Nueva recompensa
      </button>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Nombre">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Café gratis"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none"
          />
        </Field>
        <Field label="Tipo">
          <select
            value={type}
            onChange={e => setType(e.target.value as RewardType)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm cursor-pointer focus:border-[#FF6B35]/40 focus:outline-none"
          >
            <option value="discount_percent">Descuento %</option>
            <option value="discount_amount">Descuento $</option>
            <option value="free_item">Plato gratis</option>
            <option value="free_category">Categoría gratis</option>
          </select>
        </Field>
        {type === 'discount_percent' && (
          <Field label="% Descuento">
            <input type="number" min={1} max={100} value={percent} onChange={e => setPercent(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none" />
          </Field>
        )}
        {type === 'discount_amount' && (
          <Field label="Monto $ CLP">
            <input type="number" min={100} step={500} value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none" />
          </Field>
        )}
        <Field label="Costo en puntos">
          <input type="number" min={0} value={points} onChange={e => setPoints(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none" />
        </Field>
        <Field label="Costo en sellos">
          <input type="number" min={0} value={stamps} onChange={e => setStamps(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none" />
        </Field>
      </div>

      {err && <p className="text-red-300 text-xs">{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Crear
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:border-white/20 hover:text-white/80">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Sub: manual coupon issue ────────────────────────────────────────────────

function ManualIssue({ restId, rewards }: { restId: string; rewards: Reward[] }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [rewardId, setRewardId] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<
    {
      code?: string; error?: string
      emailSent?: boolean; emailSkipped?: boolean
      emailCarrier?: 'resend' | 'supabase_invite' | 'none'
      createdNewUser?: boolean
      existingUser?: boolean
    } | null
  >(null)

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function submit() {
    setBusy(true)
    setResult(null)
    try {
      const res = await jsonFetch<{
        coupon?: { code: string }
        email_sent?: boolean
        email_skipped?: boolean
        email_carrier?: 'resend' | 'supabase_invite' | 'none'
        created_new_user?: boolean
        recipient?: { existing_user?: boolean }
      }>('/api/loyalty/redeem', {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id:      restId,
          reward_id:          rewardId,
          on_behalf_of_email: email.trim().toLowerCase(),
          on_behalf_of_name:  name.trim() || undefined,
        }),
      })
      setResult({
        code:           res.coupon?.code,
        emailSent:      res.email_sent,
        emailSkipped:   res.email_skipped,
        emailCarrier:   res.email_carrier,
        createdNewUser: res.created_new_user,
        existingUser:   res.recipient?.existing_user,
      })
      if (res.coupon?.code) {
        setEmail('')
        setName('')
      }
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Error al emitir' })
    } finally {
      setBusy(false)
    }
  }

  if (rewards.length === 0) {
    return <p className="text-white/30 text-xs">Crea al menos una recompensa activa primero.</p>
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Field label="Correo del cliente">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="cliente@correo.cl"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none"
          />
        </Field>
        <Field label="Nombre (opcional)">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Para personalizar el email"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#FF6B35]/40 focus:outline-none"
          />
        </Field>
        <Field label="Recompensa">
          <select
            value={rewardId}
            onChange={e => setRewardId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm cursor-pointer focus:border-[#FF6B35]/40 focus:outline-none"
          >
            <option value="">— Elegir —</option>
            {rewards.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      </div>

      <button
        onClick={submit}
        disabled={busy || !emailOk || !rewardId}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Ticket size={13} />}
        Enviar cupón por email
      </button>

      {result?.code && (() => {
        // Armar mensaje para compartir por WhatsApp como backup al email
        const rewardName = rewards.find(r => r.id === rewardId)?.name ?? 'recompensa'
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const waMessage =
          `¡Hola! Te regalamos un cupón de ${rewardName} 🎁\n\n` +
          `Código: ${result.code}\n\n` +
          `Reclamalo en tu wallet HiChapi: ${baseUrl}/mi-wallet\n` +
          `(Tu email: ${email || 'el que nos compartiste'})`
        const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`

        return (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span>Cupón emitido:</span>
            <span className="font-mono font-bold select-all">{result.code}</span>
            <button
              onClick={() => { if (result.code) navigator.clipboard?.writeText(result.code) }}
              className="ml-auto text-emerald-300/70 hover:text-emerald-300 text-[10px] underline underline-offset-2"
            >
              copiar
            </button>
          </div>

          <div className="flex gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-[10px] font-semibold hover:bg-emerald-500/30 transition-colors"
              title="Compartir código por WhatsApp"
            >
              📱 Compartir por WhatsApp
            </a>
            <button
              onClick={() => navigator.clipboard?.writeText(
                `Cupón ${rewardName}: ${result.code} (reclamalo en ${baseUrl}/mi-wallet)`
              )}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/8 border border-white/15 text-white/70 text-[10px] font-medium hover:bg-white/15 transition-colors"
            >
              📋 Copiar mensaje completo
            </button>
          </div>
          <div className="text-emerald-300/80 text-[11px]">
            {result.emailCarrier === 'resend' && (
              result.existingUser
                ? '✉ Email branded enviado (Resend). Ya está en el wallet del cliente.'
                : '✉ Email branded enviado (Resend) con CTA para crear cuenta y guardar el cupón.'
            )}
            {result.emailCarrier === 'supabase_invite' && (
              '✉ Email de invitación enviado por Supabase (fallback — sin template branded). El cliente recibe un link para crear cuenta; el código del cupón queda vinculado. Para emails branded, configurá RESEND_API_KEY.'
            )}
            {result.emailCarrier === 'none' && !result.existingUser && (
              '⚠ Cupón creado pero no se envió email (RESEND_API_KEY no configurada y cliente recién creado sin invite). Compartí el código manualmente: ' + result.code
            )}
            {result.emailCarrier === 'none' && result.existingUser && (
              '⚠ Cupón creado pero no se envió email. El cliente ya tiene cuenta HiChapi — avisale que revise su wallet virtual (/mi-wallet).'
            )}
            {!result.emailCarrier && result.emailSkipped && (
              '⚠ Cupón creado, pero el envío de email está deshabilitado (falta RESEND_API_KEY). Comparte el código manualmente.'
            )}
            {!result.emailCarrier && !result.emailSkipped && !result.emailSent && (
              '⚠ Cupón creado, pero el email no pudo enviarse. Comparte el código manualmente.'
            )}
          </div>
          {result.createdNewUser && (
            <div className="text-emerald-300/50 text-[10px] pt-1 border-t border-emerald-500/15">
              🆕 Se creó una cuenta nueva para este cliente.
            </div>
          )}
        </div>
        )
      })()}
      {result?.error && (
        <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          {result.error}
        </div>
      )}

      <p className="text-white/30 text-[10px]">
        Se envía un email al cliente con el código. Si aún no tiene cuenta HiChapi, el correo lo invita a registrarse y el cupón queda reclamado en su wallet virtual al registrarse.
      </p>
      <p className="text-white/20 text-[10px]">
        Formato moneda: {clp(1000)}
      </p>
    </div>
  )
}
