'use client'

import { useEffect, useState } from 'react'
import { Loader2, MapPin, Bell, AlertTriangle } from 'lucide-react'

const GEO_OPT_OUT_KEY = 'hichapi_geolocation_opt_out'

export default function CuentaConfiguracionPage() {
  const [pushEnabled, setPushEnabled] = useState(true)
  const [geoOptOut, setGeoOptOut] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setGeoOptOut(localStorage.getItem(GEO_OPT_OUT_KEY) === '1')
    fetch('/api/customer/profile')
      .then((r) => r.json())
      .then((p) => setPushEnabled(!!p.push_token))
      .catch(() => {})
  }, [])

  async function togglePush() {
    setBusy(true)
    setMessage(null)
    try {
      if (pushEnabled) {
        await fetch('/api/customer/push-token', { method: 'DELETE' })
        setPushEnabled(false)
        setMessage('Notificaciones push desactivadas')
      } else {
        setMessage('Para activar push, abrí la app móvil HiChapi y aceptá las notificaciones.')
      }
    } catch {
      setMessage('Error al actualizar notificaciones')
    } finally {
      setBusy(false)
    }
  }

  function toggleGeoOptOut() {
    const next = !geoOptOut
    setGeoOptOut(next)
    if (next) {
      localStorage.setItem(GEO_OPT_OUT_KEY, '1')
      setMessage('Geolocalización desactivada en HiChapi. Podés revocar el permiso del navegador en Ajustes.')
    } else {
      localStorage.removeItem(GEO_OPT_OUT_KEY)
      setMessage('Geolocalización habilitada para ofertas cercanas.')
    }
  }

  async function deleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    if (!password) {
      setMessage('Ingresá tu contraseña para confirmar')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/customer/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        window.location.href = '/login'
        return
      }
      const data = await res.json()
      setMessage(data.error ?? 'No se pudo eliminar la cuenta')
      setConfirmDelete(false)
    } catch {
      setMessage('Error de conexión')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Configuración</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Privacidad y cuenta</p>
      </div>

      {message && (
        <p className="text-sm text-[var(--text-body)] bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
          {message}
        </p>
      )}

      <section className="bg-white/[0.03] border border-[var(--border-subtle)] rounded-2xl divide-y divide-[var(--border-subtle)]">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-[#E55A2B]" />
            <div>
              <p className="text-[var(--text-strong)] text-sm font-medium">Notificaciones push</p>
              <p className="text-[var(--text-muted)] text-xs">Ofertas y estado de pedidos</p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={togglePush}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              pushEnabled
                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] border-[var(--border-subtle)]'
            }`}
          >
            {pushEnabled ? 'Activadas' : 'Desactivadas'}
          </button>
        </div>

        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <MapPin size={18} className="text-[#E55A2B]" />
            <div>
              <p className="text-[var(--text-strong)] text-sm font-medium">Geolocalización</p>
              <p className="text-[var(--text-muted)] text-xs">Alertas cuando estés cerca de un restaurante</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleGeoOptOut}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              !geoOptOut
                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] border-[var(--border-subtle)]'
            }`}
          >
            {!geoOptOut ? 'Permitida' : 'Revocada'}
          </button>
        </div>
      </section>

      <section className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="text-red-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-red-700 font-semibold text-sm">Eliminar cuenta</h2>
            <p className="text-red-200/60 text-xs mt-1 leading-relaxed">
              Se anonimizarán tus pedidos y calificaciones. Esta acción no se puede deshacer.
            </p>
          </div>
        </div>
        {confirmDelete && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-sunken)] border border-red-500/30 text-[var(--text-strong)] text-sm"
          />
        )}
        <button
          type="button"
          disabled={busy}
          onClick={deleteAccount}
          className="w-full py-2.5 rounded-xl border border-red-500/40 text-red-700 text-sm font-semibold hover:bg-red-500/10 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {confirmDelete ? 'Confirmar eliminación' : 'Eliminar mi cuenta'}
        </button>
        {confirmDelete && (
          <button
            type="button"
            onClick={() => { setConfirmDelete(false); setPassword('') }}
            className="w-full text-[var(--text-muted)] text-xs"
          >
            Cancelar
          </button>
        )}
      </section>
    </div>
  )
}
