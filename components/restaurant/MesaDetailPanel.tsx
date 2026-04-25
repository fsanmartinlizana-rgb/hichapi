'use client'

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Plus, Minus, Trash2, ChefHat, CheckCircle2, Banknote,
  Bell, AlertCircle, RefreshCw, ShoppingBag, Clock, Printer,
} from 'lucide-react'
import { formatCurrency } from '@/lib/i18n'
import type { MenuItemOption, OrderLine } from '@/components/nueva-comanda/types'
import { getDefaultDestination, filterByName, groupByCategory } from '@/components/nueva-comanda/utils'
import { StationStatusBadge, type StationStatus } from './StationStatusBadge'
import { ManualPrintControls } from '@/components/manual-print/ManualPrintControls'
import { DocumentHistoryPanel } from '@/components/manual-print/DocumentHistoryPanel'
import { useDocumentHistory } from '@/lib/manual-print/hooks'
import type { PrintRequestState } from '@/lib/manual-print/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'paying' | 'paid' | 'cancelled'

export interface ActiveOrderItem {
  id: string
  name: string
  quantity: number
  unit_price: number
  notes: string | null
  status: string
}

export interface ActiveOrder {
  id: string
  table_id: string
  status: OrderStatus
  total: number
  client_name: string | null
  notes: string | null
  created_at: string
  order_items: ActiveOrderItem[]
}

export interface MesaDetailPanelProps {
  tableId: string
  tableLabel: string
  order: ActiveOrder | null
  menuItems: MenuItemOption[]
  restaurantId: string
  onClose: () => void
  onAdvance: (orderId: string, next: OrderStatus) => void
  onCancel: (orderId: string) => void
  onRefresh: () => void
  advancing: boolean
  pax?: number
  onUpdatePax?: (pax: number) => void
  stationStatuses?: StationStatus[]
  /** Print state for manual precuenta control (Req 6.1) */
  printState?: PrintRequestState
  /** Callback to request precuenta printing (Req 1.1) */
  onPrintRequest?: (type: 'precuenta', printerName?: string) => Promise<void>
}

export type { StationStatus }

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OrderStatus, {
  label: string; color: string; bg: string
  icon: React.ReactNode; next: OrderStatus | null; nextLabel: string
}> = {
  pending:   { label: 'Nuevo pedido',  color: '#60A5FA', bg: 'bg-blue-500/15',    icon: <Bell size={13} />,         next: 'preparing', nextLabel: 'Enviar pedido' },
  confirmed: { label: 'Confirmado',    color: '#FBBF24', bg: 'bg-yellow-500/15',  icon: <CheckCircle2 size={13} />, next: 'preparing', nextLabel: 'Enviar pedido' },
  preparing: { label: 'Preparando',    color: '#FBBF24', bg: 'bg-yellow-500/15',  icon: <ChefHat size={13} />,      next: 'ready',     nextLabel: 'Marcar listo'    },
  ready:     { label: '¡Listo!',       color: '#34D399', bg: 'bg-emerald-500/15', icon: <CheckCircle2 size={13} />, next: 'delivered', nextLabel: 'Entregar'        },
  delivered: { label: 'Entregado',     color: '#34D399', bg: 'bg-emerald-500/15', icon: <CheckCircle2 size={13} />, next: 'paying',    nextLabel: 'Cobrar'          },
  paying:    { label: 'Cobrando',      color: '#FBBF24', bg: 'bg-yellow-500/15',  icon: <Banknote size={13} />,     next: 'paid',      nextLabel: 'Pagado ✓'        },
  paid:      { label: 'Pagado',        color: '#6B7280', bg: 'bg-white/8',        icon: <CheckCircle2 size={13} />, next: null,        nextLabel: ''                },
  cancelled: { label: 'Cancelado',     color: '#6B7280', bg: 'bg-white/8',        icon: <AlertCircle size={13} />,  next: null,        nextLabel: ''                },
}

const STATUS_FALLBACK = {
  label: 'Desconocido', color: '#6B7280', bg: 'bg-white/8',
  icon: <AlertCircle size={13} />, next: null as OrderStatus | null, nextLabel: '',
}

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status as OrderStatus] ?? STATUS_FALLBACK
}

