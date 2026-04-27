'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { createClient } from '@/lib/supabase/client'
import {
  Clock, CheckCircle2, ChefHat, Banknote, Bell,
  RefreshCw, Wifi, WifiOff, AlertCircle, Ticket, Plus,
} from 'lucide-react'
import { CancelOrderModal } from '@/components/CancelOrderModal'
import { CouponRedeemModal } from '@/components/restaurant/CouponRedeemModal'
import { PaymentMethodModal, type DteSelection } from '@/components/PaymentMethodModal'
import { BillSplitModal } from '@/components/bills/BillSplitModal'
import { useRestaurant } from '@/lib/restaurant-context'
import { formatCurrency } from '@/lib/i18n'
import { MesasFloorplan } from '@/components/restaurant/MesasFloorplan'
import { MesaDetailPanel } from '@/components/restaurant/MesaDetailPanel'
import type { StationStatus } from '@/components/restaurant/MesaDetailPanel'
import type { MenuItemOption, OrderLine } from '@/components/nueva-comanda/types'
import StepPax from '@/components/nueva-comanda/StepPax'
import StepCatalogoVisual from '@/components/nueva-comanda/StepCatalogoVisual'
import StepConfirmacion from '@/components/nueva-comanda/StepConfirmacion'
import { getDefaultDestination } from '@/components/nueva-comanda/utils'
import { usePrecuentaRequest } from '@/lib/manual-print/hooks'
import { TicketPrinterModal, type TicketGroup } from '@/components/manual-print/TicketPrinterModal'
import { prepareAndSendTickets, sendSelectedTickets } from '@/lib/manual-print/send-station-tickets'

// ── Types ─────────────────────────────────────────────────────────────────────

type TableStatus = 'libre' | 'ocupada' | 'reservada' | 'bloqueada'
type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'paying' | 'paid' | 'cancelled'

interface Table {
  id: string
  label: string
  seats: number
  status: TableStatus
  zone: string | null
  posX?: number | null
  posY?: number | null
}

interface OrderItem {
  id: string
  name: string
  quantity: number
  unit_price: number
  notes: string | null
  status: string
  destination: string | null
}

interface Order {
  id: string
  table_id: string
  status: OrderStatus
  total: number
  pax: number | null
  client_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
  order_items: OrderItem[]
}

type GarzonUIMode =
  | { type: 'map' }
  | { type: 'new-pax'; table: Table }
  | { type: 'new-catalog'; table: Table; pax: number }
  | { type: 'new-confirm'; table: Table; pax: number; lines: OrderLine[] }
  | { type: 'open'; table: Table }

// ── Constants ─────────────────────────────────────────────────────────────────

const TABLE_STATUS_STYLES: Record<TableStatus, { bg: string; border: string; text: string; dot: string }> = {
  libre:     { bg: 'bg-white/3',         border: 'border-white/8',        text: 'text-white/30',  dot: 'bg-white/20'    },
  ocupada:   { bg: 'bg-[#FF6B35]/10',    border: 'border-[#FF6B35]/30',   text: 'text-[#FF6B35]', dot: 'bg-[#FF6B35]'  },
  reservada: { bg: 'bg-violet-500/10',   border: 'border-violet-500/30',  text: 'text-violet-400', dot: 'bg-violet-400' },
  bloqueada: { bg: 'bg-white/5',         border: 'border-white/10',       text: 'text-white/20',  dot: 'bg-white/15'    },
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ReactNode; next: OrderStatus | null; nextLabel: string }> = {
  pending:   { label: 'Nuevo pedido',  color: '#60A5FA', bg: 'bg-blue-500/15',    icon: <Bell size={13} />,        next: 'preparing', nextLabel: 'Enviar pedido' },
  confirmed: { label: 'Confirmado',    color: '#FBBF24', bg: 'bg-yellow-500/15',  icon: <CheckCircle2 size={13} />, next: 'preparing', nextLabel: 'Enviar pedido' },
  preparing: { label: 'Preparando',    color: '#FBBF24', bg: 'bg-yellow-500/15',  icon: <ChefHat size={13} />,     next: 'ready',     nextLabel: 'Marcar listo'    },
  ready:     { label: '¡Listo!',       color: '#34D399', bg: 'bg-emerald-500/15', icon: <CheckCircle2 size={13} />, next: 'delivered', nextLabel: 'Entregar'        },
  delivered: { label: 'Entregado',     color: '#34D399', bg: 'bg-emerald-500/15', icon: <CheckCircle2 size={13} />, next: 'paying',    nextLabel: 'Cobrar'          },
  paying:    { label: 'Cobrando',      color: '#FBBF24', bg: 'bg-yellow-500/15',  icon: <Banknote size={13} />,    next: 'paid',      nextLabel: 'Pagado ✓'        },
  paid:      { label: 'Pagado',        color: '#6B7280', bg: 'bg-white/8',        icon: <CheckCircle2 size={13} />, next: null,       nextLabel: ''                },
  cancelled: { label: 'Cancelado',     color: '#6B7280', bg: 'bg-white/8',        icon: <AlertCircle size={13} />, next: null,        nextLabel: ''                },
}

