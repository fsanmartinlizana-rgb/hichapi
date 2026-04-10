'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Clock, ChevronRight, ChevronDown, Plus, Search, CheckCircle2, ChefHat, Bell, Bike, X, AlertTriangle, Package, RefreshCw, Wifi, WifiOff, Wine } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurant } from '@/lib/restaurant-context'

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus = 'recibida' | 'preparando' | 'lista' | 'entregada'

type UserRole = 'cocina' | 'garzon' | 'admin'

type Destination     = 'cocina' | 'barra' | 'ninguno'
type StationStatus   = 'pending' | 'preparing' | 'ready'
type StationFilter   = 'todo' | 'cocina' | 'barra'

interface OrderItem {
  name: string
  qty: number
  note?: string
  destination?: Destination
  stationStatus?: StationStatus
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
  billRequested?: boolean  // customer pressed "pedir la cuenta" (raw status === 'paying')
}

// ── DB Types & mapping ────────────────────────────────────────────────────────

interface DbTable { id: string; label: string }
interface DbOrderItem {
  id: string
  name: string
  quantity: number
  notes: string | null
  destination?: string | null
  station_status?: string | null
}
interface DbOrder {
  id: string; table_id: string; status: string; total: number
  created_at: string; order_items: DbOrderItem[]
}

function dbToUI(status: string): OrderStatus | null {
  if (status === 'pending' || status === 'confirmed') return 'recibida'
  if (status === 'preparing' || status === 'partial_ready') return 'preparando'
  if (status === 'ready' || status === 'paying')      return 'lista'
  return null   // paid / cancelled / entregada-only → ocultar
}

function uiToDb(next: OrderStatus): string {
  switch (next) {
    case 'preparando': return 'preparing'
    case 'lista':      return 'ready'
    case 'entregada':  return 'paying'
    default:           return 'preparing'
  }
}

function mapDbOrder(o: DbOrder, tables: DbTable[]): Order | null {
  const uiStatus = dbToUI(o.status)
  if (!uiStatus) return null
  const table = tables.find(t => t.id === o.table_id)
  return {
    id:         o.id,
    tableId:    table?.label?.replace('Mesa ', 'M-') ?? o.table_id.slice(-4).toUpperCase(),
    tableLabel: table?.label ?? 'Mesa',
    pax:        2,
    status:     uiStatus,
    items:      o.order_items.map(item => ({
      name: item.name,
      qty:  item.quantity,
      note: item.notes ?? undefined,
      destination:   ((item.destination as Destination) || 'cocina'),
      stationStatus: ((item.station_status as StationStatus) || 'pending'),
    })),
    amount:        o.total,
    mins:          Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60_000),
    viaChapi:      false,
    billRequested: o.status === 'paying',
  }
}

// ── Stock state ───────────────────────────────────────────────────────────────

type StockEntry = { status: 'ok' | 'low' | 'out' | '86'; qty?: number }

const ITEM_STOCK_INITIAL: Record<string, StockEntry> = {
  'Risotto':     { status: 'low', qty: 3 },
  'Gazpacho':    { status: 'out' },
  'Tiramisú':    { status: 'low', qty: 5 },
  'Lomo vetado': { status: 'ok' },
  // all others default to ok
}

function getStock(map: Record<string, StockEntry>, name: string): StockEntry {
  return map[name] ?? { status: 'ok' }
}

// ── Permissions ───────────────────────────────────────────────────────────────

