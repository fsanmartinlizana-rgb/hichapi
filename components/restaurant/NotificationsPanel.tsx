'use client'

/**
 * NotificationsPanel — slide-over panel anchored to the right edge of the
 * viewport. Lists the notifications of the active restaurant grouped by
 * relative time, with quick actions:
 *   • Click the row → mark as read
 *   • Click the action shortcut → navigate + mark as resolved
 *   • Hover → dismiss button (delete)
 *   • Header → "Marcar todo como leído"
 *
 * Designed to feel like a notification center: skimmable, single-column,
 * keyboard-friendly (Esc closes, handled by the provider).
 */

import { useRouter } from 'next/navigation'
import {
  AlertCircle, AlertTriangle, CheckCircle2, Info,
  X, BellOff, ArrowRight, Trash2, Loader2,
} from 'lucide-react'
import { useNotifications } from '@/lib/notifications-context'
import type { NotificationRow, NotificationSeverity } from '@/lib/notifications/types'

// ── Severity styling ─────────────────────────────────────────────────────────

function severityIcon(severity: NotificationSeverity) {
  switch (severity) {
    case 'critical': return <AlertCircle    size={16} className="text-red-400 shrink-0 mt-0.5" />
    case 'warning':  return <AlertTriangle  size={16} className="text-amber-400 shrink-0 mt-0.5" />
    case 'success':  return <CheckCircle2   size={16} className="text-emerald-400 shrink-0 mt-0.5" />
    default:         return <Info           size={16} className="text-sky-400 shrink-0 mt-0.5" />
  }
}

function severityRing(severity: NotificationSeverity, isRead: boolean) {
  if (isRead) return 'border-white/5 bg-white/[0.02]'
  switch (severity) {
    case 'critical': return 'border-red-500/30 bg-red-500/[0.06]'
    case 'warning':  return 'border-amber-500/30 bg-amber-500/[0.06]'
    case 'success':  return 'border-emerald-500/25 bg-emerald-500/[0.05]'
    default:         return 'border-sky-500/25 bg-sky-500/[0.05]'
  }
}

// ── Time formatting ──────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return 'Ahora'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Hace ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'Ayer'
  if (diffD < 7) return `Hace ${diffD} días`
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function bucket(iso: string): 'hoy' | 'ayer' | 'semana' | 'antes' {
  const now = new Date()
  const then = new Date(iso)
  const sameDay = now.toDateString() === then.toDateString()
  if (sameDay) return 'hoy'
  const yesterday = new Date(now.getTime() - 24 * 3600_000)
  if (yesterday.toDateString() === then.toDateString()) return 'ayer'
  const diffDays = Math.floor((now.getTime() - then.getTime()) / (24 * 3600_000))
  if (diffDays < 7) return 'semana'
  return 'antes'
}

// ── Component ────────────────────────────────────────────────────────────────

export function NotificationsPanel() {
  const router = useRouter()
  const {
    notifications, unreadCount, loading, panelOpen, closePanel,
    markRead, markAllRead, resolve, dismiss,
  } = useNotifications()

  if (!panelOpen) return null

  // Group by time bucket while preserving order
  const groups: { key: string; label: string; items: NotificationRow[] }[] = [
    { key: 'hoy',    label: 'Hoy',          items: [] },
    { key: 'ayer',   label: 'Ayer',         items: [] },
    { key: 'semana', label: 'Esta semana',  items: [] },
    { key: 'antes',  label: 'Anteriores',   items: [] },
  ]
  for (const n of notifications) {
    const b = bucket(n.created_at)
    groups.find(g => g.key === b)!.items.push(n)
  }
  const visibleGroups = groups.filter(g => g.items.length > 0)

  function handleAction(n: NotificationRow) {
    if (!n.action_url) return
    resolve(n.id)
    closePanel()
    router.push(n.action_url)
  }

  function handleRowClick(n: NotificationRow) {
    if (!n.is_read) markRead(n.id)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closePanel}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-150"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Notificaciones"
        className="fixed top-0 right-0 z-50 h-screen w-[400px] max-w-[92vw] bg-[#0F0F1C] border-l border-white/8 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
          <div className="flex-1">
            <h2 className="text-white font-semibold text-sm">Notificaciones</h2>
            <p className="text-white/40 text-[11px] mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} sin leer · `
                : ''}
              Historial de los últimos 10 días
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-[11px] text-[#FF6B35] hover:text-[#ff8856] font-medium"
            >
              Marcar todo
            </button>
          )}
          <button
            type="button"
            onClick={closePanel}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto sidebar-scroll">
          {loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <Loader2 className="animate-spin" size={20} />
              <p className="text-xs mt-3">Cargando…</p>
            </div>
          )}

          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-white/35 px-6 text-center">
              <BellOff size={28} strokeWidth={1.5} />
              <p className="text-sm mt-3 text-white/55 font-medium">Todo bajo control</p>
              <p className="text-[11px] mt-1">
                Cuando algo necesite tu atención (stock bajo, caja abierta, DTE pendiente…)
                aparecerá acá con un atajo para resolverlo.
              </p>
            </div>
          )}

          {visibleGroups.map(group => (
            <section key={group.key} className="px-3 pt-4 pb-1">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider px-2 mb-2">
                {group.label}
              </p>
              <ul className="space-y-1.5">
                {group.items.map(n => (
                  <li key={n.id}>
                    <article
                      onClick={() => handleRowClick(n)}
                      className={[
                        'group relative rounded-xl border px-3 py-2.5 cursor-pointer transition-colors',
                        severityRing(n.severity, n.is_read),
                        n.is_read ? 'hover:bg-white/[0.04]' : 'hover:bg-white/[0.06]',
                      ].join(' ')}
                    >
                      <div className="flex gap-2.5">
                        {severityIcon(n.severity)}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p className={[
                              'text-[13px] leading-snug truncate',
                              n.is_read ? 'text-white/70' : 'text-white font-medium',
                            ].join(' ')}>
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] shrink-0 mt-1.5" />
                            )}
                          </div>
                          {n.message && (
                            <p className="text-[11.5px] text-white/50 mt-0.5 leading-snug">
                              {n.message}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-white/30">
                              {relativeTime(n.created_at)}
                            </span>
                            {n.resolved_at && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
                                <CheckCircle2 size={10} />
                                Resuelta
                              </span>
                            )}

                            {n.action_url && n.action_label && !n.resolved_at && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleAction(n) }}
                                className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF6B35] hover:text-[#ff8856] transition-colors"
                              >
                                {n.action_label}
                                <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Hover dismiss */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); dismiss(n.id) }}
                          aria-label="Eliminar"
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-white/8">
          <p className="text-[10px] text-white/30 text-center">
            Las notificaciones se eliminan automáticamente después de 10 días.
          </p>
        </footer>
      </aside>
    </>
  )
}