function elapsedMin(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

// ── EditableItem ──────────────────────────────────────────────────────────────

function EditableItem({
  item, onChangeQty, onDelete, busy,
}: {
  item: ActiveOrderItem
  onChangeQty: (newQty: number) => void
  onDelete: () => void
  busy: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => item.quantity <= 1 ? onDelete() : onChangeQty(item.quantity - 1)}
          disabled={busy}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/6 text-white/70 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300 disabled:opacity-30 transition-colors"
        >
          <Minus size={12} />
        </button>
        <span className="w-6 text-center text-sm font-semibold text-white">{item.quantity}</span>
        <button
          onClick={() => onChangeQty(item.quantity + 1)}
          disabled={busy}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/6 text-white/70 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-30 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 truncate">{item.name}</p>
        {item.notes && <p className="text-xs text-amber-400/60 italic truncate mt-0.5">{item.notes}</p>}
      </div>
      <span className="text-sm font-semibold text-white/60 flex-shrink-0 tabular-nums">
        {formatCurrency(item.unit_price * item.quantity)}
      </span>
      <button
        onClick={onDelete}
        disabled={busy}
        className="flex-shrink-0 p-1 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── AddProductsModal — rendered via portal to escape stacking context ─────────

function AddProductsModal({
  menuItems,
  pendingLines,
  savingAdd,
  addError,
  onAdd,
  onRemovePending,
  onConfirm,
  onClose,
}: {
  menuItems: MenuItemOption[]
  pendingLines: OrderLine[]
  savingAdd: boolean
  addError: string | null
  onAdd: (item: MenuItemOption) => void
  onRemovePending: (id: string) => void
  onConfirm: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered   = filterByName(menuItems, query)
  const grouped    = groupByCategory(filtered)
  const categories = Object.keys(grouped)
  const pendingTotal = pendingLines.reduce((s, l) => s + l.unitPrice * l.qty, 0)
  const pendingCount = pendingLines.reduce((s, l) => s + l.qty, 0)

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg flex flex-col rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: '#161622', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-sm font-semibold text-white">Agregar productos</p>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar producto…"
              autoFocus
              className="w-full rounded-xl border py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/40 transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)' }}
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">×</button>
            )}
          </div>
        </div>

        {/* Product grid — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/35">Sin resultados para &ldquo;{query}&rdquo;</p>
          ) : (
            categories.map(cat => (
              <section key={cat} className="mb-5">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">{cat}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {grouped[cat].map(item => {
                    const inCart = pendingLines.find(l => l.menuItemId === item.id)
                    return (
                      <button
                        key={item.id}
                        onClick={() => onAdd(item)}
                        className="relative flex flex-col items-start rounded-xl border p-3 text-left transition-all hover:border-[#FF6B35]/40 hover:bg-[#FF6B35]/8 active:scale-95"
                        style={{ background: 'rgba(255,255,255,0.04)', borderColor: inCart ? 'rgba(255,107,53,0.4)' : 'rgba(255,255,255,0.08)' }}
                      >
                        {inCart && (
                          <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6B35] text-[10px] font-bold text-white shadow">
                            {inCart.qty}
                          </span>
                        )}
                        <span className="text-sm font-medium text-white/90 leading-snug">{item.name}</span>
                        <span className="mt-1 text-xs font-semibold text-[#FF6B35]">{formatCurrency(item.price)}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {/* Footer — pending + confirm */}
        {pendingLines.length > 0 && (
          <div className="border-t px-4 py-3 flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/50">{pendingCount} ítem{pendingCount !== 1 ? 's' : ''} por agregar</p>
              <p className="text-sm font-bold text-white tabular-nums">{formatCurrency(pendingTotal)}</p>
            </div>
            <div className="space-y-1 mb-3 max-h-20 overflow-y-auto">
              {pendingLines.map(l => (
                <div key={l.menuItemId} className="flex items-center justify-between text-xs">
                  <span className="text-white/70">{l.qty}× {l.name}</span>
                  <button onClick={() => onRemovePending(l.menuItemId)} className="text-white/25 hover:text-red-400 transition-colors ml-2">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            {addError && <p className="text-xs text-red-400 mb-2">{addError}</p>}
            <button
              onClick={onConfirm}
              disabled={savingAdd}
              className="w-full rounded-xl bg-[#FF6B35] py-2.5 text-sm font-semibold text-white hover:bg-[#ff8255] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {savingAdd ? <><RefreshCw size={14} className="animate-spin" /> Guardando…</> : 'Confirmar y agregar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // Portal: render outside any stacking context
  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}

// ── MesaDetailPanel ───────────────────────────────────────────────────────────

export function MesaDetailPanel({
  tableId,
  tableLabel,
  order,
  menuItems,
  restaurantId,
  onClose,
  onAdvance,
  onCancel,
  onRefresh,
  advancing,
  pax,
  onUpdatePax,
  stationStatuses,
  printState,
  onPrintRequest,
}: MesaDetailPanelProps) {
  const [busyItemId, setBusyItemId]   = useState<string | null>(null)
  const [showAddProducts, setShowAddProducts] = useState(false)
  const [pendingLines, setPendingLines]       = useState<OrderLine[]>([])
  const [savingAdd, setSavingAdd]             = useState(false)
  const [addError, setAddError]               = useState<string | null>(null)

  // Document history for the current order (Req 6.3)
  const {
    history: documentHistory,
    loading: historyLoading,
    refreshHistory,
  } = useDocumentHistory(order?.id ?? '')

  // ── Item qty / delete ─────────────────────────────────────────────────────

  const handleChangeQty = useCallback(async (itemId: string, newQty: number) => {
    setBusyItemId(itemId)
    try {
      await fetch('/api/orders/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, order_item_id: itemId, quantity: newQty }),
      })
      onRefresh()
    } finally {
      setBusyItemId(null)
    }
  }, [restaurantId, onRefresh])

  const handleDeleteItem = useCallback(async (itemId: string) => {
    setBusyItemId(itemId)
    try {
      await fetch('/api/orders/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, order_item_id: itemId, quantity: 0 }),
      })
      onRefresh()
    } finally {
      setBusyItemId(null)
    }
  }, [restaurantId, onRefresh])

  // ── Add products ──────────────────────────────────────────────────────────

  function handleAddMenuItem(item: MenuItemOption) {
    setPendingLines(prev => {
      const existing = prev.find(l => l.menuItemId === item.id)
      if (existing) return prev.map(l => l.menuItemId === item.id ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { menuItemId: item.id, name: item.name, unitPrice: item.price, qty: 1, note: '', destination: getDefaultDestination(item) }]
    })
  }

  function handleRemovePending(menuItemId: string) {
    setPendingLines(prev => prev.filter(l => l.menuItemId !== menuItemId))
  }

  function handleCloseModal() {
    setShowAddProducts(false)
    setPendingLines([])
    setAddError(null)
  }

  async function handleConfirmAdd() {
    if (pendingLines.length === 0 || !order) return
    setSavingAdd(true)
    setAddError(null)
    try {
      const res = await fetch('/api/orders/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          table_id: tableId,
          cart: pendingLines.map(l => ({
            menu_item_id: l.menuItemId,
            name:         l.name,
            quantity:     l.qty,
            unit_price:   l.unitPrice,
            note:         l.note || null,
            destination:  l.destination,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error ?? 'No se pudo agregar los productos'); return }
      handleCloseModal()
      onRefresh()
    } catch {
      setAddError('Sin conexión. Intenta de nuevo.')
    } finally {
      setSavingAdd(false)
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!order) {
    return (
      <div className="bg-[#161622] border border-white/8 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 min-h-40">
        <ShoppingBag size={28} className="text-white/15" />
        <p className="text-white/30 text-sm">Sin comanda activa en {tableLabel}</p>
        <button onClick={onClose} className="text-[#FF6B35]/60 text-xs hover:text-[#FF6B35] transition-colors">Cerrar</button>
      </div>
    )
  }

  const cfg     = getStatusCfg(order.status)
  const elapsed = elapsedMin(order.created_at)
  const canEdit = !['paid', 'cancelled'].includes(order.status)

  return (
    <>
      <div className="bg-[#161622] border border-white/8 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: cfg.color + '20', color: cfg.color }}>
              {cfg.icon}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{tableLabel}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock size={9} className="text-white/25" />
                <p className="text-white/35 text-xs">
                  #{order.id.slice(-4).toUpperCase()}
                  {pax != null ? ` · ${pax} comensal${pax !== 1 ? 'es' : ''}` : ''}
                  {' · '}{elapsed} min
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg}`} style={{ color: cfg.color }}>
              {cfg.label}
            </span>
            <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors ml-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* "Cuenta solicitada" banner — shown when order is in paying state (Req 2.2, 6.1) */}
        {order.status === 'paying' && (
          <div
            className="flex items-center gap-3 px-4 py-2.5 border-b"
            style={{ borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.08)' }}
          >
            <Banknote size={15} className="text-[#FBBF24] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[#FBBF24] text-xs font-semibold">Cuenta solicitada</p>
              {printState?.precuentaRequested ? (
                <p className="text-emerald-400/70 text-[10px] flex items-center gap-1 mt-0.5">
                  <Printer size={9} className="shrink-0" />
                  Precuenta impresa
                  {printState.precuentaTimestamp && (
                    <span className="text-white/30">
                      · {printState.precuentaTimestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-amber-300/50 text-[10px] mt-0.5">Precuenta pendiente de imprimir</p>
              )}
            </div>
          </div>
        )}

        {/* Pax inline edit */}
        {onUpdatePax && pax != null && (
          <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-xs text-white/40 flex-1">Comensales</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdatePax(Math.max(1, pax - 1))}
                disabled={pax <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/6 text-white/70 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300 disabled:opacity-30 transition-colors"
              >
                <Minus size={12} />
              </button>
              <span className="w-6 text-center text-sm font-semibold text-white tabular-nums">{pax}</span>
              <button
                onClick={() => onUpdatePax(pax + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/6 text-white/70 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-30 transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Station statuses */}
        {stationStatuses && stationStatuses.length > 0 && (
          <div className="px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <StationStatusBadge statuses={stationStatuses} />
          </div>
        )}

        {/* Items */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">
            Productos · {order.order_items.length} ítem{order.order_items.length !== 1 ? 's' : ''}
          </p>
          {order.order_items.length === 0 ? (
            <p className="text-sm text-white/25 py-4 text-center">Sin productos</p>
          ) : order.order_items.map(item =>
            canEdit ? (
              <EditableItem
                key={item.id}
                item={item}
                onChangeQty={qty => handleChangeQty(item.id, qty)}
                onDelete={() => handleDeleteItem(item.id)}
                busy={busyItemId === item.id}
              />
            ) : (
              <div key={item.id} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="text-[#FF6B35] font-semibold text-sm w-6 text-center">{item.quantity}×</span>
                <span className="flex-1 text-sm text-white/80">{item.name}</span>
                <span className="text-sm text-white/50 tabular-nums">{formatCurrency(item.unit_price * item.quantity)}</span>
              </div>
            )
          )}
        </div>

        {/* Add products button */}
        {canEdit && (
          <div className="px-4 py-2">
            <button
              onClick={() => setShowAddProducts(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed text-sm font-medium text-white/40 hover:text-white/70 hover:border-white/30 hover:bg-white/4 transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.15)' }}
            >
              <Plus size={14} /> Agregar productos
            </button>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="px-4 pb-2">
            <p className="text-white/30 text-xs italic">📝 {order.notes}</p>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <span className="text-white/40 text-sm">Total</span>
          <span className="text-white font-bold text-lg tabular-nums" style={{ fontFamily: 'var(--font-dm-mono)' }}>
            {formatCurrency(order.total)}
          </span>
        </div>

        {/* Manual print controls — precuenta (Req 1.1, 6.1) */}
        {printState && onPrintRequest && (
          <ManualPrintControls
            tableId={tableId}
            order={{
              id: order.id,
              table_id: order.table_id,
              status: order.status,
              total: order.total,
              pax: pax ?? null,
              client_name: order.client_name,
              notes: order.notes,
              created_at: order.created_at,
              updated_at: order.created_at,
              order_items: order.order_items.map(i => ({
                id: i.id,
                name: i.name,
                quantity: i.quantity,
                unit_price: i.unit_price,
                notes: i.notes,
                status: i.status,
                destination: null,
              })),
            }}
            restaurantId={restaurantId}
            onPrintRequest={onPrintRequest}
            printState={printState}
          />
        )}

        {/* Document history panel — shows all requested documents with status (Req 6.2, 6.3) */}
        <DocumentHistoryPanel
          history={documentHistory}
          loading={historyLoading}
          onRefresh={refreshHistory}
        />

        {/* Action buttons */}
        {cfg.next && (
          <div className="px-4 pb-4 space-y-2">
            <button
              onClick={() => onAdvance(order.id, cfg.next!)}
              disabled={advancing}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: cfg.color }}
            >
              {advancing ? <><RefreshCw size={14} className="animate-spin" /> Actualizando…</> : cfg.nextLabel}
            </button>
            <button
              onClick={() => onCancel(order.id)}
              disabled={advancing}
              className="w-full py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/15 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={12} /> Cancelar comanda
            </button>
          </div>
        )}
      </div>

      {/* Modal via portal — escapes overflow/stacking context */}
      {showAddProducts && (
        <AddProductsModal
          menuItems={menuItems}
          pendingLines={pendingLines}
          savingAdd={savingAdd}
          addError={addError}
          onAdd={handleAddMenuItem}
          onRemovePending={handleRemovePending}
          onConfirm={handleConfirmAdd}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}
