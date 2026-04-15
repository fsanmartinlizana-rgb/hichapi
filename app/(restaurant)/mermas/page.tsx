'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  Trash2, Plus, AlertTriangle, TrendingDown,
  Package, ChevronDown, RefreshCw, UtensilsCrossed
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/i18n'

// ── Types ────────────────────────────────────────────────────────────────────

interface StockItem {
  id: string
  name: string
  unit: string
  current_qty: number
  min_qty: number
  cost_per_unit: number
  category: string
}

interface WasteEntry {
  id: string
  stock_item_id: string | null
  menu_item_id: string | null
  item_type: 'stock' | 'plato'
  qty_lost: number
  reason: string
  notes: string | null
  cost_lost: number
  logged_at: string
  stock_items: { name: string; unit: string } | null
  menu_items: { name: string; price: number } | null
}

interface MenuItem {
  id: string
  name: string
  price: number
  category: string | null
}

const STOCK_REASONS: { value: string; label: string }[] = [
  { value: 'vencimiento',  label: 'Vencimiento' },
  { value: 'deterioro',    label: 'Deterioro' },
  { value: 'rotura',       label: 'Rotura / derrame' },
  { value: 'error_prep',   label: 'Error de preparación' },
  { value: 'sobras',       label: 'Sobras del día' },
  { value: 'devolucion',   label: 'Devolución comanda' },
  { value: 'otro',         label: 'Otro' },
]

const PLATE_REASONS: { value: string; label: string }[] = [
  { value: 'plato_quemado',        label: 'Quemado' },
  { value: 'plato_frio',           label: 'Frío / tibio' },
  { value: 'plato_mal_preparado',  label: 'Mal preparado' },
  { value: 'plato_devuelto',       label: 'Devuelto por cliente' },
  { value: 'plato_caido',          label: 'Caído / derramado' },
  { value: 'otro',                 label: 'Otro' },
]

const REASONS = [...STOCK_REASONS, ...PLATE_REASONS]

const CLP = (v: number) => formatCurrency(v)

// ── Component ────────────────────────────────────────────────────────────────

