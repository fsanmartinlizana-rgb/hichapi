'use client'

/**
 * <LoyaltyWallet /> — public wallet summary for a customer, scoped by restaurant.
 * Used on the post-order review page and (optionally) inside Chapi's DM.
 *
 * Behavior:
 *   - Fetches /api/loyalty/wallet/[userId]?restaurant_id=…
 *   - Quietly renders nothing if the program isn't active.
 *   - Shows stamp card (X / Y), points balance, active coupons.
 *   - Lets the customer redeem a catalog reward → returns a coupon code.
 */

import { useCallback, useEffect, useState } from 'react'
import { Gift, Ticket, Sparkles, Loader2, Check } from 'lucide-react'

interface WalletProgram {
  id: string
  name: string
  active: boolean
  mechanic: 'stamps' | 'points' | 'both'
  stamps_per_reward: number
  welcome_points: number
}

interface Coupon {
  id: string
  code: string
  status: string
  expires_at: string | null
  reward: { id: string; name: string; type: string } | null
}

interface WalletData {
  program: WalletProgram | null
  points: { points_balance: number; lifetime_points: number } | null
  stamps: { current_stamps: number; total_stamps_earned: number } | null
  coupons: Coupon[]
}

export function LoyaltyWallet({
  userId,
  restaurantId,
  compact = false,
}: {
  userId: string
  restaurantId: string
  compact?: boolean
}) {
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId || !restaurantId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/loyalty/wallet/${userId}?restaurant_id=${restaurantId}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const json = (await res.json()) as WalletData
      setData(json)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [userId, restaurantId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/30 text-xs py-2">
        <Loader2 size={12} className="animate-spin" /> Cargando tu cuenta…
      </div>
    )
  }
  if (err) return null
  if (!data?.program?.active) return null

  const { program, points, stamps, coupons } = data
  const hasStamps = program.mechanic === 'stamps' || program.mechanic === 'both'
  const hasPoints = program.mechanic === 'points' || program.mechanic === 'both'

  return (
    <div className={`bg-gradient-to-br from-[#FF6B35]/10 via-[#FF6B35]/5 to-transparent border border-[#FF6B35]/20 rounded-2xl ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl bg-[#FF6B35]/20 text-[#FF6B35] flex items-center justify-center">
          <Gift size={14} />
        </div>
        <div>
          <p className="text-white text-sm font-bold leading-tight">{program.name}</p>
          <p className="text-white/40 text-[10px]">Tu progreso en este restaurante</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {hasStamps && (
          <div className="bg-white/5 border border-white/8 rounded-xl p-3">
            <p className="text-white/40 text-[10px] uppercase tracking-wide font-semibold">Sellos</p>
            <p className="text-white font-bold text-lg leading-none mt-0.5" style={{ fontFamily: 'var(--font-dm-mono)' }}>
              {stamps?.current_stamps ?? 0}
              <span className="text-white/40 text-xs font-normal"> / {program.stamps_per_reward}</span>
            </p>
            <StampProgress current={stamps?.current_stamps ?? 0} total={program.stamps_per_reward} />
          </div>
        )}
        {hasPoints && (
          <div className="bg-white/5 border border-white/8 rounded-xl p-3">
            <p className="text-white/40 text-[10px] uppercase tracking-wide font-semibold flex items-center gap-1">
              <Sparkles size={9} className="text-[#FF6B35]" /> Puntos
            </p>
            <p className="text-white font-bold text-lg leading-none mt-0.5" style={{ fontFamily: 'var(--font-dm-mono)' }}>
              {(points?.points_balance ?? 0).toLocaleString('es-CL')}
            </p>
            <p className="text-white/30 text-[10px] mt-0.5">
              Total histórico: {(points?.lifetime_points ?? 0).toLocaleString('es-CL')}
            </p>
          </div>
        )}
      </div>

      {coupons.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold flex items-center gap-1">
            <Ticket size={10} /> Cupones disponibles
          </p>
          {coupons.slice(0, 3).map(c => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <Check size={11} className="text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-emerald-200 text-xs font-semibold truncate">{c.reward?.name ?? 'Recompensa'}</p>
                <p className="text-emerald-300/60 text-[10px] font-mono">{c.code}</p>
              </div>
              {c.expires_at && (
                <span className="text-emerald-300/60 text-[9px] shrink-0">
                  expira {new Date(c.expires_at).toLocaleDateString('es-CL')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StampProgress({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / total) * 100))
  return (
    <div className="w-full h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
      <div
        className="h-full bg-[#FF6B35] rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