// Defensive fallback for any unrecognized status (nunca debería dispararse, pero evita crash).
const ORDER_STATUS_FALLBACK = {
  label: 'Desconocido', color: '#6B7280', bg: 'bg-white/8',
  icon: <AlertCircle size={13} />, next: null as OrderStatus | null, nextLabel: '',
}

function getOrderStatusCfg(status: string) {
  return ORDER_STATUS_CONFIG[status as OrderStatus] ?? ORDER_STATUS_FALLBACK
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const clp = (amount: number) => formatCurrency(amount)

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
        {table.label.replace(/^Mesa\s+/i, '')}
      </p>
      <span className={`text-[9px] font-medium ${s.text}`}>
        {table.status}
      </span>

      {order && (() => {
        const oc = getOrderStatusCfg(order.status)
        return (
          <span
            className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: oc.color + '25', color: oc.color }}
          >
            {oc.label}
          </span>
        )
      })()}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GarzonPage() {
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [tables, setTables]       = useState<Table[]>([])
  const [orders, setOrders]       = useState<Order[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([])
  const [mode, setMode]           = useState<GarzonUIMode>({ type: 'map' })
  const [loading, setLoading]     = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [online, setOnline]       = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [payingOrder, setPayingOrder] = useState<{ id: string; total: number } | null>(null)
  const [billSplitTable, setBillSplitTable] = useState<{ tableId: string; tableLabel: string; orders: Order[]; totalAmount: number; pax: number } | null>(null)
  const [cancellingOrder, setCancellingOrder] = useState<{ id: string; tableLabel?: string } | null>(null)
  const [showCoupon, setShowCoupon] = useState(false)

  // Responsive: layout cambia en mobile (<md). Cards más chicas y menos
  // columnas para que entren bien en celular en uso bajo presión.
  const isMobile = useIsMobile()

  // ── New order flow state ──────────────────────────────────────────────────
  const [newPax, setNewPax]           = useState(1)
  const [catalogLines, setCatalogLines] = useState<OrderLine[]>([])
  const [confirmSaving, setConfirmSaving] = useState(false)
  const [confirmError, setConfirmError]   = useState<string | null>(null)

  // ── Ticket printer selection modal ────────────────────────────────────────
  const [ticketGroups,    setTicketGroups]    = useState<TicketGroup[]>([])
  const [ticketCtx,       setTicketCtx]       = useState<{ restaurantId: string; tableLabel: string; orderId: string } | null>(null)
  const [showTicketModal, setShowTicketModal] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  // ── Load all data ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!restId) return
    const [tablesRes, ordersRes, menuRes] = await Promise.all([
      // select('*') tolera bases sin pos_x/pos_y aún migradas
      supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restId)
        .order('label'),
      supabase
        .from('orders')
        .select('id, table_id, status, total, pax, client_name, notes, created_at, updated_at, order_items(id, name, quantity, unit_price, notes, status, destination)')
        .eq('restaurant_id', restId)
        .not('status', 'in', '("paid","cancelled")')
        .order('created_at', { ascending: false }),
      supabase
        .from('menu_items')
        .select('id, name, price, destination, category')
        .eq('restaurant_id', restId)
        .eq('available', true)
        .order('category')
        .order('name'),
    ])

    if (tablesRes.error) {
      console.error('[garzon] tables query error:', tablesRes.error)
    } else if (tablesRes.data) {
      const mapped: Table[] = (tablesRes.data as Array<{ id: string; label: string; seats: number; status: string; zone: string | null; pos_x?: number | null; pos_y?: number | null }>).map(t => ({
        id: t.id,
        label: t.label,
        seats: t.seats,
        status: (t.status as TableStatus) ?? 'libre',
        zone: t.zone ?? null,
        posX: t.pos_x ?? null,
        posY: t.pos_y ?? null,
      }))
      setTables(mapped)
    }
    if (ordersRes.error) {
      // Log estructurado para diagnostico en DevTools. Antes se tragaba el
      // error silenciosamente y el panel quedaba vacio sin explicacion.
      console.error('[garzon] orders query error:', {
        code:    ordersRes.error.code,
        message: ordersRes.error.message,
        details: ordersRes.error.details,
        hint:    ordersRes.error.hint,
      })
    } else if (ordersRes.data) {
      setOrders(ordersRes.data as Order[])
    }
    if (menuRes.data) {
      type RawMenuItem = { id: string; name: string; price: number; destination: string | null; category: string | null }
      const mapped: MenuItemOption[] = (menuRes.data as RawMenuItem[]).map(m => ({
        id:          m.id,
        name:        m.name,
        price:       m.price,
        // Capitalize first letter for display; fallback to 'Sin categoría'
        category:    m.category
          ? m.category.charAt(0).toUpperCase() + m.category.slice(1)
          : 'Sin categoría',
        destination: m.destination ?? undefined,
      }))
      setMenuItems(mapped)
    }
    setLastRefresh(new Date())
    setLoading(false)
    setOnline(true)
  }, [restId, supabase])

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel('garzon-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        loadData()
      })
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

    // If advancing to 'paying' (from delivered), show bill split modal for the entire table
    if (nextStatus === 'paying') {
      const order = orders.find(o => o.id === orderId)
      if (order) {
        const table = tables.find(t => t.id === order.table_id)
        if (table) {
          // Get all orders for this table that are delivered or paying
          const tableOrders = orders.filter(o => 
            o.table_id === order.table_id && 
            (o.status === 'delivered' || o.status === 'paying')
          )
          const totalAmount = tableOrders.reduce((sum, o) => sum + o.total, 0)
          const maxPax = tableOrders.reduce((max, o) => Math.max(max, o.pax || 0), 0)

          setBillSplitTable({
            tableId: table.id,
            tableLabel: table.label,
            orders: tableOrders,
            totalAmount,
            pax: maxPax || 2
          })
          return
        }
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
    dte: DteSelection,
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

      // Emit DTE after payment — fire and forget
      if (restaurant?.id) {
        const emitBody: Record<string, unknown> = {
          restaurant_id:      restaurant.id,
          order_id:           payingOrder.id,
          document_type:      dte.document_type,
          rut_receptor:       dte.rut_receptor,
          razon_receptor:     dte.razon_receptor,
          giro_receptor:      dte.giro_receptor,
          direccion_receptor: dte.direccion_receptor,
          comuna_receptor:    dte.comuna_receptor,
          fma_pago:           dte.fma_pago,
          email_receptor:     dte.email_receptor,
        }

        fetch('/api/dte/emit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emitBody),
        }).catch(err => console.error('DTE emit error (non-blocking):', err))

        // Guardar receptor en directorio para autocompletado futuro
        if (dte.document_type === 33 && dte.rut_receptor && dte.razon_receptor) {
          fetch('/api/dte/receptores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurant_id: restaurant.id,
              rut:           dte.rut_receptor,
              razon_social:  dte.razon_receptor,
              giro:          dte.giro_receptor,
              direccion:     dte.direccion_receptor,
              comuna:        dte.comuna_receptor,
              email:         dte.email_receptor,
            }),
          }).catch(() => { /* non-critical */ })
        }
      }

      // Mark table as libre
      const order = orders.find(o => o.id === payingOrder.id)
      if (order) {
        await supabase
          .from('tables')
          .update({ status: 'libre' })
          .eq('id', order.table_id)
      }

      setPayingOrder(null)
      setMode({ type: 'map' })
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

  const selectedTable = 'table' in mode ? mode.table : null
  const selectedOrder = 'table' in mode ? orders.find(o => o.table_id === mode.table.id) ?? null : null

  // ── Manual print controls (precuenta) ────────────────────────────────────
  // Build an OrderWithPrintState-compatible object from the selected order
  const selectedOrderForPrint = selectedOrder ? {
    id: selectedOrder.id,
    table_id: selectedOrder.table_id,
    status: selectedOrder.status,
    total: selectedOrder.total,
    pax: selectedOrder.pax,
    client_name: selectedOrder.client_name,
    notes: selectedOrder.notes,
    created_at: selectedOrder.created_at,
    updated_at: selectedOrder.updated_at,
    order_items: selectedOrder.order_items.map(i => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      notes: i.notes,
      status: i.status,
      destination: i.destination,
    })),
  } : null

  const { printState, requestPrecuenta } = usePrecuentaRequest(
    restId ?? '',
    selectedTable?.id ?? '',
    selectedOrderForPrint
  )

  // ── Navigation handlers ───────────────────────────────────────────────────

  function handleTableClick(table: Table) {
    if (table.status === 'libre') {
      setNewPax(1)
      setMode({ type: 'new-pax', table })
    } else if (table.status === 'ocupada') {
      setMode({ type: 'open', table })
    }
    // reservada/bloqueada → no effect
  }

  function handlePaxConfirm(pax: number) {
    if (mode.type !== 'new-pax') return
    setMode({ type: 'new-catalog', table: mode.table, pax })
  }

  function handleCatalogContinue(lines: OrderLine[]) {
    if (mode.type !== 'new-catalog') return
    setMode({ type: 'new-confirm', table: mode.table, pax: mode.pax, lines })
  }

  function handleBack() {
    if (mode.type === 'new-catalog') {
      setMode({ type: 'new-pax', table: mode.table })
    } else if (mode.type === 'new-confirm') {
      setMode({ type: 'new-catalog', table: mode.table, pax: mode.pax })
    } else {
      setMode({ type: 'map' })
    }
  }

  function handleOrderConfirmed() {
    if ('table' in mode) {
      setMode({ type: 'open', table: mode.table })
    }
  }

  function handleClosePanel() {
    setMode({ type: 'map' })
  }

  // ── Catalog handlers ──────────────────────────────────────────────────────

  function handleAddItem(item: MenuItemOption) {
    setCatalogLines(prev => {
      const existing = prev.find(l => l.menuItemId === item.id)
      if (existing) return prev.map(l => l.menuItemId === item.id ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { menuItemId: item.id, name: item.name, unitPrice: item.price, qty: 1, note: '', destination: getDefaultDestination(item) }]
    })
  }

  function handleUpdateLine(menuItemId: string, patch: Partial<OrderLine>) {
    setCatalogLines(prev => prev.map(l => l.menuItemId === menuItemId ? { ...l, ...patch } : l))
  }

  function handleRemoveLine(menuItemId: string) {
    setCatalogLines(prev => prev.filter(l => l.menuItemId !== menuItemId))
  }

  // ── Confirm order handler ─────────────────────────────────────────────────

  async function handleConfirmOrder() {
    if (mode.type !== 'new-confirm') return
    setConfirmSaving(true)
    setConfirmError(null)
    try {
      const res = await fetch('/api/orders/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restId,
          table_id: mode.table.id,
          pax: mode.pax,
          cart: mode.lines.map(l => ({
            menu_item_id: l.menuItemId,
            name: l.name,
            quantity: l.qty,
            unit_price: l.unitPrice,
            note: l.note || null,
            destination: l.destination,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setConfirmError(data.error ?? 'No se pudo crear la comanda')
        return
      }
      setCatalogLines([])
      setNewPax(1)
      handleOrderConfirmed()
      await loadData()

      // ── Enviar tickets al notifier ──────────────────────────────────────
      // Fire-and-forget: no bloqueamos el flujo si falla
      if (restId && data.orderId) {
        void (async () => {
          try {
            // Load printers for this restaurant
            const printersRes = await fetch(`/api/printers?restaurant_id=${restId}`)
            const printersData = await printersRes.json()
            const printers = (printersData.printers ?? []).filter((p: any) => p.active)

            if (printers.length === 0) return  // No printers configured

            const ctx = {
              restaurantId: restId,
              tableLabel:   mode.table.label,
              orderId:      data.orderId,
            }

            const items = mode.lines.map(l => ({
              name:        l.name,
              quantity:    l.qty,
              notes:       l.note || null,
              destination: l.destination,
            }))

            const groupsNeedingSelection = await prepareAndSendTickets(items, ctx, printers)

            if (groupsNeedingSelection.length > 0) {
              // Show modal for groups with multiple printers
              setTicketGroups(groupsNeedingSelection)
              setTicketCtx(ctx)
              setShowTicketModal(true)
            }
          } catch (err) {
            console.error('[garzon] ticket dispatch error:', err)
          }
        })()
      }
    } catch {
      setConfirmError('Sin conexión. Intenta de nuevo.')
    } finally {
      setConfirmSaving(false)
    }
  }

  // ── Station statuses ──────────────────────────────────────────────────────

  function computeStationStatuses(items: Array<{ destination: string | null; status: string }>): StationStatus[] {
    const destinations = [...new Set(
      items
        .filter(i => i.destination && i.destination !== 'ninguno')
        .map(i => i.destination as string)
    )]
    return destinations.map(dest => {
      const destItems = items.filter(i => i.destination === dest)
      const allReady = destItems.every(i => i.status === 'ready')
      return {
        destination: dest as 'cocina' | 'barra' | 'ninguno',
        label: dest.charAt(0).toUpperCase() + dest.slice(1),
        ready: allReady,
      }
    })
  }

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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Nueva comanda — el más usado, más prominente */}
          <Link
            href="/comandas?nueva=1"
            className="flex items-center gap-1.5 px-3 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] transition-colors shadow-sm"
            style={{ minHeight: 44 }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Nueva comanda</span>
            <span className="sm:hidden">Comanda</span>
          </Link>
          <button
            onClick={() => setShowCoupon(true)}
            className="flex items-center gap-1.5 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
            style={{ minHeight: 44 }}
            title="Canjear cupón de fidelidad"
          >
            <Ticket size={13} className="text-[#FF6B35]" /> Cupón
          </button>
          <button
            onClick={loadData}
            className="rounded-xl bg-white/5 border border-white/8 text-white/40 hover:bg-white/8 hover:text-white transition-colors flex items-center justify-center"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Nuevos',     count: pendingCount,   color: '#60A5FA' },
          { label: 'Preparando',  count: preparingCount, color: '#FBBF24' },
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
          <MesasFloorplan
            mesas={tables}
            editing={false}
            cardSize={isMobile ? { w: 96, h: 88 } : { w: 110, h: 96 }}
            defaultColumns={isMobile ? 2 : 4}
            onPositionsChange={() => { /* garzón is read-only — layout is managed in /mesas */ }}
            renderCard={(t) => (
              <TableCell
                table={t}
                order={orders.find(o => o.table_id === t.id) ?? null}
                selected={mode.type !== 'map' && 'table' in mode && mode.table.id === t.id}
                onClick={() => handleTableClick(t)}
              />
            )}
          />
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

      {/* New order flow — StepPax */}
      {mode.type === 'new-pax' && (
        <div className="bg-[#161622] border border-white/5 rounded-2xl p-4">
          <StepPax
            table={mode.table}
            pax={newPax}
            onChangePax={setNewPax}
            onConfirm={() => handlePaxConfirm(newPax)}
            onBack={handleClosePanel}
          />
        </div>
      )}

      {/* New order flow — StepCatalogoVisual */}
      {mode.type === 'new-catalog' && (
        <StepCatalogoVisual
          menuItems={menuItems}
          lines={catalogLines}
          onAddItem={handleAddItem}
          onUpdateLine={handleUpdateLine}
          onRemoveLine={handleRemoveLine}
          onContinue={() => handleCatalogContinue(catalogLines)}
          onBack={handleBack}
        />
      )}

      {/* New order flow — StepConfirmacion */}
      {mode.type === 'new-confirm' && (
        <StepConfirmacion
          selectedTable={{
            id: mode.table.id,
            label: mode.table.label,
            status: mode.table.status,
            zone: mode.table.zone ?? undefined,
            seats: mode.table.seats ?? undefined
          }}
          pax={mode.pax}
          lines={mode.lines}
          saving={confirmSaving}
          error={confirmError}
          onConfirm={handleConfirmOrder}
          onBack={handleBack}
        />
      )}

      {/* Selected table order panel */}
      {mode.type === 'open' && selectedTable && (
        <MesaDetailPanel
          key={selectedTable.id}
          tableId={selectedTable.id}
          tableLabel={selectedTable.label}
          order={selectedOrder}
          menuItems={menuItems}
          restaurantId={restId ?? ''}
          onClose={handleClosePanel}
          onAdvance={advanceOrder}
          onCancel={(orderId) => setCancellingOrder({ id: orderId, tableLabel: selectedTable.label })}
          onRefresh={loadData}
          advancing={advancing}
          pax={selectedOrder?.pax ?? undefined}
          onUpdatePax={async (newPaxVal) => { await supabase.from('orders').update({ pax: newPaxVal }).eq('id', selectedOrder!.id); await loadData() }}
          stationStatuses={selectedOrder ? computeStationStatuses(selectedOrder.order_items) : []}
          printState={printState}
          onPrintRequest={(_type, printerName) => requestPrecuenta(printerName)}
        />
      )}

      {/* Active orders list (when no table selected) — grouped by table */}
      {mode.type === 'map' && orders.length > 0 && (() => {
        // Agrupar órdenes por table_id
        const groupOrder: string[] = []
        const groups: Record<string, Order[]> = {}
        for (const o of orders) {
          if (!groups[o.table_id]) {
            groups[o.table_id] = []
            groupOrder.push(o.table_id)
          }
          groups[o.table_id].push(o)
        }

        return (
          <div className="space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-widest font-semibold px-0.5">
              Pedidos activos ({orders.length})
            </p>

            {groupOrder.map(tableId => {
              const group = groups[tableId]
              const table = tables.find(t => t.id === tableId)
              const totalAmount = group.reduce((s, o) => s + o.total, 0)
              const totalItems  = group.reduce((s, o) => s + o.order_items.length, 0)
              const allDelivered = group.every(o => o.status === 'delivered' || o.status === 'paying')

              // Status más relevante del grupo para el ícono
              const dominantOrder = group.find(o => o.status === 'pending')
                ?? group.find(o => o.status === 'ready')
                ?? group.find(o => o.status === 'preparing')
                ?? group[0]
              const cfg = getOrderStatusCfg(dominantOrder.status)

              // Una sola comanda → fila simple
              if (group.length === 1) {
                const order = group[0]
                const elapsed = elapsedMin(order.created_at)
                return (
                  <button
                    key={order.id}
                    onClick={() => { if (table) setMode({ type: 'open', table }) }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#161622] border border-white/5 hover:border-[#FF6B35]/30 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                         style={{ backgroundColor: cfg.color + '20', color: cfg.color }}>
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
                        <span className="text-white/25 text-[10px]">{elapsedMin(order.created_at)}m</span>
                      </div>
                    </div>
                  </button>
                )
              }

              // Múltiples comandas → tarjeta agrupada
              return (
                <div
                  key={tableId}
                  className="rounded-xl border border-[#FF6B35]/25 bg-[#161622] overflow-hidden"
                >
                  {/* Header del grupo — click abre el panel de la mesa */}
                  <button
                    onClick={() => { if (table) setMode({ type: 'open', table }) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                         style={{ backgroundColor: cfg.color + '20', color: cfg.color }}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-semibold">
                          {table?.label ?? 'Mesa'}
                        </p>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35]">
                          {group.length} comandas
                        </span>
                      </div>
                      <p className="text-white/30 text-xs mt-0.5">
                        {totalItems} ítems · {group.map(o => getOrderStatusCfg(o.status).label).join(', ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                        {clp(totalAmount)}
                      </p>
                      <p className="text-white/25 text-[10px]">total mesa</p>
                    </div>
                  </button>

                  {/* Filas individuales de cada comanda */}
                  {group.map((order, idx) => {
                    const elapsed = elapsedMin(order.created_at)
                    const oc = getOrderStatusCfg(order.status)
                    return (
                      <button
                        key={order.id}
                        onClick={() => { if (table) setMode({ type: 'open', table }) }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors text-left ${idx < group.length - 1 ? 'border-b border-white/5' : ''}`}
                        style={{ paddingLeft: '3.5rem' }}
                      >
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{ backgroundColor: oc.color + '20', color: oc.color }}
                        >
                          {oc.label}
                        </span>
                        <p className="flex-1 text-white/50 text-xs truncate">
                          {order.order_items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-white/30 text-[10px] flex items-center gap-0.5">
                            <Clock size={8} />{elapsed}m
                          </span>
                          <span className="text-white/60 text-xs font-semibold tabular-nums" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                            {clp(order.total)}
                          </span>
                        </div>
                      </button>
                    )
                  })}

                  {/* Botón cobrar mesa — solo si todas están entregadas */}
                  {allDelivered && (
                    <div className="px-3 pb-3 pt-1">
                      <button
                        onClick={() => {
                          const maxPax = group.reduce((max, o) => Math.max(max, o.pax || 0), 0)
                          setBillSplitTable({
                            tableId,
                            tableLabel: table?.label ?? 'Mesa',
                            orders: group,
                            totalAmount,
                            pax: maxPax || 2
                          })
                        }}
                        className="w-full py-2 rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 bg-[#FF6B35]/18 text-[#FF6B35] border border-[#FF6B35]/30 hover:bg-[#FF6B35]/28"
                      >
                        <Banknote size={13} />
                        Cobrar mesa · {clp(totalAmount)}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Empty state */}
      {mode.type === 'map' && orders.length === 0 && (
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
          restaurantId={restaurant?.id ?? ''}
          onConfirm={handlePaymentConfirm}
          onClose={() => setPayingOrder(null)}
        />
      )}

      {/* Bill split modal */}
      {billSplitTable && (
        <BillSplitModal
          tableId={billSplitTable.tableId}
          tableLabel={billSplitTable.tableLabel}
          orders={billSplitTable.orders}
          totalAmount={billSplitTable.totalAmount}
          pax={billSplitTable.pax}
          restaurantId={restaurant?.id ?? ''}
          onComplete={async () => {
            setBillSplitTable(null)
            setMode({ type: 'map' })
            await loadData()
          }}
          onClose={() => setBillSplitTable(null)}
        />
      )}

      {/* Cancel order modal */}
      {cancellingOrder && (
        <CancelOrderModal
          orderId={cancellingOrder.id}
          tableLabel={cancellingOrder.tableLabel}
          onClose={() => setCancellingOrder(null)}
          onCancelled={async () => { setMode({ type: 'map' }); await loadData() }}
        />
      )}

      {/* Coupon redeem modal */}
      {showCoupon && restId && (
        <CouponRedeemModal
          restaurantId={restId}
          onClose={() => setShowCoupon(false)}
        />
      )}

      {/* Ticket printer selection modal — shown when multiple printers of same kind */}
      {showTicketModal && ticketCtx && ticketGroups.length > 0 && (
        <TicketPrinterModal
          groups={ticketGroups}
          onConfirm={async (selections) => {
            setShowTicketModal(false)
            await sendSelectedTickets(ticketGroups, selections, ticketCtx)
            setTicketGroups([])
            setTicketCtx(null)
          }}
          onCancel={() => {
            setShowTicketModal(false)
            setTicketGroups([])
            setTicketCtx(null)
          }}
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