export default function MermasPage() {
  const supabase = createClient()
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [stockItems,  setStockItems]  = useState<StockItem[]>([])
  const [menuItems,   setMenuItems]   = useState<MenuItem[]>([])
  const [wasteLog,    setWasteLog]    = useState<WasteEntry[]>([])
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)

  // Form state
  const [itemType,     setItemType]     = useState<'stock' | 'plato'>('stock')
  const [selectedItem, setSelectedItem] = useState('')
  const [qty,          setQty]          = useState('')
  const [reason,       setReason]       = useState('deterioro')
  const [notes,        setNotes]        = useState('')

  // ── Load data ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!restId) return
    const [stockRes, menuRes, wasteRes] = await Promise.all([
      supabase
        .from('stock_items')
        .select('id, name, unit, current_qty, min_qty, cost_per_unit, category')
        .eq('restaurant_id', restId)
        .eq('active', true)
        .order('name'),
      supabase
        .from('menu_items')
        .select('id, name, price, category')
        .eq('restaurant_id', restId)
        .eq('available', true)
        .order('name'),
      supabase
        .from('waste_log')
        .select('id, stock_item_id, menu_item_id, item_type, qty_lost, reason, notes, cost_lost, logged_at, stock_items(name, unit), menu_items(name, price)')
        .eq('restaurant_id', restId)
        .order('logged_at', { ascending: false })
        .limit(100),
    ])

    setStockItems(stockRes.data ?? [])
    setMenuItems(menuRes.data ?? [])
    setWasteLog(
      (wasteRes.data ?? []).map((w: unknown) => {
        const entry = w as Record<string, unknown>
        const si = Array.isArray(entry.stock_items)
          ? (entry.stock_items[0] as { name: string; unit: string } ?? null)
          : (entry.stock_items as { name: string; unit: string } | null)
        const mi = Array.isArray(entry.menu_items)
          ? (entry.menu_items[0] as { name: string; price: number } ?? null)
          : (entry.menu_items as { name: string; price: number } | null)
        return { ...entry, stock_items: si, menu_items: mi } as WasteEntry
      })
    )
    setLoading(false)
  }, [restId, supabase])

  useEffect(() => { load() }, [load])

  // ── Submit waste entry ─────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItem || !qty) return

    setSubmitting(true)
    const qtyLost = parseFloat(qty)

    let payload: Record<string, unknown> = {
      restaurant_id: restId,
      qty_lost: qtyLost,
      reason,
      notes: notes || null,
      item_type: itemType,
    }

    if (itemType === 'stock') {
      const item = stockItems.find(i => i.id === selectedItem)
      if (!item) { setSubmitting(false); return }
      payload = {
        ...payload,
        stock_item_id: selectedItem,
        cost_lost: Math.round(qtyLost * item.cost_per_unit),
      }
    } else {
      const plate = menuItems.find(m => m.id === selectedItem)
      if (!plate) { setSubmitting(false); return }
      payload = {
        ...payload,
        menu_item_id: selectedItem,
        // No descontar stock: el plato preparado ya consumió ingredientes.
        cost_lost: Math.round(qtyLost * plate.price),
        already_deducted: true,
      }
    }

    const { error } = await supabase.from('waste_log').insert(payload)

    if (error) {
      console.error('Merma insert error:', error)
      alert(`Error al registrar merma: ${error.message}`)
    } else {
      setSelectedItem('')
      setQty('')
      setNotes('')
      setReason(itemType === 'stock' ? 'deterioro' : 'plato_quemado')
      await load()
    }
    setSubmitting(false)
  }

  // ── Computed stats (last 7 days) ───────────────────────────────────────────

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weeklyWaste  = wasteLog.filter(w => w.logged_at >= sevenDaysAgo)
  const weeklyLoss   = weeklyWaste.reduce((s, w) => s + (w.cost_lost ?? 0), 0)

  // Top 3 items by cost lost (weekly)
  const topItems = Object.entries(
    weeklyWaste.reduce((acc, w) => {
      const name = w.stock_items?.name ?? 'Desconocido'
      acc[name] = (acc[name] ?? 0) + (w.cost_lost ?? 0)
      return acc
    }, {} as Record<string, number>)
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const lowStockItems = stockItems.filter(i => i.current_qty <= i.min_qty)

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        <RefreshCw size={20} className="animate-spin mr-2" />Cargando...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Control de Mermas</h1>
          <p className="text-white/40 text-sm mt-0.5">Registro de pérdidas e inventario bajo mínimo</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/8">
          <p className="text-white/40 text-xs mb-1">Pérdida esta semana</p>
          <p className="text-white text-2xl font-bold">{CLP(weeklyLoss)}</p>
          <p className="text-white/30 text-xs mt-1">{weeklyWaste.length} registros</p>
        </div>
        <div className={`rounded-2xl p-4 border ${lowStockItems.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/8'}`}>
          <p className="text-white/40 text-xs mb-1">Bajo mínimo</p>
          <p className={`text-2xl font-bold ${lowStockItems.length > 0 ? 'text-red-400' : 'text-white'}`}>
            {lowStockItems.length}
          </p>
          <p className="text-white/30 text-xs mt-1">
            {lowStockItems.length > 0 ? lowStockItems.map(i => i.name).join(', ').slice(0, 40) : 'Todo en orden'}
          </p>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/8">
          <p className="text-white/40 text-xs mb-1">Top pérdida (semana)</p>
          {topItems.length > 0 ? (
            <div className="space-y-1 mt-1">
              {topItems.map(([name, loss]) => (
                <div key={name} className="flex justify-between text-xs">
                  <span className="text-white/70 truncate mr-2">{name}</span>
                  <span className="text-amber-400 font-medium shrink-0">{CLP(loss)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white text-sm mt-1">Sin registros</p>
          )}
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm">Stock bajo mínimo</p>
            <p className="text-red-300/70 text-xs mt-0.5">
              {lowStockItems.map(i => `${i.name} (${i.current_qty} ${i.unit})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_360px] gap-6">

        {/* Waste log table */}
        <div className="bg-white/5 rounded-2xl border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
            <TrendingDown size={14} className="text-white/40" />
            <span className="text-white text-sm font-medium">Registros recientes</span>
          </div>
          <div className="overflow-y-auto max-h-[480px]">
            {wasteLog.length === 0 ? (
              <EmptyState
                icon={TrendingDown}
                title="Sin registros aún"
                description="Cuando registres mermas, verás acá el historial con la pérdida estimada"
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-2.5 text-left text-white/30 text-xs font-medium">Ítem</th>
                    <th className="px-4 py-2.5 text-left text-white/30 text-xs font-medium">Cantidad</th>
                    <th className="px-4 py-2.5 text-left text-white/30 text-xs font-medium">Razón</th>
                    <th className="px-4 py-2.5 text-right text-white/30 text-xs font-medium">Pérdida</th>
                    <th className="px-4 py-2.5 text-right text-white/30 text-xs font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {wasteLog.map(w => {
                    const isPlate = w.item_type === 'plato'
                    const name = isPlate
                      ? (w.menu_items?.name ?? '—')
                      : (w.stock_items?.name ?? '—')
                    const unit = isPlate ? 'platos' : (w.stock_items?.unit ?? '')
                    return (
                      <tr key={w.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{name}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                              isPlate
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                : 'bg-blue-500/10 text-blue-300 border-blue-500/25'
                            }`}>
                              {isPlate ? 'plato' : 'stock'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/60">{w.qty_lost} {unit}</td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            {REASONS.find(r => r.value === w.reason)?.label ?? w.reason}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-red-400 font-medium">{CLP(w.cost_lost ?? 0)}</td>
                        <td className="px-4 py-3 text-right text-white/30 text-xs">
                          {new Date(w.logged_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Register form */}
        <div className="bg-white/5 rounded-2xl border border-white/8 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus size={14} className="text-white/40" />
            <span className="text-white text-sm font-medium">Registrar merma</span>
          </div>

          {/* Type tabs */}
          <div className="flex gap-1 bg-white/4 border border-white/8 rounded-xl p-1 mb-4">
            {([
              { v: 'stock' as const, label: 'Stock', icon: Package },
              { v: 'plato' as const, label: 'Plato', icon: UtensilsCrossed },
            ]).map(t => {
              const Icon = t.icon
              const active = itemType === t.v
              return (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => {
                    setItemType(t.v)
                    setSelectedItem('')
                    setReason(t.v === 'stock' ? 'deterioro' : 'plato_quemado')
                  }}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    active ? 'bg-[#FF6B35] text-white' : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Item selector */}
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">
                {itemType === 'stock' ? 'Ítem de stock' : 'Plato de la carta'}
              </label>
              <div className="relative">
                <select
                  value={selectedItem}
                  onChange={e => setSelectedItem(e.target.value)}
                  required
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm appearance-none focus:outline-none focus:border-[#FF6B35]/50"
                >
                  <option value="">Selecciona {itemType === 'stock' ? 'un ítem' : 'un plato'}...</option>
                  {itemType === 'stock'
                    ? stockItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.current_qty} {item.unit})
                        </option>
                      ))
                    : menuItems.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {CLP(m.price)}
                        </option>
                      ))
                  }
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-white/30 pointer-events-none" />
              </div>
              {selectedItem && itemType === 'stock' && (() => {
                const item = stockItems.find(i => i.id === selectedItem)
                return item ? (
                  <p className="text-white/30 text-xs mt-1">
                    Stock actual: {item.current_qty} {item.unit} · {CLP(item.cost_per_unit)}/{item.unit}
                  </p>
                ) : null
              })()}
              {selectedItem && itemType === 'plato' && (() => {
                const plate = menuItems.find(m => m.id === selectedItem)
                return plate ? (
                  <p className="text-white/30 text-xs mt-1">
                    Precio de venta: {CLP(plate.price)} · {plate.category ?? 'sin categoría'}
                  </p>
                ) : null
              })()}
            </div>

            {/* Quantity */}
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">
                {itemType === 'stock' ? 'Cantidad perdida' : 'Platos botados'}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step={itemType === 'stock' ? '0.001' : '1'}
                  min={itemType === 'stock' ? '0.001' : '1'}
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  required
                  placeholder={itemType === 'stock' ? '0.0' : '1'}
                  className="flex-1 bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50"
                />
                <span className="flex items-center px-3 bg-white/5 border border-white/8 rounded-xl text-white/40 text-sm">
                  {itemType === 'stock' ? (stockItems.find(i => i.id === selectedItem)?.unit ?? '—') : 'platos'}
                </span>
              </div>
              {selectedItem && qty && (() => {
                if (itemType === 'stock') {
                  const item = stockItems.find(i => i.id === selectedItem)
                  if (!item) return null
                  const loss = Math.round(parseFloat(qty || '0') * item.cost_per_unit)
                  return <p className="text-amber-400 text-xs mt-1">Pérdida estimada: {CLP(loss)}</p>
                } else {
                  const plate = menuItems.find(m => m.id === selectedItem)
                  if (!plate) return null
                  const loss = Math.round(parseFloat(qty || '0') * plate.price)
                  return <p className="text-amber-400 text-xs mt-1">Pérdida (precio venta): {CLP(loss)}</p>
                }
              })()}
            </div>

            {/* Reason */}
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Razón</label>
              <div className="relative">
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm appearance-none focus:outline-none focus:border-[#FF6B35]/50"
                >
                  {(itemType === 'stock' ? STOCK_REASONS : PLATE_REASONS).map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-white/30 pointer-events-none" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Observaciones adicionales..."
                className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-[#FF6B35]/50 placeholder-white/20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedItem || !qty}
              className="w-full py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Package size={14} />}
              {submitting ? 'Registrando...' : 'Registrar merma'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
