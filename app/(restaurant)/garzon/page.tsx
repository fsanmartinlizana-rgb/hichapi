'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Clock, CheckCircle2, ChefHat, Banknote, Bell,
  RefreshCw, Wifi, WifiOff, AlertCircle,
} from 'lucide-react'
import { PaymentMethodModal } from '@/components/PaymentMethodModal'

// ── Types ─────────────────────────────────────────────────────────────────────

type TableStatus = 'libre' | 'ocupada' | 'reservada' | 'bloqueada'
type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'paying' | 'paid' | 'cancelled'

interface Table {
  id: string
  label: string
  seats: number
  status: TableStatus
  zone: string | null
}

interface OrderItem {
  id: string
  name: string
  quantity: number
  unit_price: number
  notes: string | null
  status: string
}

interface Order {
  id: string
  table_id: string
  status: OrderStatus
  total: number
  client_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
  order_items: OrderItem[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABLE_STATUS_STYLES: Record<TableStatus, { bg: string; border: string; text: string; dot: string }> = {
  libre:     { bg: 'bg-white/3',         border: 'border-white/8',        text: 'text-white/30',  dot: 'bg-white/20'    },
  ocupada:   { bg: 'bg-[#FF6B35]/10',    border: 'border-[#FF6B35]/30',   text: 'text-[#FF6B35]', dot: 'bg-[#FF6B35]'  },
  reservada: { bg: 'bg-violet-500/10',   border: 'border-violet-500/30',  text: 'text-violet-400', dot: 'bg-violet-400' },
  bloqueada: { bg: 'bg-white/5',         border: 'border-white/10',       text: 'text-white/20',  dot: 'bg-white/15'    },
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ReactNode; next: OrderStatus | null; nextLabel: string }> = {
  pending:   { label: 'Nuevo pedido',  color: '#60A5FA', bg: 'bg-blue-500/15',    icon: <Bell size={13} />,        next: 'preparing', nextLabel: 'Enviar a cocina' },
  confirmed: { label: 'Confirmado',    color: '#FBBF24', bg: 'bg-yellow-500/15',  icon: <CheckCircle2 size={13} />, next: 'preparing', nextLabel: 'Enviar a cocina' },
  preparing: { label: 'En cocina',     color: '#FBBF24', bg: 'bg-yellow-500/15',  icon: <ChefHat size={13} />,     next: 'ready',     nextLabel: 'Marcar listo'    },
  ready:     { label: '¡Listo!',       color: '#34D399', bg: 'bg-emerald-500/15', icon: <CheckCircle2 size={13} />, next: 'paying',   nextLabel: 'Cobrar'          },
  paying:    { label: 'Cobrando',      color: '#FBBF24', bg: 'bg-yellow-500/15',  icon: <Banknote size={13} />,    next: 'paid',      nextLabel: 'Pagado ✓'        },
  paid:      { label: 'Pagado',        color: '#6B7280', bg: 'bg-white/8',        icon: <CheckCircle2 size={13} />, next: null,       nextLabel: ''                },
  cancelled: { label: 'Cancelado',     color: '#6B7280', bg: 'bg-white/8',        icon: <AlertCircle size={13} />, next: null,        nextLabel: ''                },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clp(amount: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount)
}

function elapsedMin(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TableCell({
  table,
  order,
  selected,
  onClick,
}: {
  table: Table
  order: Order | null
  selected: boolean
  onClick: () => void
}) {
  const s = TABLE_STATUS_STYLES[table.status]
  const isNew    = order?.status === 'pending'
  const isPaying = order?.status === 'paying'

  return (
    <button
      onClick={onClick}
      className={[
        'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-left',
        selected ? 'ring-2 ring-[#FF6B35] ring-offset-1 ring-offset-[#0A0A14]' : '',
        s.bg, s.border,
        isNew ? 'animate-pulse-border' : isPaying ? 'animate-pulse-amber' : '',
      ].join(' ')}
    >
      {/* New order badge */}
      {isNew && (
        <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#FF6B35] ring-2 ring-[#0A0A14]" />
      )}
      {/* Bill requested badge */}
      {isPaying && (
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#FBBF24] ring-2 ring-[#0A0A14] flex items-center justify-center">
          <Banknote size={9} className="text-[#0A0A14]" />
        </span>
      )}

      <p className="text-white font-bold text-base leading-none" style={{ fontFamily: 'var(--font-dm-mono)' }}>
        {table.label.replace('Mesa ', '')}
      </p>
      <span className={`text-[9px] font-medium ${s.text}`}>
        {table.status}
      </span>

      {order && (
        <span
          className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: ORDER_STATUS_CONFIG[order.status].color + '25', color: ORDER_STATUS_CONFIG[order.status].color }}
        >
          {ORDER_STATUS_CONFIG[order.status].label}
        </span>
      )}
    </button>
  )
}

function OrderPanel({
  table,
  order,
  onAdvance,
  onClose,
  advancing,
}: {
  table: Table
  order: Order | null
  onAdvance: (orderId: string, next: OrderStatus) => void
  onClose: () => void
  advancing: boolean
}) {
  if (!order) {
    return (
      <div className="bg-[#161622] border border-white/8 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 min-h-32">
        <p className="text-white/25 text-sm">Sin pedidos activos en {table.label}</p>
        <button onClick={onClose} className="text-[#FF6B35]/60 text-xs hover:text-[#FF6B35] transition-colors">
          Cerrar
        </button>
      </div>
    )
  }

  const cfg = ORDER_STATUS_CONFIG[order.status]
  const elapsed = elapsedMin(order.created_at)

  return (
    <div className="bg-[#161622] border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: cfg.color + '20', color: cfg.color }}>
            {cfg.icon}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{table.label}</p>
            <p className="text-white/35 text-xs">
              #{order.id.slice(-4).toUpperCase()} · hace {elapsed} min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg}`}
            style={{ color: cfg.color }}
          >
            {cfg.label}
          </span>
          <button onClick={onClose} className="text-white/20 hover:text-white/50 text-xs transition-colors ml-1">
            ✕
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-2">
        {order.order_items.map((item, i) => (
          <div key={item.id ?? i} className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm">
                <span className="text-[#FF6B35] font-semibold">{item.quantity}×</span>{' '}
                {item.name}
              </p>
              {item.notes && (
                <p className="text-white/30 text-xs italic mt-0.5">{item.notes}</p>
              )}
            </div>
            <p className="text-white/50 text-xs font-mono shrink-0">
              {clp(item.unit_price * item.quantity)}
            </p>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/6">
        <span className="text-white/40 text-sm">Total</span>
        <span className="text-white font-bold text-base" style={{ fontFamily: 'var(--font-dm-mono)' }}>
          {clp(order.total)}
        </span>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="px-4 pb-3">
          <p className="text-white/30 text-xs italic">📝 {order.notes}</p>
        </div>
      )}

      {/* Action button */}
      {cfg.next && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onAdvance(order.id, cfg.next!)}
            disabled={advancing}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm
                       hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: cfg.color }}
          >
            {advancing ? (
              <><RefreshCw size={14} className="animate-spin" /> Actualizando…</>
            ) : (
              cfg.nextLabel
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GarzonPage() {
  const [tables, setTables]       = useState<Table[]>([])
  const [orders, setOrders]       = useState<Order[]>([])
  const [selected, setSelected]   = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [online, setOnline]       = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [payingOrder, setPayingOrder] = useState<{ id: string; total: number } | null>(null)

  const supabase = createClient()

  // ── Load all data ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const [tablesRes, ordersRes] = await Promise.all([
      supabase
        .from('tables')
        .select('id, label, seats, status, zone')
        .order('label'),
      supabase
        .from('orders')
        .select('id, table_id, status, total, client_name, notes, created_at, updated_at, order_items(id, name, quantity, unit_price, notes, status)')
        .not('status', 'in', '("paid","cancelled")')
        .order('created_at', { ascending: false }),
    ])

    if (!tablesRes.error && tablesRes.data) setTables(tablesRes.data as Table[])
    if (!ordersRes.error && ordersRes.data) setOrders(ordersRes.data as Order[])
    setLastRefresh(new Date())
    setLoading(false)
    setOnline(true)
  }, [supabase])

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel('garzon-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        () => loadData()
      )
      .subscribe(status => {
        setOnline(status === 'SUBSCRIBED')
      })

