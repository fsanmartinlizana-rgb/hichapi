'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Package, Plus, AlertTriangle, RefreshCw,
  Pencil, Trash2, ChevronDown, X, Check, Minus
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface StockItem {
  id: string
  name: string
  unit: string
  current_qty: number
  min_qty: number
  cost_per_unit: number
  category: string
  supplier: string | null
  updated_at: string
}

const UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja'] as const
const CLP = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(v)

const DEMO_RESTAURANT_ID = process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ?? ''

// ── Component ────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [items,       setItems]       = useState<StockItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editItem,    setEditItem]    = useState<StockItem | null>(null)
  const [adjustItem,  setAdjustItem]  = useState<StockItem | null>(null)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [filterLow,   setFilterLow]   = useState(false)

  // Form state
  const [form, setForm] = useState({
    name: '', unit: 'kg' as typeof UNITS[number],
    current_qty: '', min_qty: '', cost_per_unit: '',
    supplier: '', category: 'general',
  })

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/stock?restaurant_id=${DEMO_RESTAURANT_ID}`)
    const data = await res.json()
    setItems(data.items ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Create / Update ────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      restaurant_id: DEMO_RESTAURANT_ID,
      name:          form.name,
      unit:          form.unit,
      current_qty:   parseFloat(form.current_qty),
      min_qty:       parseFloat(form.min_qty),
      cost_per_unit: parseInt(form.cost_per_unit),
      supplier:      form.supplier || undefined,
      category:      form.category || 'general',
    }

    if (editItem) {
      await fetch('/api/stock', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editItem.id, ...payload }) })
    } else {
      await fetch('/api/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) })
    }
    setShowForm(false)
    setEditItem(null)
    resetForm()
    await load()
  }

  function resetForm() {
    setForm({ name: '', unit: 'kg', current_qty: '', min_qty: '', cost_per_unit: '', supplier: '', category: 'general' })
  }

  function startEdit(item: StockItem) {
    setForm({
      name: item.name, unit: item.unit as typeof UNITS[number],
      current_qty: String(item.current_qty), min_qty: String(item.min_qty),
      cost_per_unit: String(item.cost_per_unit),
      supplier: item.supplier ?? '', category: item.category,
    })
    setEditItem(item)
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/stock?id=${id}`, { method: 'DELETE' })
    await load()
  }

  async function handleAdjust() {
    if (!adjustItem || !adjustDelta) return
    const delta = parseFloat(adjustDelta)
    if (isNaN(delta)) return
    await fetch('/api/stock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: adjustItem.id, delta, reason: 'ajuste_manual' }),
    })
    setAdjustItem(null)
    setAdjustDelta('')
    await load()
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const displayed   = filterLow ? items.filter(i => i.current_qty <= i.min_qty) : items
  const lowCount    = items.filter(i => i.current_qty <= i.min_qty).length
  const totalValue  = items.reduce((s, i) => s + i.current_qty * i.cost_per_unit, 0)

  const byCategory = displayed.reduce((acc, item) => {
    const cat = item.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, StockItem[]>)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Control de Stock</h1>
          <p className="text-white/40 text-sm mt-0.5">Inventario, alertas y ajustes manuales</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { resetForm(); setEditItem(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold transition-colors"
          >
            <Plus size={14} /> Nuevo ítem
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/8">
          <p className="text-white/40 text-xs mb-1">Ítems en inventario</p>
          <p className="text-white text-2xl font-bold">{items.length}</p>
        </div>
        <div className={`rounded-2xl p-4 border ${lowCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/8'}`}>
          <p className="text-white/40 text-xs mb-1">Bajo mínimo</p>
          <p className={`text-2xl font-bold ${lowCount > 0 ? 'text-red-400' : 'text-white'}`}>{lowCount}</p>
          {lowCount > 0 && (
            <button onClick={() => setFilterLow(!filterLow)} className="text-red-400/70 text-xs mt-1 underline">
              {filterLow ? 'Mostrar todos' : 'Ver solo bajos'}
            </button>
          )}
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/8">
          <p className="text-white/40 text-xs mb-1">Valor inventario</p>
          <p className="text-white text-2xl font-bold">{CLP(totalValue)}</p>
        </div>
      </div>

      {/* Low stock alert banner */}
      {lowCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">
            <span className="font-semibold">{lowCount} ítem{lowCount > 1 ? 's' : ''} bajo mínimo:</span>{' '}
            {items.filter(i => i.current_qty <= i.min_qty).map(i => i.name).join(', ')}
          </p>
        </div>
      )}

      {/* Stock table by category */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-white/30">
          <RefreshCw size={18} className="animate-spin mr-2" />Cargando...
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-12 text-center text-white/30">
          {filterLow ? 'Ningún ítem bajo mínimo' : 'Sin ítems en inventario. Agrega el primero.'}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byCategory).map(([cat, catItems]) => (
            <div key={cat} className="bg-white/5 rounded-2xl border border-white/8 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8">
                <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">{cat}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-2.5 text-left text-white/30 text-xs font-medium">Nombre</th>
                    <th className="px-4 py-2.5 text-center text-white/30 text-xs font-medium">Stock actual</th>
                    <th className="px-4 py-2.5 text-center text-white/30 text-xs font-medium">Mínimo</th>
                    <th className="px-4 py-2.5 text-right text-white/30 text-xs font-medium">Costo/unidad</th>
                    <th className="px-4 py-2.5 text-right text-white/30 text-xs font-medium">Valor total</th>
                    <th className="px-4 py-2.5 text-center text-white/30 text-xs font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {catItems.map(item => {
                    const isLow = item.current_qty <= item.min_qty
                    return (
                      <tr key={item.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${isLow ? 'bg-red-500/5' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isLow && <AlertTriangle size={12} className="text-red-400 shrink-0" />}
                            <span className={`font-medium ${isLow ? 'text-red-300' : 'text-white'}`}>{item.name}</span>
                            {item.supplier && <span className="text-white/25 text-xs">· {item.supplier}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${isLow ? 'text-red-400' : 'text-white'}`}>
                            {item.current_qty}
                          </span>
                          <span className="text-white/40 text-xs ml-1">{item.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-white/50 text-xs">
                          {item.min_qty} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-right text-white/60">{CLP(item.cost_per_unit)}</td>
                        <td className="px-4 py-3 text-right text-white/60">
                          {CLP(Math.round(item.current_qty * item.cost_per_unit))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setAdjustItem(item); setAdjustDelta('') }}
                              title="Ajustar cantidad"
                              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                            >
                              <Minus size={13} />
                            </button>
                            <button
                              onClick={() => startEdit(item)}
                              title="Editar"
                              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              title="Eliminar"
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Adjust qty modal */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A2E] rounded-2xl border border-white/12 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Ajustar: {adjustItem.name}</h3>
              <button onClick={() => setAdjustItem(null)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-white/50 text-sm mb-4">
              Stock actual: <span className="text-white font-medium">{adjustItem.current_qty} {adjustItem.unit}</span>
            </p>
            <div className="flex gap-3 mb-4">
              <button onClick={() => setAdjustDelta(v => v.startsWith('-') ? v.slice(1) : '-' + v)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/12 text-white text-sm font-medium">
                ±
              </button>
              <input
                type="number"
                step="0.01"
                value={adjustDelta}
                onChange={e => setAdjustDelta(e.target.value)}
                placeholder="Ej: 5 o -2"
                autoFocus
                className="flex-1 bg-white/8 border border-white/12 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50"
              />
              <span className="flex items-center px-3 bg-white/5 border border-white/8 rounded-xl text-white/40 text-sm">
                {adjustItem.unit}
              </span>
            </div>
            {adjustDelta && !isNaN(parseFloat(adjustDelta)) && (
              <p className="text-white/50 text-xs mb-4">
                Nuevo stock: <span className="text-white font-medium">
                  {Math.max(0, adjustItem.current_qty + parseFloat(adjustDelta))} {adjustItem.unit}
                </span>
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setAdjustItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/12 text-white/60 text-sm hover:bg-white/5 transition-colors">
                Cancelar
              </button>
              <button onClick={handleAdjust} disabled={!adjustDelta}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                <Check size={14} /> Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A2E] rounded-2xl border border-white/12 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">{editItem ? 'Editar ítem' : 'Nuevo ítem de stock'}</h3>
              <button onClick={() => { setShowForm(false); setEditItem(null); resetForm() }} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-white/50 text-xs mb-1.5 block">Nombre</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Harina"
                    className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50" />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Unidad</label>
                  <div className="relative">
                    <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value as typeof UNITS[number] }))}
                      className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm appearance-none focus:outline-none focus:border-[#FF6B35]/50">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-3.5 text-white/30 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Categoría</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="general"
                    className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50" />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Stock actual</label>
                  <input required type="number" step="0.001" min="0" value={form.current_qty}
                    onChange={e => setForm(f => ({ ...f, current_qty: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50" />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Mínimo</label>
                  <input required type="number" step="0.001" min="0" value={form.min_qty}
                    onChange={e => setForm(f => ({ ...f, min_qty: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50" />
                </div>
                <div className="col-span-2">
                  <label className="text-white/50 text-xs mb-1.5 block">Costo por unidad (CLP)</label>
                  <input required type="number" min="0" value={form.cost_per_unit}
                    onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50" />
                </div>
                <div className="col-span-2">
                  <label className="text-white/50 text-xs mb-1.5 block">Proveedor (opcional)</label>
                  <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                    placeholder="Nombre del proveedor"
                    className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowForm(false); setEditItem(null); resetForm() }}
                  className="flex-1 py-2.5 rounded-xl border border-white/12 text-white/60 text-sm hover:bg-white/5 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold transition-colors">
                  {editItem ? 'Guardar cambios' : 'Crear ítem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
