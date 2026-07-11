'use client'

/**
 * /agregar-restaurante — crea un restaurante adicional bajo la cuenta del
 * usuario logueado. No es una "sucursal" del mismo brand (eso es
 * /agregar-sucursal, solo Enterprise). Es un restaurante independiente que
 * comparte cuenta con otros locales.
 *
 * Caso de uso: el dueño tiene una cuenta con su correo y quiere registrar un
 * segundo local que NO pertenece al mismo holding (ej: dos negocios distintos).
 * Antes esto era imposible sin crear una cuenta nueva con otro email — bug
 * reportado el 2026-06.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, ArrowLeft } from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'

type PlanId = 'free' | 'piloto' | 'starter' | 'pro' | 'enterprise'

const PLAN_INFO: Record<PlanId, { name: string; hint: string }> = {
  free:       { name: 'Gratis',     hint: 'Solo presencia digital (sin operación).' },
  piloto:     { name: 'Piloto',     hint: 'Nivel Pro sin costo fijo, comisión 2%.' },
  starter:    { name: 'Starter',    hint: '$29.990/mes — operación del salón.' },
  pro:        { name: 'Pro',        hint: '$59.990/mes — + inteligencia.' },
  enterprise: { name: 'Enterprise', hint: '$79.990/mes — multi-local + API.' },
}

export default function AgregarRestaurantePage() {
  const router = useRouter()
  const { refresh } = useRestaurant()

  const [restName,    setRestName]    = useState('')
  const [restAddress, setRestAddress] = useState('')
  const [restBarrio,  setRestBarrio]  = useState('')
  const [restCocina,  setRestCocina]  = useState('')
  const [plan,        setPlan]        = useState<PlanId>('free')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/auth/add-restaurant', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ restName, restAddress, restBarrio, restCocina, plan }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No pudimos crear el restaurante.')
        return
      }
      // El contexto se recarga: el nuevo restaurante aparece en el picker.
      await refresh()
      router.push('/dashboard')
    } catch {
      setError('Sin conexión. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-10">
      <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-strong)] text-xs inline-flex items-center gap-1 mb-6 transition-colors">
        <ArrowLeft size={12} /> Volver al panel
      </Link>

      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-[#FF6B35]/15 border border-[#FF6B35]/30 flex items-center justify-center">
          <Sparkles size={20} className="text-[#E55A2B]" />
        </div>
        <div>
          <h1 className="text-[var(--text-strong)] text-2xl font-bold">Agregar otro restaurante</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Sumá un nuevo local a tu cuenta. Vas a poder cambiar entre restaurantes desde la barra lateral.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl p-6">
        <Field label="Nombre del restaurante" value={restName} onChange={setRestName} placeholder="Ej: La Marina" required />
        <Field label="Dirección" value={restAddress} onChange={setRestAddress} placeholder="Av. Providencia 1234" required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Barrio" value={restBarrio} onChange={setRestBarrio} placeholder="Providencia" required />
          <Field label="Tipo de cocina" value={restCocina} onChange={setRestCocina} placeholder="Italiana" required />
        </div>

        <div className="space-y-1.5">
          <label className="text-[var(--text-muted)] text-xs font-medium">Plan inicial</label>
          <select
            value={plan}
            onChange={e => setPlan(e.target.value as PlanId)}
            className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]/40"
          >
            {(Object.keys(PLAN_INFO) as PlanId[]).map(p => (
              <option key={p} value={p} className="bg-[var(--surface-card)]">{PLAN_INFO[p].name}</option>
            ))}
          </select>
          <p className="text-[var(--text-muted)] text-[11px]">{PLAN_INFO[plan].hint}</p>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !restName.trim() || !restAddress.trim() || !restBarrio.trim() || !restCocina.trim()}
          className="w-full py-3 rounded-xl bg-[#FF6B35] hover:bg-[#e55a2b] disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Crear restaurante
        </button>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[var(--text-muted)] text-xs font-medium">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]/40 placeholder:text-[var(--text-muted)]"
      />
    </div>
  )
}
