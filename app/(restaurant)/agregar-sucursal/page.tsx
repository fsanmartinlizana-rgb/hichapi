'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Store, Check, AlertCircle, Copy } from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'

export default function AgregarSucursalPage() {
  const router = useRouter()
  const { restaurants, restaurant } = useRestaurant()

  const [name, setName]                 = useState('')
  const [address, setAddress]           = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [cuisine, setCuisine]           = useState('')
  const [copyFromId, setCopyFromId]     = useState<string>('')
  const [busy, setBusy]                 = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [done, setDone]                 = useState<{ id: string; name: string; slug: string; copiedItems: number } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/restaurants/sucursal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:                 name.trim(),
          address:              address.trim(),
          neighborhood:         neighborhood.trim(),
          cuisine_type:         cuisine.trim() || undefined,
          copy_menu_from_id:    copyFromId || undefined,
          parent_restaurant_id: restaurant?.id, // hereda brand del restaurant activo
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        setError(j.error ?? 'No pudimos crear la sucursal.')
        return
      }
      setDone({
        id:           j.restaurant.id,
        name:         j.restaurant.name,
        slug:         j.restaurant.slug,
        copiedItems:  j.copied_menu_items ?? 0,
      })
    } catch {
      setError('Sin conexión.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-[var(--text-strong)] text-xl font-bold">Agregar sucursal</h1>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">
            Creá un nuevo local bajo tu cuenta. Vas a poder cambiar entre sucursales desde el sidebar.
          </p>
        </div>
      </div>

      {/* Info: flujo recomendado */}
      {restaurant?.id && (
        <div className="bg-[#FF6B35]/8 border border-[#FF6B35]/25 rounded-xl p-3 flex items-start gap-2">
          <span className="text-[#E55A2B] text-base leading-none mt-0.5">ℹ️</span>
          <div className="text-[11px] leading-relaxed">
            <p className="text-[var(--text-body)]">
              Si solo querés agregar un <strong>local</strong> bajo la misma marca (menú/reportes compartidos),
              usá <Link href="/configuracion/locations" className="text-[#E55A2B] underline hover:no-underline">Configuración → Locales</Link>.
            </p>
            <p className="text-[var(--text-muted)] mt-1">
              Este flujo crea una sucursal con su propio equipo y módulos independientes.
            </p>
          </div>
        </div>
      )}

      {done ? (
        <div className="bg-emerald-500/8 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Check size={20} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="text-[var(--text-strong)] font-bold text-base">¡Sucursal creada!</h2>
              <p className="text-emerald-700/80 text-sm mt-1">
                <strong className="text-[var(--text-strong)]">{done.name}</strong> ya está activa en tu cuenta.
              </p>
              {done.copiedItems > 0 && (
                <p className="text-emerald-700/60 text-xs mt-2">
                  Se copiaron <strong>{done.copiedItems}</strong> platos del menú origen.
                </p>
              )}
            </div>
          </div>

          <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-3 flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">Slug:</span>
            <code className="text-[var(--text-body)] text-xs font-mono">{done.slug}</code>
            <button
              onClick={() => navigator.clipboard?.writeText(done.slug)}
              className="ml-auto p-1 rounded hover:bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            >
              <Copy size={11} />
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] transition-colors"
            >
              Ir al dashboard de la sucursal
            </button>
            <button
              onClick={() => {
                setDone(null); setName(''); setAddress(''); setNeighborhood(''); setCuisine(''); setCopyFromId('')
              }}
              className="px-4 py-3 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm hover:bg-[var(--surface-sunken)] transition-colors"
            >
              Crear otra
            </button>
          </div>

          <p className="text-[var(--text-muted)] text-[11px] pt-2 border-t border-emerald-500/15">
            💡 Recordá: cambiá entre sucursales desde el menú lateral (click en el nombre del restaurante).
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-4">

          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
            <Store size={15} className="text-[#E55A2B]" />
            <h2 className="text-[var(--text-strong)] font-semibold text-sm">Datos de la nueva sucursal</h2>
          </div>

          <div>
            <label className="text-[var(--text-muted)] text-xs font-medium block mb-1.5">
              Nombre del local
            </label>
            <input
              type="text" required value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: El Dante - Las Condes"
              className="w-full px-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/50"
            />
          </div>

          <div>
            <label className="text-[var(--text-muted)] text-xs font-medium block mb-1.5">
              Dirección
            </label>
            <input
              type="text" required value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Av. Apoquindo 4500"
              className="w-full px-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--text-muted)] text-xs font-medium block mb-1.5">
                Barrio / Comuna
              </label>
              <input
                type="text" required value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
                placeholder="Las Condes"
                className="w-full px-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/50"
              />
            </div>
            <div>
              <label className="text-[var(--text-muted)] text-xs font-medium block mb-1.5">
                Cocina (opcional)
              </label>
              <input
                type="text" value={cuisine}
                onChange={e => setCuisine(e.target.value)}
                placeholder="Italiana"
                className="w-full px-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/50"
              />
            </div>
          </div>

          {/* Copiar menú de sucursal existente */}
          {restaurants.length > 0 && (
            <div className="bg-[#FF6B35]/5 border border-[#FF6B35]/20 rounded-xl p-3 space-y-2">
              <label className="text-[var(--text-strong)] text-xs font-semibold block">
                ¿Copiar la carta de otra sucursal?
              </label>
              <select
                value={copyFromId}
                onChange={e => setCopyFromId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]/40"
              >
                <option value="">— No copiar (carta vacía) —</option>
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.id === restaurant?.id ? ' (actual)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                Útil para cadenas con la misma carta. Después podés editarla por sucursal en /carta.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5">
              <AlertCircle size={13} className="text-red-700 shrink-0 mt-0.5" />
              <p className="text-red-700 text-xs">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Link
              href="/dashboard"
              className="px-4 py-3 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm hover:bg-[var(--surface-sunken)] transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={busy || !name || !address || !neighborhood}
              className="flex-1 py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {busy
                ? <><Loader2 size={14} className="animate-spin" /> Creando…</>
                : <>Crear sucursal</>
              }
            </button>
          </div>

          <p className="text-[var(--text-muted)] text-[11px] pt-2 border-t border-[var(--border-subtle)]">
            La nueva sucursal arrancará en plan <strong>Gratis</strong>. Podés cambiar el plan después en /modulos.
          </p>
        </form>
      )}
    </div>
  )
}
