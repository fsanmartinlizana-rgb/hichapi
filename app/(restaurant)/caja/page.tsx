'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import { DollarSign, TrendingUp, CreditCard, Banknote, AlertTriangle, Plus, CheckCircle2, X } from 'lucide-react'

function clp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

interface CashSession {
  id: string
  opened_at: string
  opening_amount: number
  status: 'open' | 'closed'
  total_cash?: number
  total_digital?: number
  difference?: number
}

interface DaySummary {
  total_cash: number
  total_digital: number
  total_orders: number
  total_revenue: number
  hichapi_commission: number
}

export default function CajaPage() {
  const { restaurant } = useRestaurant()
  const [session, setSession]   = useState<CashSession | null>(null)
  const [summary, setSummary]   = useState<DaySummary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [openModal, setOpenModal]   = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [actualCash, setActualCash]       = useState('')
  const [closeNotes, setCloseNotes]       = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!restaurant) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/cash/register?restaurant_id=${restaurant.id}`)
      const data = await res.json()
      setSession(data.session ?? null)
      setSummary(data.summary ?? null)
    } finally {
      setLoading(false)
    }
  }, [restaurant])

  useEffect(() => { load() }, [load])

  async function handleOpen() {
    if (!restaurant) return
    setSaving(true)
    await fetch('/api/cash/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurant.id, opening_amount: parseInt(openingAmount) || 0 }),
    })
    setOpenModal(false)
    setOpeningAmount('')
    setSaving(false)
    load()
  }

  async function handleClose() {
    if (!session) return
    setSaving(true)
    await fetch('/api/cash/register', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, actual_cash: parseInt(actualCash) || 0, notes: closeNotes }),
    })
    setCloseModal(false)
    setActualCash('')
    setCloseNotes('')
    setSaving(false)
    load()
  }

  const discrepancy = session && summary ? Math.abs((parseInt(actualCash) || 0) - (session.opening_amount + summary.total_cash)) : 0
  const discrepancyPct = summary?.total_cash && session ? (discrepancy / (session.opening_amount + summary.total_cash)) * 100 : 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Caja del día</h1>
          <p className="text-gray-400 text-sm mt-1">Control de efectivo y pagos digitales</p>
        </div>
        {!session ? (
          <button
            onClick={() => setOpenModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Abrir caja
          </button>
        ) : (
          <button
            onClick={() => setCloseModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <CheckCircle2 size={16} /> Cerrar caja
          </button>
        )}
      </div>

      {/* Session status */}
      {session && (
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-green-500/20 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <div>
            <p className="text-green-400 text-sm font-medium">Caja abierta</p>
            <p className="text-gray-400 text-xs">
              Desde {new Date(session.opened_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · Saldo inicial: {clp(session.opening_amount)}
            </p>
          </div>
        </div>
      )}
      {!session && !loading && (
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-gray-700 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <p className="text-gray-400 text-sm">Caja cerrada — abre la caja para registrar pagos</p>
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: DollarSign, label: 'Total del día', value: clp(summary.total_revenue), color: 'text-white' },
            { icon: Banknote,   label: 'Efectivo',       value: clp(summary.total_cash),    color: 'text-green-400' },
            { icon: CreditCard, label: 'Digital',         value: clp(summary.total_digital), color: 'text-blue-400' },
            { icon: TrendingUp, label: 'Comisión HiChapi',value: clp(summary.hichapi_commission), color: 'text-orange-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-[#1a1a2e] rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={color} />
                <span className="text-gray-400 text-xs">{label}</span>
              </div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-white/5 flex items-center justify-between">
          <p className="text-gray-400 text-sm">Pedidos pagados hoy</p>
          <span className="text-white font-bold text-lg">{summary.total_orders}</span>
        </div>
      )}

      {/* Open modal */}
      {openModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Abrir caja</h3>
              <button onClick={() => setOpenModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <label className="block text-gray-400 text-sm mb-2">Saldo inicial en efectivo (CLP)</label>
            <input
              type="number"
              value={openingAmount}
              onChange={e => setOpeningAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-3">
              <button onClick={() => setOpenModal(false)} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleOpen} disabled={saving} className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Abriendo...' : 'Abrir caja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close modal */}
      {closeModal && session && summary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Cerrar caja</h3>
              <button onClick={() => setCloseModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="bg-black/20 rounded-lg p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Saldo inicial</span><span className="text-white">{clp(session.opening_amount)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Efectivo recibido</span><span className="text-green-400">{clp(summary.total_cash)}</span>
              </div>
              <div className="flex justify-between text-gray-400 font-medium border-t border-white/10 pt-1">
                <span>Esperado en caja</span><span className="text-white">{clp(session.opening_amount + summary.total_cash)}</span>
              </div>
            </div>
            <label className="block text-gray-400 text-sm mb-2">¿Cuánto hay físicamente en caja?</label>
            <input
              type="number"
              value={actualCash}
              onChange={e => setActualCash(e.target.value)}
              placeholder="0"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-orange-500"
            />
            {actualCash && discrepancyPct > 1 && (
              <div className="flex items-center gap-2 text-yellow-400 text-xs mb-3">
                <AlertTriangle size={12} />
                <span>Diferencia de {clp(discrepancy)} ({discrepancyPct.toFixed(1)}%)</span>
              </div>
            )}
            <textarea
              value={closeNotes}
              onChange={e => setCloseNotes(e.target.value)}
              placeholder="Notas (opcional)"
              rows={2}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-orange-500 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setCloseModal(false)} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 text-sm">Cancelar</button>
              <button onClick={handleClose} disabled={saving} className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Cerrando...' : 'Cerrar caja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