function canAdvance(role: UserRole, fromStatus: OrderStatus): boolean {
  if (role === 'admin') return true
  if (role === 'cocina') return fromStatus === 'preparando'
  if (role === 'garzon') return fromStatus === 'recibida' || fromStatus === 'lista'
  return false
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

// Columns that cocina can see clearly (others dimmed)
const COCINA_HIGHLIGHT: OrderStatus[] = ['preparando', 'lista']

// Station filter chips (cocina / barra / todo)
const STATION_FILTERS: { value: StationFilter; label: string; icon: typeof ChefHat; color: string }[] = [
  { value: 'todo',   label: 'Todas',  icon: Bell,    color: '#9CA3AF' },
  { value: 'cocina', label: 'Cocina', icon: ChefHat, color: '#FBBF24' },
  { value: 'barra',  label: 'Barra',  icon: Wine,    color: '#A78BFA' },
]

const DEST_META: Record<Destination, { label: string; color: string }> = {
  cocina:  { label: 'Cocina', color: '#FBBF24' },
  barra:   { label: 'Barra',  color: '#A78BFA' },
  ninguno: { label: 'Sin prep', color: '#9CA3AF' },
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastMsg {
  id: number
  text: string
  variant?: 'break' | 'stock' | 'info'
}

function Toast({ msg }: { msg: ToastMsg }) {
  const isStock = msg.variant === 'stock'
  const isInfo  = msg.variant === 'info'
  return (
    <div className={`flex items-center gap-2 border text-white/80
                    text-xs px-4 py-2.5 rounded-xl shadow-xl animate-fade-in
                    ${isStock
                      ? 'bg-[#1C1C2E] border-amber-500/30'
                      : isInfo
                        ? 'bg-[#1C1C2E] border-emerald-500/30'
                        : 'bg-[#1C1C2E] border-red-500/30'
                    }`}>
      {isStock
        ? <Package size={12} className="text-amber-400 shrink-0" />
        : isInfo
          ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
          : <AlertTriangle size={12} className="text-red-400 shrink-0" />
      }
      {msg.text}
    </div>
  )
}

// ── StockAlertBanner ──────────────────────────────────────────────────────────

function StockAlertBanner({
  stockMap,
  onGestionar,
}: {
  stockMap: Record<string, StockEntry>
  onGestionar: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  const criticalItems = Object.entries(stockMap).filter(
    ([, entry]) => entry.status === 'low' || entry.status === 'out'
  )

  if (criticalItems.length === 0) return null

  const outItems  = criticalItems.filter(([, e]) => e.status === 'out')
  const lowItems  = criticalItems.filter(([, e]) => e.status === 'low')
  const totalCrit = criticalItems.length

  // Choose bg based on whether any item is fully out
  const hasOut = outItems.length > 0

  return (
    <div className={`mx-6 mb-4 rounded-xl border overflow-hidden transition-all
                     ${hasOut
                       ? 'bg-red-500/10 border-red-500/30'
                       : 'bg-amber-500/10 border-amber-500/30'
                     }`}>
      <div className="flex items-center justify-between px-4 py-2.5">
        {/* Left: icon + summary text */}
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertTriangle
            size={14}
            className={hasOut ? 'text-red-400 shrink-0' : 'text-amber-400 shrink-0'}
          />
          {!collapsed ? (
            <span className={`text-xs font-medium ${hasOut ? 'text-red-300' : 'text-amber-300'}`}>
              <span className="font-bold">{totalCrit} platos con stock crítico:</span>{' '}
              {lowItems.map(([name, e], idx) => (
                <span key={name}>
                  {idx > 0 && ', '}
                  <span className="font-semibold text-white/80">{name}</span>
                  {e.qty !== undefined && (
                    <span className="text-white/45"> ({e.qty} unds.)</span>
                  )}
                </span>
              ))}
              {lowItems.length > 0 && outItems.length > 0 && ', '}
              {outItems.map(([name], idx) => (
                <span key={name}>
                  {idx > 0 && ', '}
                  <span className="font-semibold text-white/80">{name}</span>
                  <span className="text-red-400/80"> (sin stock)</span>
                </span>
              ))}
            </span>
          ) : (
            <span className={`text-xs font-medium ${hasOut ? 'text-red-300' : 'text-amber-300'}`}>
              {totalCrit} platos con stock crítico
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            onClick={onGestionar}
            className={`text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors
                        ${hasOut
                          ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                          : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                        }`}
          >
            Gestionar
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-white/30 hover:text-white/60 transition-colors p-0.5"
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed
              ? <ChevronRight size={14} />
              : <ChevronDown size={14} />
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── StockQtyPopover ───────────────────────────────────────────────────────────

function StockQtyPopover({
  itemName,
  onConfirm,
  onClose,
}: {
  itemName: string
  onConfirm: (qty: number) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(5)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <div
      className="absolute right-0 top-6 z-20 bg-[#12121E] border border-white/12 rounded-xl
                  shadow-2xl p-3 w-48 flex flex-col gap-2"
      onClick={e => e.stopPropagation()}
    >
      <p className="text-white/60 text-[10px] leading-tight">
        Pocas unidades de{' '}
        <span className="text-white/90 font-semibold">{itemName}</span>
      </p>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={20}
          value={value}
          onChange={e => setValue(Math.min(20, Math.max(1, Number(e.target.value))))}
          onKeyDown={e => {
            if (e.key === 'Enter') onConfirm(value)
            if (e.key === 'Escape') onClose()
          }}
          className="flex-1 bg-white/8 border border-white/12 rounded-lg px-2 py-1
                     text-white text-sm text-center focus:outline-none focus:border-amber-400/50
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-white/35 text-[10px]">unds.</span>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => onConfirm(value)}
          className="flex-1 py-1 rounded-lg text-[11px] font-semibold
                     bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
        >
          Confirmar
        </button>
        <button
          onClick={onClose}
          className="px-2 py-1 rounded-lg text-[11px]
                     text-white/30 hover:text-white/60 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── OrderCard ─────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  col,
  role,
  station,
  brokenItems,
  stockMap,
  onAdvance,
  onMarkStationReady,
  onBreak,
  onMarkLow,
}: {
  order: Order
  col: typeof COLUMNS[0]
  role: UserRole
  station: StationFilter
  brokenItems: Set<string>
  stockMap: Record<string, StockEntry>
  onAdvance: (id: string, next: OrderStatus) => void
  onMarkStationReady: (orderId: string, destination: 'cocina' | 'barra') => void
  onBreak: (orderId: string, itemIndex: number, itemName: string) => void
  onMarkLow: (itemName: string, qty: number) => void
}) {
  const [hoveredItem, setHoveredItem] = useState<number | null>(null)
  const [popoverItem, setPopoverItem] = useState<number | null>(null)

  const urgent = order.status === 'preparando' && order.mins > 20
    || order.status === 'recibida' && order.mins > 8
    || Boolean(order.billRequested)   // customer waiting for bill is always urgent
  const canBreakItems = role === 'cocina' || role === 'admin'
  const actionAllowed = canAdvance(role, order.status)

  // Items shown on this card depend on station filter
  const visibleItems = station === 'todo'
    ? order.items.map((it, i) => ({ it, i }))
    : order.items
        .map((it, i) => ({ it, i }))
        .filter(({ it }) => (it.destination ?? 'cocina') === station)

  // Per-station readiness — used to show "Marcar listo cocina/barra"
  const stationItems = (dest: 'cocina' | 'barra') =>
    order.items.filter(it => (it.destination ?? 'cocina') === dest)
  const stationAllReady = (dest: 'cocina' | 'barra') => {
    const items = stationItems(dest)
    return items.length > 0 && items.every(it => it.stationStatus === 'ready')
  }
  const stationHasItems = (dest: 'cocina' | 'barra') => stationItems(dest).length > 0

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
            <p className="text-white text-xs font-semibold">{order.tableLabel}</p>
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

        {order.billRequested && (
          <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
            <Bell size={9} />
            Pidieron la cuenta
          </span>
        )}
      </div>

      {/* Items */}
      <div className="space-y-1">
        {visibleItems.map(({ it: item, i }) => {
          const key     = `${order.id}:${i}`
          const broken  = brokenItems.has(key)
          const stock   = getStock(stockMap, item.name)
          // broken overrides stock display (already marked 86)
          const display = broken ? '86' : stock.status
          const dest    = (item.destination ?? 'cocina') as Destination
          const itemReady = item.stationStatus === 'ready'

          return (
            <div
              key={i}
              className="flex items-start gap-2 group/item"
              onMouseEnter={() => setHoveredItem(i)}
              onMouseLeave={() => { setHoveredItem(null) }}
            >
              <span className="text-white/20 text-[10px] w-3 shrink-0 mt-0.5">{item.qty}×</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Item name with conditional decoration */}
                  <span className={`text-xs transition-all ${
                    display === '86'
                      ? 'line-through text-white/25'
                      : display === 'out'
                        ? 'line-through text-white/25'
                        : itemReady
                          ? 'line-through text-emerald-400/70'
                          : 'text-white/70'
                  }`}>
                    {item.name}
                  </span>

                  {/* Destination badge — only when in 'todo' (in station view it's redundant) */}
                  {station === 'todo' && dest !== 'cocina' && (
                    <span
                      className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0 border"
                      style={{
                        backgroundColor: DEST_META[dest].color + '15',
                        borderColor:     DEST_META[dest].color + '30',
                        color:           DEST_META[dest].color,
                      }}
                    >
                      {DEST_META[dest].label}
                    </span>
                  )}

                  {/* Per-station ready check */}
                  {itemReady && (
                    <CheckCircle2 size={9} className="text-emerald-400 shrink-0" />
                  )}

                  {/* 86 badge */}
                  {display === '86' && (
                    <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                      86
                    </span>
                  )}

                  {/* out badge */}
                  {display === 'out' && (
                    <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-600/20 text-red-300 border border-red-600/30 shrink-0 flex items-center gap-0.5">
                      <AlertTriangle size={7} />
                      sin stock
                    </span>
                  )}

                  {/* low badge */}
                  {display === 'low' && (
                    <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 shrink-0">
                      ⚠ {stock.qty} unds.
                    </span>
                  )}
                </div>
                {item.note && (
                  <p className="text-[#FBBF24]/70 text-[9px] italic">· {item.note}</p>
                )}
              </div>

              {/* Action buttons — cocina/admin only, on hover */}
              {canBreakItems && (
                <div className={`relative shrink-0 flex items-center gap-0.5 transition-all
                                  ${hoveredItem === i ? 'opacity-100' : 'opacity-0'}`}>

                  {/* Break (×) button — only if not already broken */}
                  {!broken && (
                    <button
                      onClick={() => onBreak(order.id, i, item.name)}
                      className="w-4 h-4 rounded flex items-center justify-center
                                  text-red-400/60 hover:text-red-400 hover:bg-red-500/15 transition-all"
                      title="Marcar quiebre"
                    >
                      <X size={9} />
                    </button>
                  )}

                  {/* Mark-low (!) button */}
                  {!broken && (
                    <div className="relative">
                      <button
                        onClick={() => setPopoverItem(popoverItem === i ? null : i)}
                        className="w-4 h-4 rounded flex items-center justify-center
                                    text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/15
                                    transition-all text-[9px] font-bold"
                        title="Marcar pocas unidades"
                      >
                        !
                      </button>

                      {popoverItem === i && (
                        <StockQtyPopover
                          itemName={item.name}
                          onConfirm={qty => {
                            onMarkLow(item.name, qty)
                            setPopoverItem(null)
                          }}
                          onClose={() => setPopoverItem(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Action — station mode shows "Marcar listo (cocina/barra)", todo mode shows the column action */}
      {actionAllowed && order.status !== 'entregada' && (
        station !== 'todo' ? (
          stationHasItems(station) && !stationAllReady(station) && order.status !== 'lista' && (
            <button
              onClick={() => onMarkStationReady(order.id, station)}
              className="w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: DEST_META[station].color + '18',
                color:           DEST_META[station].color,
                border: `1px solid ${DEST_META[station].color}30`,
              }}
            >
              <CheckCircle2 size={13} />
              Marcar {DEST_META[station].label.toLowerCase()} lista
            </button>
          )
        ) : (
          col.next && (
            <div className="space-y-1.5">
              {/* When in 'preparando' show per-station shortcuts if both kitchen+bar exist */}
              {order.status === 'preparando' && stationHasItems('cocina') && stationHasItems('barra') && (
                <div className="flex gap-1.5">
                  {(['cocina', 'barra'] as const).map(d => {
                    const ready = stationAllReady(d)
                    return (
                      <button
                        key={d}
                        onClick={() => !ready && onMarkStationReady(order.id, d)}
                        disabled={ready}
                        className="flex-1 py-1 rounded-lg text-[10px] font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        style={{
                          backgroundColor: DEST_META[d].color + (ready ? '08' : '18'),
                          color:           DEST_META[d].color,
                          border: `1px solid ${DEST_META[d].color}${ready ? '15' : '30'}`,
                        }}
                      >
                        {ready ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        {DEST_META[d].label} {ready ? 'lista' : 'pendiente'}
                      </button>
                    )
                  })}
                </div>
              )}
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
            </div>
          )
        )
      )}
    </div>
  )
}

// ── Nueva Comanda Modal ────────────────────────────────────────────────────────

const MESAS_DISPONIBLES = ['Mesa 1','Mesa 2','Mesa 3','Mesa 5','Mesa 6','Mesa 8','Mesa 10','Mesa 12']
const MENU_ITEMS_QUICK  = [
  'Lomo vetado','Pasta arrabiata','Salmón grillado','Risotto','Pizza napolitana',
  'Ensalada César','Tiramisú','Gazpacho','Ceviche','Pan de ajo','Pisco sour',
]

interface NuevaComandaLine { name: string; qty: number; note: string }

function NuevaComandaModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (order: Order) => void
}) {
  const [mesa, setMesa]   = useState('')
  const [pax, setPax]     = useState(2)
  const [lines, setLines] = useState<NuevaComandaLine[]>([{ name: '', qty: 1, note: '' }])
  const [saving, setSaving] = useState(false)

  function addLine() { setLines(prev => [...prev, { name: '', qty: 1, note: '' }]) }
  function removeLine(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, patch: Partial<NuevaComandaLine>) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }

  function handleSave() {
    if (!mesa || lines.every(l => !l.name)) return
    setSaving(true)
    const validLines = lines.filter(l => l.name)
    const newOrder: Order = {
      id:         `ord-${Date.now()}`,
      tableId:    mesa.replace(' ', '-').toLowerCase(),
      tableLabel: mesa,
      pax,
      status:     'recibida',
      items:      validLines.map(l => ({ name: l.name, qty: l.qty, note: l.note || undefined })),
      amount:     0,
      mins:       0,
      viaChapi:   false,
    }
    setTimeout(() => {
      onSave(newOrder)
      setSaving(false)
    }, 400)
  }

  const canSave = mesa && lines.some(l => l.name)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-[#161622] border border-white/10 rounded-2xl w-full max-w-md
                      shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h2 className="text-white font-bold text-base">Nueva comanda</h2>
            <p className="text-white/35 text-xs mt-0.5">Crea una comanda manualmente</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Mesa + Pax */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Mesa</label>
              <select
                value={mesa}
                onChange={e => setMesa(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                           focus:outline-none focus:border-[#FF6B35]/50 transition-colors appearance-none"
              >
                <option value="" className="bg-[#161622]">Seleccionar…</option>
                {MESAS_DISPONIBLES.map(m => (
                  <option key={m} value={m} className="bg-[#161622]">{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Personas</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPax(p => Math.max(1, p - 1))}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 text-white hover:bg-white/10 transition-colors flex items-center justify-center font-bold"
                >−</button>
                <span className="flex-1 text-center text-white font-bold text-base">{pax}</span>
                <button
                  onClick={() => setPax(p => Math.min(20, p + 1))}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 text-white hover:bg-white/10 transition-colors flex items-center justify-center font-bold"
                >+</button>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-white/40 text-xs font-medium">Platos</label>
              <button
                onClick={addLine}
                className="text-[#FF6B35] text-xs hover:text-[#ff8255] flex items-center gap-1 transition-colors"
              >
                <Plus size={11} /> Agregar plato
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex gap-2">
                    {/* Qty */}
                    <select
                      value={line.qty}
                      onChange={e => updateLine(i, { qty: Number(e.target.value) })}
                      className="w-14 px-2 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                                 focus:outline-none focus:border-[#FF6B35]/50 appearance-none text-center"
                    >
                      {[1,2,3,4,5,6].map(n => <option key={n} value={n} className="bg-[#161622]">{n}×</option>)}
                    </select>
                    {/* Item name */}
                    <select
                      value={line.name}
                      onChange={e => updateLine(i, { name: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                                 focus:outline-none focus:border-[#FF6B35]/50 appearance-none"
                    >
                      <option value="" className="bg-[#161622]">Seleccionar plato…</option>
                      {MENU_ITEMS_QUICK.map(item => (
                        <option key={item} value={item} className="bg-[#161622]">{item}</option>
                      ))}
                    </select>
                    {/* Remove */}
                    {lines.length > 1 && (
                      <button
                        onClick={() => removeLine(i)}
                        className="w-9 h-9 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/8
                                   hover:border-red-500/30 text-white/30 hover:text-red-400 transition-colors flex items-center justify-center"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {/* Note */}
                  <input
                    value={line.note}
                    onChange={e => updateLine(i, { note: e.target.value })}
                    placeholder="Nota opcional (sin gluten, sin cebolla…)"
                    className="w-full px-3 py-1.5 rounded-lg bg-white/3 border border-white/6 text-white/70
                               placeholder:text-white/20 text-[11px] focus:outline-none focus:border-white/15"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/8 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm
                       hover:border-white/20 hover:text-white/60 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold
                       hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Clock size={14} className="animate-spin" /> Creando…</>
            ) : (
              <><Plus size={14} /> Crear comanda</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function ComandasPageInner() {
  const searchParams = useSearchParams()
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [orders, setOrders]           = useState<Order[]>([])
  const [loading, setLoading]         = useState(true)
  const [online, setOnline]           = useState(true)
  const [search, setSearch]           = useState('')
  const [role, setRole]               = useState<UserRole>('admin')
  const [station, setStation]         = useState<StationFilter>('todo')
  const [brokenItems, setBrokenItems] = useState<Set<string>>(new Set())
  const [stockMap, setStockMap]       = useState<Record<string, StockEntry>>(ITEM_STOCK_INITIAL)
  const [toasts, setToasts]           = useState<ToastMsg[]>([])
  const [showNueva, setShowNueva]     = useState(() => searchParams.get('nueva') === '1')

  const supabase = createClient()

  // ── Load from Supabase ─────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!restId) return
    const [tablesRes, ordersRes] = await Promise.all([
      supabase.from('tables').select('id, label').eq('restaurant_id', restId),
      supabase
        .from('orders')
        .select('id, table_id, status, total, created_at, order_items(id, name, quantity, notes, destination, station_status)')
        .eq('restaurant_id', restId)
        .not('status', 'in', '("paid","cancelled")')
        .order('created_at', { ascending: false }),
    ])

    if (ordersRes.error) { setOnline(false); setLoading(false); return }
    setOnline(true)

    const tables: DbTable[]  = tablesRes.data  ?? []
    const dbOrders: DbOrder[] = ordersRes.data ?? []

    const mapped = dbOrders
      .map(o => mapDbOrder(o, tables))
      .filter(Boolean) as Order[]

    setOrders(prev => {
      // Keep locally-created orders (from NuevaComanda) — they have ids starting with 'ord-'
      const localOnly = prev.filter(o => o.id.startsWith('ord-'))
      return [...localOnly, ...mapped]
    })
    setLoading(false)
  }, [restId, supabase])

  useEffect(() => {
    loadData()
    const ch = supabase
      .channel('comandas-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, loadData)
      .subscribe(s => setOnline(s === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(ch) }
  }, [loadData, supabase])

  function pushToast(text: string, variant: ToastMsg['variant'] = 'break') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, text, variant }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  async function advance(id: string, next: OrderStatus) {
    const prevStatus = orders.find(o => o.id === id)?.status
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: next } : o))
    // Local mock orders (NuevaComanda without DB) have ids starting with 'ord-'
    if (id.startsWith('ord-')) return
    const dbStatus = uiToDb(next)
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: id, status: dbStatus }),
      })
      if (!res.ok) {
        // Revert optimistic update on server error
        if (prevStatus) setOrders(prev => prev.map(o => o.id === id ? { ...o, status: prevStatus } : o))
        pushToast('Error al actualizar la orden. Intenta nuevamente.', 'break')
      }
    } catch {
      if (prevStatus) setOrders(prev => prev.map(o => o.id === id ? { ...o, status: prevStatus } : o))
      pushToast('Sin conexión. No se pudo actualizar la orden.', 'break')
    }
  }

  async function markStationReady(orderId: string, dest: 'cocina' | 'barra') {
    // Optimistic — flip station_status to 'ready' for matching items locally
    setOrders(prev => prev.map(o => o.id !== orderId ? o : {
      ...o,
      items: o.items.map(it =>
        (it.destination ?? 'cocina') === dest ? { ...it, stationStatus: 'ready' as StationStatus } : it
      ),
    }))
    if (orderId.startsWith('ord-')) return // local mock
    try {
      const res = await fetch('/api/orders/station', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, destination: dest }),
      })
      if (!res.ok) {
        pushToast('No se pudo marcar listo. Intenta nuevamente.', 'break')
        loadData()
        return
      }
      const data = await res.json()
      pushToast(
        data.order_status === 'ready'
          ? `${DEST_META[dest].label} lista · pedido completo`
          : `${DEST_META[dest].label} lista · esperando otra estación`,
        'info'
      )
    } catch {
      pushToast('Sin conexión. No se pudo marcar listo.', 'break')
      loadData()
    }
  }

  function markBreak(orderId: string, itemIndex: number, itemName: string) {
    const key = `${orderId}:${itemIndex}`
    setBrokenItems(prev => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    pushToast(`${itemName} marcado como quiebre · Chapi dejará de ofrecerlo`, 'break')
  }

  function markLow(itemName: string, qty: number) {
    setStockMap(prev => ({ ...prev, [itemName]: { status: 'low', qty } }))
    pushToast(
      `${itemName} marcado con ${qty} unidades disponibles · Chapi dejará de recomendarlo activamente`,
      'stock'
    )
  }

  function handleNuevaComanda(order: Order) {
    setOrders(prev => [order, ...prev])
    setShowNueva(false)
    pushToast(`Comanda ${order.tableLabel} creada · En espera`, 'info' as ToastMsg['variant'])
  }

  const filtered = (() => {
    let list = orders
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.tableLabel.toLowerCase().includes(q) ||
        o.items.some(i => i.name.toLowerCase().includes(q))
      )
    }
    if (station !== 'todo') {
      // Hide orders that have no items destined to the chosen station
      list = list.filter(o => o.items.some(i => (i.destination ?? 'cocina') === station))
    }
    return list
  })()

  const ROLE_OPTIONS: { value: UserRole; label: string; emoji: string }[] = [
    { value: 'cocina', label: 'Cocina', emoji: '👨‍🍳' },
    { value: 'garzon', label: 'Garzón', emoji: '🍽' },
    { value: 'admin', label: 'Admin', emoji: '🔑' },
  ]

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-white text-xl font-bold">Comandas</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-white/35 text-sm">
              {loading ? 'Cargando…' : `${orders.filter(o => o.status !== 'entregada').length} activas · ${orders.filter(o => o.status === 'entregada').length} entregadas hoy`}
            </p>
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: online ? '#34D399' : '#F87171' }}>
              {online ? <Wifi size={10} /> : <WifiOff size={10} />}
              {online ? 'En vivo' : 'Sin conexión'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Station filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
            {STATION_FILTERS.map(opt => {
              const Icon   = opt.icon
              const active = station === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setStation(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all select-none
                              ${active ? 'bg-white/12 text-white shadow-sm' : 'text-white/35 hover:text-white/55'}`}
                  style={active ? { color: opt.color } : undefined}
                >
                  <Icon size={11} />
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Role selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRole(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                            transition-all select-none
                            ${role === opt.value
                              ? 'bg-white/12 text-white shadow-sm'
                              : 'text-white/35 hover:text-white/55'
                            }`}
              >
                <span>{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>

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
          <button
            onClick={() => setShowNueva(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35]
                       text-white text-sm font-semibold hover:bg-[#e85d2a] transition-colors">
            <Plus size={14} />
            Nueva comanda
          </button>
        </div>
      </div>

      {/* Stock alert banner — above the kanban, below the header */}
      <StockAlertBanner
        stockMap={stockMap}
        onGestionar={() => pushToast('Panel de gestión de stock — próximamente', 'stock')}
      />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <RefreshCw size={20} className="text-[#FF6B35] animate-spin" />
        </div>
      )}

      {/* Kanban board */}
      {!loading && <div className="flex-1 overflow-x-auto px-6 pb-6">
        <div className="flex gap-4 h-full" style={{ minWidth: '900px' }}>
          {COLUMNS.map(col => {
            const colOrders = filtered.filter(o => o.status === col.status)
            const dimmed = role === 'cocina' && !COCINA_HIGHLIGHT.includes(col.status)
            return (
              <div
                key={col.status}
                className={`flex-1 flex flex-col min-w-0 transition-opacity duration-200 ${dimmed ? 'opacity-30' : 'opacity-100'}`}
              >

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
                      <OrderCard
                        key={o.id}
                        order={o}
                        col={col}
                        role={role}
                        station={station}
                        brokenItems={brokenItems}
                        stockMap={stockMap}
                        onAdvance={advance}
                        onMarkStationReady={markStationReady}
                        onBreak={markBreak}
                        onMarkLow={markLow}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>}

      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-none">
          {toasts.map(t => (
            <Toast key={t.id} msg={t} />
          ))}
        </div>
      )}

      {/* Nueva comanda modal */}
      {showNueva && (
        <NuevaComandaModal
          onClose={() => setShowNueva(false)}
          onSave={handleNuevaComanda}
        />
      )}
    </div>
  )
}

export default function ComandasPage() {
  return (
    <Suspense fallback={null}>
      <ComandasPageInner />
    </Suspense>
  )
}
