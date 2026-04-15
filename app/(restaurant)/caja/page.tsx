'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  DollarSign, TrendingUp, CreditCard, Banknote, AlertTriangle, Plus,
  CheckCircle2, Receipt, Trash2, Clock, ArrowDownCircle, ArrowUpCircle,
  Truck, Coffee, Wrench, HandCoins, MoreHorizontal, BarChart3, X,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/i18n'

const clp = (n: number) => formatCurrency(n)

// ── Types ─────────────────────────────────────────────────────────────────────

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

type ExpenseCategory = 'proveedor' | 'propina' | 'insumos' | 'servicios' | 'otros'

interface Expense {
  id: string
  amount: number
  category: ExpenseCategory
  description: string
  created_at: string
}

const CATEGORIES: { value: ExpenseCategory; label: string; icon: typeof Truck; color: string }[] = [
  { value: 'proveedor', label: 'Proveedor', icon: Truck,         color: '#60A5FA' },
  { value: 'insumos',   label: 'Insumos',   icon: Coffee,        color: '#FBBF24' },
  { value: 'servicios', label: 'Servicios', icon: Wrench,        color: '#A78BFA' },
  { value: 'propina',   label: 'Propina',   icon: HandCoins,     color: '#34D399' },
  { value: 'otros',     label: 'Otros',     icon: MoreHorizontal, color: '#9CA3AF' },
]

