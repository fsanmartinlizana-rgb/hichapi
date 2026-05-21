'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Star, TrendingUp, TrendingDown } from 'lucide-react'
import type { LoyaltyTransaction } from '@/lib/customer/types'
import { formatCurrency } from '@/lib/i18n'

export default function CuentaFidelidadPage() {
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [points, setPoints] = useState(500)
  const [redeeming, setRedeeming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/customer/loyalty')
      const data = await res.json()
      setBalance(data.balance ?? 0)
      setTransactions(data.transactions ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function redeem(e: React.FormEvent) {
    e.preventDefault()
    setRedeeming(true)
    setMessage(null)
    try {
      const res = await fetch('/api/customer/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points_to_redeem: points }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`Canje exitoso: descuento de ${formatCurrency(data.discount_clp)}`)
        await load()
      } else {
        setMessage(data.error ?? 'No se pudo canjear')
      }
    } finally {
      setRedeeming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-[#FF6B35]" size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Star size={22} className="text-[#FF6B35] fill-[#FF6B35]" />
          Fidelidad
        </h1>
        <p className="text-white/45 text-sm mt-1">Tus puntos y movimientos</p>
      </div>

      <div className="bg-gradient-to-br from-[#FF6B35]/20 to-transparent border border-[#FF6B35]/30 rounded-2xl p-6 text-center">
        <p className="text-white/50 text-sm">Balance actual</p>
        <p className="text-4xl font-bold text-[#FF6B35] mt-1">{balance}</p>
        <p className="text-white/35 text-xs mt-1">puntos</p>
      </div>

      {balance >= 500 && (
        <form onSubmit={redeem} className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-semibold text-sm">Canjear puntos</h2>
          <p className="text-white/40 text-xs">Mínimo 500 puntos. Cada 100 pts = $100 de descuento.</p>
          <input
            type="number"
            min={500}
            max={balance}
            step={100}
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value, 10) || 500)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
          />
          {message && (
            <p className={`text-xs ${message.includes('exitoso') ? 'text-emerald-400' : 'text-red-400'}`}>
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={redeeming || points > balance}
            className="w-full py-2.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {redeeming && <Loader2 size={14} className="animate-spin" />}
            Canjear {points} puntos
          </button>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="text-white font-semibold text-sm">Historial</h2>
        {transactions.length === 0 ? (
          <p className="text-white/35 text-sm italic">Sin movimientos aún.</p>
        ) : (
          <ul className="space-y-2">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-start gap-3 bg-white/[0.02] border border-white/8 rounded-xl px-4 py-3"
              >
                {tx.points_delta >= 0 ? (
                  <TrendingUp size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <TrendingDown size={16} className="text-red-400 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{tx.description}</p>
                  <p className="text-white/35 text-xs mt-0.5">
                    {new Date(tx.created_at).toLocaleString('es-CL')} · saldo {tx.balance_after}
                  </p>
                </div>
                <span
                  className={`font-semibold text-sm shrink-0 ${
                    tx.points_delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {tx.points_delta >= 0 ? '+' : ''}
                  {tx.points_delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
