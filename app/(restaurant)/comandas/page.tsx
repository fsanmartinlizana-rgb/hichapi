'use client'

import { useState } from 'react'
import { Clock, ChevronRight, Plus, Filter, Search, CheckCircle2, ChefHat, Bell, Bike } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus = 'recibida' | 'preparando' | 'lista' | 'entregada'

interface OrderItem {
  name: string
  qty: number
  note?: string
}

interface Order {
  id: string
  tableId: string
  tableLabel: string
  pax: number
  status: OrderStatus
  items: OrderItem[]
  amount: number
  mins: number        // elapsed minutes
  viaChapi: boolean
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const ORDERS: Order[] = [
  {
    id: 'ord-001', tableId: 'M-4', tableLabel: 'Mesa 4', pax: 3,
    status: 'recibida', viaChapi: true, mins: 2, amount: 54200,
    items: [
      { name: 'Lomo vetado', qty: 1 },
      { name: 'Ensalada César', qty: 1 },
      { name: 'Pasta arrabiata', qty: 1, note: 'sin ajo' },
    ],
  },
  {
    id: 'ord-002', tableId: 'M-9', tableLabel: 'Mesa 9', pax: 2,
    status: 'recibida', viaChapi: true, mins: 5, amount: 29800,
    items: [
      { name: 'Ceviche', qty: 1 },
      { name: 'Pan de ajo', qty: 1 },
      { name: 'Pisco sour', qty: 2 },
    ],
  },
  {
    id: 'ord-003', tableId: 'M-7', tableLabel: 'Mesa 7', pax: 2,
    status: 'preparando', viaChapi: true, mins: 14, amount: 38900,
    items: [
      { name: 'Salmón grillado', qty: 1, note: 'sin gluten' },
      { name: 'Gazpacho', qty: 1 },
    ],
  },
  {
    id: 'ord-004', tableId: 'M-2', tableLabel: 'Mesa 2', pax: 4,
    status: 'preparando', viaChapi: false, mins: 22, amount: 71600,
    items: [
      { name: 'Pizza napolitana', qty: 2 },
      { name: 'Risotto', qty: 1 },
      { name: 'Tiramisú', qty: 1 },
    ],
  },
  {
    id: 'ord-005', tableId: 'M-1', tableLabel: 'Mesa 1', pax: 2,
    status: 'preparando', viaChapi: true, mins: 18, amount: 22500,
    items: [
      { name: 'Tagliatelle bolognesa', qty: 1 },
      { name: 'Agua con gas', qty: 2 },
    ],
  },
  {
    id: 'ord-006', tableId: 'M-6', tableLabel: 'Mesa 6', pax: 3,
    status: 'lista', viaChapi: true, mins: 28, amount: 47100,
    items: [
      { name: 'Salmón grillado', qty: 2 },
      { name: 'Ensalada niçoise', qty: 1 },
    ],
  },
  {
    id: 'ord-007', tableId: 'M-3', tableLabel: 'Mesa 3', pax: 5,
    status: 'lista', viaChapi: false, mins: 35, amount: 93400,
    items: [
      { name: 'Lomo vetado', qty: 3 },
      { name: 'Papas fritas', qty: 2 },
      { name: 'Vino tinto copa', qty: 4 },
    ],
  },
  {
    id: 'ord-008', tableId: 'M-5', tableLabel: 'Mesa 5', pax: 2,
    status: 'entregada', viaChapi: true, mins: 51, amount: 31200,
    items: [
      { name: 'Carpaccio', qty: 1 },
      { name: 'Pasta arrabiata', qty: 1 },
    ],
  },
]

// ── Column config ─────────────────────────────────────────────────────────────

const COLUMNS: {
  status: OrderStatus
  label: string
  icon: React.ReactNode
  color: string
  next: OrderStatus | null
  nextLabel: string
}[] = [
  {
    status: 'recibida',
    label: 'Recibida',
    icon: <Bell size={13} />,
    color: '#60A5FA',
    next: 'preparando',
    nextLabel: 'Enviar a cocina',
  },
  {
    status: 'preparando',
    label: 'En cocina',
    icon: <ChefHat size={13} />,
    color: '#FBBF24',
    next: 'lista',
    nextLabel: 'Marcar lista',
  },
  {
    status: 'lista',
    label: 'Lista',
    icon: <CheckCircle2 size={13} />,
    color: '#34D399',
    next: 'entregada',
    nextLabel: 'Confirmar entrega',
  },
  {
    status: 'entregada',
    label: 'Entregada',
    icon: <Bike size={13} />,
    color: '#6B7280',
    next: null,
    nextLabel: '',
  },
]

// ── OrderCard ─────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  col,
  onAdvance,
}: {
  order: Order
  col: typeof COLUMNS[0]
  onAdvance: (id: string, next: OrderStatus) => void
}) {
  const urgent = order.status === 'preparando' && order.mins > 20
    || order.status === 'recibida' && order.mins > 8

  return (
    <div className={`bg-[#1C1C2E] rounded-xl border p-3.5 space-y-3 transition-all
                     ${urgent ? 'border-red-500/40' : 'border-white/6'}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border shrink-0"
               style={{ backgroundColor: col.color + '15', borderColor: col.color + '30', color: col.color }}>
            {order.tableId}
          </div>
          <div>
            <p className="text-white text-xs font-semibold">{order.tableLabel} · {order.pax} pax</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Clock size={9} className={urgent ? 'text-red-400' : 'text-white/25'} />
              <span className={`text-[10px] ${urgent ? 'text-red-400 font-medium' : 'text-white/30'}`}>
                {order.mins} min
              </span>
              {order.viaChapi && (
                <span className="text-[9px] text-[#FF6B35]/70 px-1.5 py-0.5 rounded bg-[#FF6B35]/10 ml-1">
                  vía Chapi
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="text-white/60 text-xs font-mono shrink-0">
          ${(order.amount / 1000).toFixed(1)}k
        </p>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-white/20 text-[10px] w-3 shrink-0 mt-0.5">{item.qty}×</span>
            <div>
              <span className="text-white/70 text-xs">{item.name}</span>
              {item.note && (
                <p className="text-[#FBBF24]/70 text-[9px] italic">· {item.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action */}
      {col.next && (
        <button
          onClick={() => onAdvance(order.id, col.next!)}
          className="w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5"
          style={{
            backgroundColor: col.color + '18',
            color: col.color,
            border: `1px solid ${col.color}30`,
          }}
        >
          {col.icon}
          {col.nextLabel}
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ComandasPage() {
  const [orders, setOrders] = useState<Order[]>(ORDERS)
  const [search, setSearch] = useState('')

  function advance(id: string, next: OrderStatus) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: next } : o))
  }

  const filtered = search
    ? orders.filter(o =>
        o.tableLabel.toLowerCase().includes(search.toLowerCase()) ||
        o.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()))
      )
    : orders

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-white text-xl font-bold">Comandas</h1>
          <p className="text-white/35 text-sm mt-0.5">
            {orders.filter(o => o.status !== 'entregada').length} activas ·{' '}
            {orders.filter(o => o.status === 'entregada').length} entregadas hoy
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Mesa o plato..."
              className="pl-8 pr-4 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                         placeholder:text-white/25 focus:outline-none focus:border-white/20 w-44"
            />
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35]
                             text-white text-sm font-semibold hover:bg-[#e85d2a] transition-colors">
            <Plus size={14} />
            Nueva comanda
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        <div className="flex gap-4 h-full" style={{ minWidth: '900px' }}>
          {COLUMNS.map(col => {
            const colOrders = filtered.filter(o => o.status === col.status)
            return (
              <div key={col.status} className="flex-1 flex flex-col min-w-0">

                {/* Column header */}
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center"
                         style={{ backgroundColor: col.color + '20', color: col.color }}>
                      {col.icon}
                    </div>
                    <span className="text-white text-sm font-semibold">{col.label}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: col.color + '20', color: col.color }}>
                      {colOrders.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {colOrders.length === 0 ? (
                    <div className="border border-dashed border-white/8 rounded-xl h-24
                                    flex items-center justify-center">
                      <p className="text-white/15 text-xs">Sin comandas</p>
                    </div>
                  ) : (
                    colOrders.map(o => (
                      <OrderCard key={o.id} order={o} col={col} onAdvance={advance} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