function catMeta(cat: ExpenseCategory) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[4]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CajaPage() {
  const { restaurant } = useRestaurant()
  const [session, setSession]       = useState<CashSession | null>(null)
  const [summary, setSummary]       = useState<DaySummary | null>(null)
  const [expenses, setExpenses]     = useState<Expense[]>([])
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [sessionOrders, setSessionOrders] = useState<Array<{
    id: string; total: number; payment_method: string | null; cash_amount: number | null;
    digital_amount: number | null; updated_at: string; client_name: string | null;
    hichapi_commission: number | null; table_label: string | null;
    items?: Array<{ name: string; quantity: number }>;
  }>>([])
  const [loading, setLoading]       = useState(true)

  const [openModal, setOpenModal]           = useState(false)
  const [closeModal, setCloseModal]         = useState(false)
  const [expenseModal, setExpenseModal]     = useState(false)
  const [reportsOpen, setReportsOpen]       = useState(false)

  const [openingAmount, setOpeningAmount] = useState('')
  const [actualCash, setActualCash]       = useState('')
  const [closeNotes, setCloseNotes]       = useState('')
  const [saving, setSaving] = useState(false)

  // Expense form
  const [expAmount, setExpAmount]     = useState('')
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('proveedor')
  const [expDescription, setExpDescription] = useState('')

  const load = useCallback(async () => {
    if (!restaurant) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/cash/register?restaurant_id=${restaurant.id}`)
      const data = await res.json()
      setSession(data.session ?? null)
      setSummary(data.summary ?? null)
      setExpenses(data.expenses ?? [])
      setTotalExpenses(data.total_expenses ?? 0)
      setSessionOrders(data.session_orders ?? [])
    } finally {
      setLoading(false)
    }
  }, [restaurant])

  useEffect(() => { load() }, [load])

  // ── Handlers ───────────────────────────────────────────────────────────────

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

  async function handleAddExpense() {
    if (!session || !restaurant || !expAmount || !expDescription) return
    setSaving(true)
    const res = await fetch('/api/cash/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id:    session.id,
        restaurant_id: restaurant.id,
        amount:        parseInt(expAmount) || 0,
        category:      expCategory,
        description:   expDescription,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setExpenseModal(false)
      setExpAmount('')
      setExpDescription('')
      setExpCategory('proveedor')
      load()
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!restaurant) return
    await fetch('/api/cash/expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restaurant_id: restaurant.id }),
    })
    load()
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const expectedCash  = session && summary
    ? session.opening_amount + summary.total_cash - totalExpenses
    : 0
  const actualCashNum = parseInt(actualCash) || 0
  const diffRaw       = actualCashNum - expectedCash
  const diffAbs       = Math.abs(diffRaw)
  const diffPct       = expectedCash > 0 ? (diffAbs / expectedCash) * 100 : 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Caja del día</h1>
          <p className="text-gray-400 text-sm mt-1">Control de efectivo, pagos digitales y gastos</p>
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <button
              onClick={() => setExpenseModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Receipt size={16} /> Registrar gasto
            </button>
          )}
          <button
            onClick={() => setReportsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors"
            title="Ver cuadratura por día / semana / mes"
          >
            <BarChart3 size={16} /> Reportes
          </button>
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
      </div>

      {/* Session banner */}
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
          <p className="text-gray-400 text-sm">Caja cerrada — abre la caja para registrar pagos y gastos</p>
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

      {/* Pedidos del turno */}
      {session && (
        <div className="bg-[#1a1a2e] rounded-xl border border-white/5">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Receipt size={14} className="text-green-400" />
              <h3 className="text-white text-sm font-semibold">Pedidos del turno</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">
                {sessionOrders.length}
              </span>
            </div>
            <span className="text-green-400 text-sm font-bold">
              {clp(sessionOrders.reduce((s, o) => s + o.total, 0))}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {sessionOrders.length === 0 ? (
              <div className="p-6 text-center text-white/25 text-xs">
                Todavía no hay pedidos pagados en este turno
              </div>
            ) : (
              sessionOrders.map(o => {
                const method = o.payment_method === 'cash' ? 'Efectivo'
                  : o.payment_method === 'digital' ? 'Digital'
                  : o.payment_method === 'mixed' ? 'Mixto'
                  : '—'
                const methodColor = o.payment_method === 'cash' ? 'text-green-400'
                  : o.payment_method === 'digital' ? 'text-blue-400'
                  : o.payment_method === 'mixed' ? 'text-purple-400'
                  : 'text-white/40'
                const itemsText = (o.items ?? [])
                  .map(it => `${it.quantity}× ${it.name}`)
                  .join(' · ')
                return (
                  <div key={o.id} className="flex items-start gap-3 px-4 py-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/60 text-[10px] font-mono shrink-0 mt-0.5">
                      {o.table_label ?? '—'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">
                        {o.client_name ?? 'Pedido'} · #{o.id.slice(-4).toUpperCase()}
                      </p>
                      <p className="text-white/35 text-[10px]">
                        <span className={methodColor}>{method}</span>
                        {' · '}
                        {new Date(o.updated_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        {o.hichapi_commission ? ` · com. ${clp(o.hichapi_commission)}` : ''}
                      </p>
                      {itemsText && (
                        <p className="text-white/45 text-[10px] mt-0.5 truncate" title={itemsText}>
                          {itemsText}
                        </p>
                      )}
                    </div>
                    <span className="text-white font-bold text-xs shrink-0 mt-0.5">{clp(o.total)}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Movements & expenses */}
      {session && (
        <div className="grid lg:grid-cols-2 gap-4">

          {/* Expenses list */}
          <div className="bg-[#1a1a2e] rounded-xl border border-white/5">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-red-400" />
                <h3 className="text-white text-sm font-semibold">Gastos de la caja</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                  {expenses.length}
                </span>
              </div>
              <span className="text-red-400 text-sm font-bold">−{clp(totalExpenses)}</span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
              {expenses.length === 0 ? (
                <div className="p-6 text-center text-white/25 text-xs">
                  Sin gastos registrados
                </div>
              ) : (
                expenses.map(e => {
                  const meta = catMeta(e.category)
                  const Icon = meta.icon
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 group/row hover:bg-white/3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: meta.color + '15', color: meta.color }}
                      >
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{e.description}</p>
                        <p className="text-white/35 text-[10px]">
                          {meta.label} · {new Date(e.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="text-red-400 text-xs font-semibold shrink-0">−{clp(e.amount)}</span>
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/row:opacity-100 transition-all shrink-0"
                        title="Eliminar"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Live reconciliation preview */}
          <div className="bg-[#1a1a2e] rounded-xl border border-white/5">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <Clock size={14} className="text-orange-400" />
              <h3 className="text-white text-sm font-semibold">Cuadratura en vivo</h3>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span className="flex items-center gap-2">
                  <ArrowUpCircle size={12} className="text-white/40" />
                  Saldo inicial
                </span>
                <span className="text-white">{clp(session.opening_amount)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span className="flex items-center gap-2">
                  <ArrowUpCircle size={12} className="text-green-400" />
                  Efectivo recibido
                </span>
                <span className="text-green-400">{summary ? clp(summary.total_cash) : '—'}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span className="flex items-center gap-2">
                  <ArrowDownCircle size={12} className="text-red-400" />
                  Gastos
                </span>
                <span className="text-red-400">−{clp(totalExpenses)}</span>
              </div>
              <div className="flex justify-between font-medium border-t border-white/10 pt-2 mt-1">
                <span className="text-white/60">Esperado en caja</span>
                <span className="text-white text-base">{clp(expectedCash)}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Open modal ───────────────────────────────────────────────────── */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Abrir caja"
        description="Cuenta el efectivo en caja antes de empezar el turno"
        size="sm"
        footer={
          <>
            <button onClick={() => setOpenModal(false)} className="py-2 px-4 rounded-lg border border-white/10 text-gray-400 text-sm">Cancelar</button>
            <button onClick={handleOpen} disabled={saving} className="py-2 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Abriendo...' : 'Abrir caja'}
            </button>
          </>
        }
      >
        <label className="block text-gray-400 text-sm mb-2">Saldo inicial en efectivo (CLP)</label>
        <input
          type="number"
          value={openingAmount}
          onChange={e => setOpeningAmount(e.target.value)}
          placeholder="0"
          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
        />
      </Modal>

      {/* ── Expense modal ───────────────────────────────────────────────── */}
      <Modal
        open={expenseModal && !!session}
        onClose={() => setExpenseModal(false)}
        title="Registrar gasto"
        description="Sale del efectivo en caja del turno actual"
        footer={
          <>
            <button
              onClick={() => setExpenseModal(false)}
              className="py-2 px-4 rounded-lg border border-white/10 text-gray-400 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddExpense}
              disabled={saving || !expAmount || !expDescription}
              className="py-2 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando…' : 'Registrar gasto'}
            </button>
          </>
        }
      >
        {/* Category picker */}
        <label className="block text-gray-400 text-xs mb-2">Categoría</label>
        <div className="grid grid-cols-5 gap-1.5 mb-4">
          {CATEGORIES.map(c => {
            const Icon   = c.icon
            const active = expCategory === c.value
            return (
              <button
                key={c.value}
                onClick={() => setExpCategory(c.value)}
                className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border text-[10px] font-medium transition-all"
                style={{
                  backgroundColor: active ? c.color + '20' : 'rgba(255,255,255,0.03)',
                  borderColor:     active ? c.color + '50' : 'rgba(255,255,255,0.08)',
                  color:           active ? c.color : 'rgba(255,255,255,0.5)',
                }}
              >
                <Icon size={14} />
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Amount */}
        <label className="block text-gray-400 text-xs mb-2">Monto (CLP)</label>
        <input
          type="number"
          value={expAmount}
          onChange={e => setExpAmount(e.target.value)}
          placeholder="0"
          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-orange-500"
        />

        {/* Description */}
        <label className="block text-gray-400 text-xs mb-2">Descripción</label>
        <input
          value={expDescription}
          onChange={e => setExpDescription(e.target.value)}
          placeholder="Ej: Verduras mercado, pago repartidor…"
          maxLength={200}
          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
        />
      </Modal>

      {/* ── Close modal ─────────────────────────────────────────────────── */}
      <Modal
        open={closeModal && !!session && !!summary}
        onClose={() => setCloseModal(false)}
        title="Cerrar caja"
        description="Cuadra el efectivo y registra cualquier diferencia"
        size="sm"
        footer={
          <>
            <button onClick={() => setCloseModal(false)} className="py-2 px-4 rounded-lg border border-white/10 text-gray-400 text-sm">Cancelar</button>
            <button onClick={handleClose} disabled={saving} className="py-2 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Cerrando...' : 'Cerrar caja'}
            </button>
          </>
        }
      >
        {session && summary && (
          <>
            <div className="bg-black/20 rounded-lg p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Saldo inicial</span>
                <span className="text-white">{clp(session.opening_amount)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>+ Efectivo recibido</span>
                <span className="text-green-400">{clp(summary.total_cash)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>− Gastos ({expenses.length})</span>
                <span className="text-red-400">{clp(totalExpenses)}</span>
              </div>
              <div className="flex justify-between text-gray-400 font-medium border-t border-white/10 pt-1">
                <span>Esperado en caja</span>
                <span className="text-white">{clp(expectedCash)}</span>
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

            {actualCash !== '' && diffAbs > 0 && (
              <div className={`flex items-center gap-2 text-xs mb-3 ${
                diffRaw > 0 ? 'text-blue-400' : 'text-yellow-400'
              }`}>
                <AlertTriangle size={12} />
                <span>
                  {diffRaw > 0 ? 'Sobrante' : 'Faltante'} de {clp(diffAbs)}
                  {diffPct > 0 && <> ({diffPct.toFixed(1)}%)</>}
                </span>
              </div>
            )}

            <textarea
              value={closeNotes}
              onChange={e => setCloseNotes(e.target.value)}
              placeholder="Notas (opcional)"
              rows={2}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
            />
          </>
        )}
      </Modal>

      {/* Reports modal — cuadratura día/semana/mes */}
      {reportsOpen && restaurant?.id && (
        <CashReportsModal
          restaurantId={restaurant.id}
          onClose={() => setReportsOpen(false)}
        />
      )}
    </div>
  )
}

// ── Reports Modal ──────────────────────────────────────────────────────────
type Period = 'day' | 'week' | 'month'

interface ReportData {
  period:    Period
  range:     { start: string; end: string }
  aggregate: {
    revenue:        number
    cash:           number
    digital:        number
    commission:     number
    expenses:       number
    orders_count:   number
    sessions_count: number
    cuadratura: {
      total_diferencias:  number
      sesiones_cuadradas: number
      sesiones_con_dif:   number
    }
  }
  sessions: Array<{
    id: string; opened_at: string; closed_at: string | null
    opening_amount: number; actual_cash: number | null
    total_cash: number | null; total_digital: number | null
    total_orders: number | null; total_expenses: number | null
    difference: number | null; status: string; notes: string | null
  }>
  by_day: Array<{ date: string; revenue: number; cash: number; digital: number; orders: number }>
}

function CashReportsModal({ restaurantId, onClose }: { restaurantId: string; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('day')
  const [date, setDate]     = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData]     = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]       = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    fetch(`/api/cash/reports?restaurant_id=${restaurantId}&period=${period}&date=${date}`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        if (j.error) setErr(j.error)
        else setData(j as ReportData)
      })
      .catch(() => { if (!cancelled) setErr('Sin conexión') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [restaurantId, period, date])

  const periodLabels: Record<Period, string> = { day: 'Día', week: 'Semana', month: 'Mes' }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1A1A2E] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <BarChart3 size={18} className="text-orange-500" /> Reportes de caja
            </h3>
            <p className="text-white/40 text-xs mt-0.5">Cuadratura por período</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                period === p
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'border-white/10 text-white/60 hover:bg-white/5'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="ml-auto px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-orange-500/50"
          />
        </div>

        {loading && (
          <div className="text-center py-12 text-white/40 text-sm">Cargando…</div>
        )}
        {err && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">{err}</div>
        )}

        {data && !loading && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Ventas"   value={clp(data.aggregate.revenue)} accent="white" />
              <KpiCard label="Efectivo" value={clp(data.aggregate.cash)}    accent="emerald" />
              <KpiCard label="Digital"  value={clp(data.aggregate.digital)} accent="blue" />
              <KpiCard label="Gastos"   value={clp(data.aggregate.expenses)} accent="amber" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Pedidos"          value={data.aggregate.orders_count.toString()}  accent="white" small />
              <KpiCard label="Sesiones"         value={data.aggregate.sessions_count.toString()} accent="white" small />
              <KpiCard
                label="Diferencia total"
                value={`${data.aggregate.cuadratura.total_diferencias >= 0 ? '+' : ''}${clp(data.aggregate.cuadratura.total_diferencias)}`}
                accent={data.aggregate.cuadratura.total_diferencias === 0 ? 'emerald' : (data.aggregate.cuadratura.total_diferencias > 0 ? 'blue' : 'amber')}
                small
              />
            </div>

            {/* Breakdown por día (week/month) */}
            {data.by_day.length > 0 && (
              <div>
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">Por día</p>
                <div className="bg-black/30 rounded-xl border border-white/8 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/8 text-white/40">
                        <th className="text-left  px-3 py-2">Fecha</th>
                        <th className="text-right px-3 py-2">Pedidos</th>
                        <th className="text-right px-3 py-2">Efectivo</th>
                        <th className="text-right px-3 py-2">Digital</th>
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_day.map(d => (
                        <tr key={d.date} className="border-b border-white/5 hover:bg-white/3">
                          <td className="px-3 py-2 text-white/80">{new Date(d.date).toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                          <td className="px-3 py-2 text-right text-white/60 tabular-nums">{d.orders}</td>
                          <td className="px-3 py-2 text-right text-emerald-400 tabular-nums">{clp(d.cash)}</td>
                          <td className="px-3 py-2 text-right text-blue-400 tabular-nums">{clp(d.digital)}</td>
                          <td className="px-3 py-2 text-right text-white font-semibold tabular-nums">{clp(d.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sesiones del período */}
            {data.sessions.length > 0 && (
              <div>
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">
                  Sesiones ({data.sessions.length})
                </p>
                <div className="space-y-2">
                  {data.sessions.map(s => {
                    const dif = s.difference ?? 0
                    return (
                      <div key={s.id} className="bg-black/30 rounded-xl p-3 border border-white/8 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-white font-medium">
                            {new Date(s.opened_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            {s.closed_at && ' → ' + new Date(s.closed_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            s.status === 'open'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/8 text-white/60 border border-white/10'
                          }`}>
                            {s.status === 'open' ? 'ABIERTA' : 'CERRADA'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-white/60">
                          <div><span className="text-white/35">Apertura:</span> {clp(s.opening_amount)}</div>
                          <div><span className="text-white/35">Efectivo:</span> {clp(s.total_cash ?? 0)}</div>
                          <div><span className="text-white/35">Digital:</span> {clp(s.total_digital ?? 0)}</div>
                          <div><span className="text-white/35">Pedidos:</span> {s.total_orders ?? 0}</div>
                        </div>
                        {s.status === 'closed' && (
                          <div className={`mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]
                            ${dif === 0 ? 'text-emerald-400' : dif > 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                            <span>
                              Diferencia: <strong>{dif === 0 ? '$0 (cuadrada)' : `${dif > 0 ? '+' : ''}${clp(dif)}`}</strong>
                            </span>
                            {s.notes && <span className="text-white/40 italic truncate ml-2">{s.notes}</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {data.aggregate.orders_count === 0 && data.sessions.length === 0 && (
              <div className="text-center py-8 text-white/30 text-sm">
                No hay actividad de caja en este período.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  label, value, accent, small,
}: {
  label: string; value: string;
  accent: 'white' | 'emerald' | 'blue' | 'amber'; small?: boolean
}) {
  const colors: Record<string, string> = {
    white:   'text-white',
    emerald: 'text-emerald-400',
    blue:    'text-blue-400',
    amber:   'text-amber-400',
  }
  return (
    <div className="bg-black/30 rounded-xl border border-white/8 p-3">
      <p className="text-white/35 text-[10px] uppercase tracking-wide font-semibold">{label}</p>
      <p className={`${small ? 'text-base' : 'text-lg'} font-bold ${colors[accent]} tabular-nums mt-0.5`}>{value}</p>
    </div>
  )
}
