'use client'

/**
 * BillRequestFloater — floating action button que aparece SIEMPRE que hay
 * una mesa pidiendo la cuenta, independientemente de la página en la que
 * esté el garzón.
 *
 * - Se muestra abajo a la derecha (sobre el ChapiAssistant si hace falta).
 * - Anima con bounce + pulse para captar atención.
 * - Lista las mesas que pidieron cuenta (ordenadas por más reciente).
 * - Click expande para ver detalle. Click en mesa → navega a /comandas focusada.
 * - Reproduce un ding sutil cuando llega una nueva (respeta prefs del browser).
 *
 * La fuente de datos es el contexto de notificaciones (que ya tiene realtime).
 * Se filtra por type === 'bill_requested' AND no resuelta.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, X, Receipt, ChevronUp } from 'lucide-react'
import { useNotifications } from '@/lib/notifications-context'

export function BillRequestFloater() {
  const router    = useRouter()
  const pathname  = usePathname()
  const { notifications, resolve } = useNotifications()
  const [expanded, setExpanded] = useState(false)
  const [dismissedThisSession, setDismissed] = useState<Set<string>>(new Set())
  const prevIdsRef = useRef<Set<string>>(new Set())

  // Filtrar bill_requested no resueltas y no descartadas en esta sesión
  const billNotifs = useMemo(() => {
    return notifications.filter(n =>
      n.type === 'bill_requested' &&
      !n.resolved_at &&
      !dismissedThisSession.has(n.id)
    )
  }, [notifications, dismissedThisSession])

  // Detectar nueva notif → tocar ding sutil + auto-expandir
  useEffect(() => {
    const currentIds = new Set(billNotifs.map(n => n.id))
    const isNew = billNotifs.some(n => !prevIdsRef.current.has(n.id))
    if (isNew && billNotifs.length > 0) {
      // Sonido sutil (Web Audio API — no requiere archivo)
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.setValueAtTime(880, ctx.currentTime)
        o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15)
        g.gain.setValueAtTime(0.08, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
        o.start()
        o.stop(ctx.currentTime + 0.4)
      } catch { /* ignore */ }

      // Vibración móvil si está disponible
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { (navigator as Navigator & { vibrate?: (p: number[]) => void }).vibrate?.([100, 50, 100]) } catch { /* ignore */ }
      }

      // Auto-expandir
      setExpanded(true)
    }
    prevIdsRef.current = currentIds
  }, [billNotifs])

  // No mostrar nada si no hay cuentas pendientes
  if (billNotifs.length === 0) return null

  // No mostrarlo en ciertas rutas (ej: la propia mesa del cliente)
  if (pathname?.startsWith('/r/') || pathname?.includes('[slug]')) return null

  function handleGoToTable(notifId: string, actionUrl: string | null) {
    if (actionUrl) router.push(actionUrl)
    else router.push('/comandas')
    // No marcar como resuelta automáticamente — el garzón debe completarla
  }

  function handleDismiss(notifId: string) {
    // Solo descartar visualmente — no resolver el ticket
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(notifId)
      return next
    })
  }

  function handleResolve(notifId: string) {
    resolve(notifId)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
      <div className="pointer-events-auto">
        {expanded ? (
          /* Expanded panel */
          <div className="w-80 bg-[#1A1A2E] border-2 border-amber-500/50 rounded-2xl shadow-2xl shadow-amber-500/20 overflow-hidden animate-slide-up">
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center animate-bounce-slow">
                <Receipt size={16} className="text-[#0A0A14]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-amber-300 text-sm font-bold leading-tight">
                  {billNotifs.length === 1
                    ? '1 mesa pidió la cuenta'
                    : `${billNotifs.length} mesas pidieron la cuenta`}
                </p>
                <p className="text-amber-200/70 text-[10px]">
                  Tocá una mesa para ir a cobrar
                </p>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-amber-200/60 hover:text-amber-200 transition-colors"
                aria-label="Minimizar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
              {billNotifs.map(n => {
                const total = (n.metadata as { total?: number } | null)?.total
                return (
                  <div key={n.id} className="px-4 py-3 hover:bg-white/3 transition-colors">
                    <button
                      onClick={() => handleGoToTable(n.id, n.action_url)}
                      className="w-full text-left"
                    >
                      <p className="text-white text-sm font-semibold">{n.title}</p>
                      {n.message && (
                        <p className="text-white/50 text-xs mt-0.5">{n.message}</p>
                      )}
                      {typeof total === 'number' && (
                        <p className="text-amber-400 text-sm font-mono font-bold mt-1">
                          ${total.toLocaleString('es-CL')}
                        </p>
                      )}
                    </button>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleGoToTable(n.id, n.action_url)}
                        className="flex-1 py-1.5 rounded-lg bg-amber-500 text-[#0A0A14] text-xs font-bold hover:bg-amber-400 transition-colors"
                      >
                        Ir a cobrar →
                      </button>
                      <button
                        onClick={() => handleResolve(n.id)}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs font-medium hover:bg-emerald-500/10 transition-colors"
                        title="Marcar como resuelta"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleDismiss(n.id)}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-xs hover:bg-white/5 transition-colors"
                        title="Ocultar (no resuelve)"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Collapsed badge — bouncing button */
          <button
            onClick={() => setExpanded(true)}
            className="relative bg-amber-500 hover:bg-amber-400 text-[#0A0A14] rounded-full px-4 py-3 shadow-2xl shadow-amber-500/40 flex items-center gap-2 font-bold text-sm transition-all animate-bounce-slow"
          >
            <Bell size={16} className="animate-wiggle" />
            <span>
              {billNotifs.length === 1
                ? '1 cuenta pendiente'
                : `${billNotifs.length} cuentas`}
            </span>
            <ChevronUp size={14} className="opacity-60" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full border-2 border-amber-500 animate-ping opacity-40" />
          </button>
        )}
      </div>

      {/* Animaciones */}
      <style jsx global>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 1.6s ease-in-out infinite;
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25%      { transform: rotate(-10deg); }
          75%      { transform: rotate(10deg); }
        }
        .animate-wiggle {
          animation: wiggle 0.5s ease-in-out infinite;
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>
  )
}