    return () => { supabase.removeChannel(channel) }
  }, [loadData, supabase])

  // ── Advance order status ──────────────────────────────────────────────────

  async function advanceOrder(orderId: string, nextStatus: OrderStatus) {
    // If advancing to 'paid', show payment method modal instead of advancing directly
    if (nextStatus === 'paid') {
      const order = orders.find(o => o.id === orderId)
      if (order) {
        setPayingOrder({ id: orderId, total: order.total })
        return
      }
    }

    setAdvancing(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)

      if (!error) {
        await loadData()
      }
    } finally {
      setAdvancing(false)
    }
  }

  async function handlePaymentConfirm(
    method: 'cash' | 'digital' | 'mixed',
    cashAmount?: number,
    digitalAmount?: number,
  ) {
    if (!payingOrder) return
    setAdvancing(true)
    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id:       payingOrder.id,
          status:         'paid',
          payment_method: method,
          cash_amount:    cashAmount ?? 0,
          digital_amount: digitalAmount ?? 0,
        }),
      })

      // Mark table as libre
      const order = orders.find(o => o.id === payingOrder.id)
      if (order) {
        await supabase
          .from('tables')
          .update({ status: 'libre' })
          .eq('id', order.table_id)
      }

      setPayingOrder(null)
      setSelected(null)
      await loadData()
    } finally {
      setAdvancing(false)
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const pendingCount   = orders.filter(o => o.status === 'pending').length
  const preparingCount = orders.filter(o => o.status === 'preparing').length
  const readyCount     = orders.filter(o => o.status === 'ready').length
  const payingCount    = orders.filter(o => o.status === 'paying').length

  const selectedTable = tables.find(t => t.id === selected) ?? null
  const selectedOrder = selected ? orders.find(o => o.table_id === selected) ?? null : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0A14]">
        <RefreshCw size={20} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Panel Garzón</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-white/35 text-xs">
              {lastRefresh.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: online ? '#34D399' : '#F87171' }}>
              {online ? <Wifi size={10} /> : <WifiOff size={10} />}
              {online ? 'En vivo' : 'Sin conexión'}
            </span>
          </div>
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded-xl bg-white/5 border border-white/8 text-white/40
                     hover:bg-white/8 hover:text-white transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Nuevos',     count: pendingCount,   color: '#60A5FA' },
          { label: 'En cocina',  count: preparingCount, color: '#FBBF24' },
          { label: 'Listos',     count: readyCount,     color: '#34D399' },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-[#161622] border border-white/5 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold" style={{ color, fontFamily: 'var(--font-dm-mono)' }}>{count}</p>
            <p className="text-white/35 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Bill requested alert */}
      {payingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-amber-500/10 border-amber-500/40 animate-pulse-amber">
          <Banknote size={18} className="text-[#FBBF24] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[#FBBF24] font-bold text-sm">
              {payingCount === 1 ? '¡1 mesa pide la cuenta!' : `¡${payingCount} mesas piden la cuenta!`}
            </p>
            <p className="text-white/45 text-xs truncate">
              {orders
                .filter(o => o.status === 'paying')
                .map(o => tables.find(t => t.id === o.table_id)?.label ?? 'Mesa')
                .join(' · ')}
            </p>
          </div>
          <span className="text-xs text-amber-300/60 shrink-0">Cobrar →</span>
        </div>
      )}

      {/* Table grid */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-4">
        <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-3">Mesas</p>
        {tables.length === 0 ? (
          <p className="text-white/25 text-sm text-center py-4">
            No hay mesas configuradas. Agrégalas en el panel de Mesas.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {tables.map(table => (
              <TableCell
                key={table.id}
                table={table}
                order={orders.find(o => o.table_id === table.id) ?? null}
                selected={selected === table.id}
                onClick={() => setSelected(selected === table.id ? null : table.id)}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {Object.entries(TABLE_STATUS_STYLES).map(([status, s]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              <span className="text-white/25 text-[10px] capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected table order panel */}
      {selected && selectedTable && (
        <OrderPanel
          table={selectedTable}
          order={selectedOrder}
          onAdvance={advanceOrder}
          onClose={() => setSelected(null)}
          advancing={advancing}
        />
      )}

      {/* Active orders list (when no table selected) */}
      {!selected && orders.length > 0 && (
        <div className="space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-widest font-semibold px-0.5">
            Pedidos activos ({orders.length})
          </p>
          {orders.map(order => {
            const table = tables.find(t => t.id === order.table_id)
            const cfg = ORDER_STATUS_CONFIG[order.status]
            const elapsed = elapsedMin(order.created_at)

            return (
              <button
                key={order.id}
                onClick={() => setSelected(order.table_id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                           bg-[#161622] border border-white/5
                           hover:border-[#FF6B35]/30 transition-colors text-left"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: cfg.color + '20', color: cfg.color }}
                >
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold">
                    {table?.label ?? 'Mesa'} — {order.order_items.length} ítem{order.order_items.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-white/30 text-xs truncate">
                    {order.order_items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white font-semibold text-sm" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                    {clp(order.total)}
                  </p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <Clock size={9} className="text-white/25" />
                    <span className="text-white/25 text-[10px]">{elapsed}m</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!selected && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
            <CheckCircle2 size={24} className="text-white/15" />
          </div>
          <p className="text-white/25 text-sm">Sin pedidos activos 🎉</p>
          <p className="text-white/15 text-xs">Los nuevos pedidos aparecerán aquí en tiempo real</p>
        </div>
      )}

      {/* Payment method modal */}
      {payingOrder && (
        <PaymentMethodModal
          orderId={payingOrder.id}
          total={payingOrder.total}
          onConfirm={handlePaymentConfirm}
          onClose={() => setPayingOrder(null)}
        />
      )}

      {/* Pulse animation for tables with new orders */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0); }
          50% { box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.3); }
        }
        .animate-pulse-border { animation: pulse-border 2s ease-in-out infinite; }
        @keyframes pulse-amber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
          50% { box-shadow: 0 0 0 5px rgba(251, 191, 36, 0.35); }
        }
        .animate-pulse-amber { animation: pulse-amber 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
