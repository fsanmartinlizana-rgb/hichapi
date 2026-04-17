'use client'

import { useState } from 'react'
import type { StepCatalogoVisualProps, MenuItemOption, OrderLine } from './types'
import { filterByName, groupByCategory, calculateTotal } from './utils'

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Buscar producto…"
        className="w-full rounded-xl border py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
        style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)' }}
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70" aria-label="Limpiar">×</button>
      )}
    </div>
  )
}

function ProductCard({ item, qty, onAdd }: { item: MenuItemOption; qty: number; onAdd: () => void }) {
  const price = item.price.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
  return (
    <button
      onClick={onAdd}
      className="relative flex flex-col items-start rounded-xl border p-3 text-left transition-all hover:border-indigo-500/50 hover:bg-white/8 active:scale-95"
      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      {qty > 0 && (
        <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white shadow-lg">
          {qty}
        </span>
      )}
      <span className="text-sm font-medium text-white/90 leading-snug">{item.name}</span>
      <span className="mt-1 text-xs font-semibold text-indigo-400">{price}</span>
    </button>
  )
}

function OrderLineItem({ line, onUpdate, onRemove }: { line: OrderLine; onUpdate: (p: Partial<OrderLine>) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const partialPrice = (line.unitPrice * line.qty).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

  return (
    <div className="rounded-lg border p-2 text-sm" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2">
        {/* Qty controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => line.qty <= 1 ? onRemove() : onUpdate({ qty: line.qty - 1 })}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/70 hover:bg-white/15 transition-colors"
            aria-label="Decrementar"
          >−</button>
          <span className="w-5 text-center font-medium text-white">{line.qty}</span>
          <button
            onClick={() => onUpdate({ qty: line.qty + 1 })}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/70 hover:bg-white/15 transition-colors"
            aria-label="Incrementar"
          >+</button>
        </div>

        {/* Name + price */}
        <div className="flex flex-1 min-w-0 flex-col">
          <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-left w-full">
            <span className="flex-1 truncate text-xs font-medium text-white/80">{line.name}</span>
            {line.note && <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" title="Tiene nota" />}
            <svg className={`h-3 w-3 flex-shrink-0 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <span className="text-xs font-semibold text-indigo-400">{partialPrice}</span>
        </div>

        {/* Delete */}
        <button onClick={onRemove} className="flex-shrink-0 text-white/25 hover:text-red-400 transition-colors" aria-label={`Eliminar ${line.name}`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 border-t pt-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <label className="mb-1 block text-xs text-white/40">Nota (máx. 120 caracteres)</label>
            <textarea
              value={line.note}
              onChange={e => onUpdate({ note: e.target.value.slice(0, 120) })}
              maxLength={120}
              rows={2}
              placeholder="Ej: sin cebolla, término medio…"
              className="w-full resize-none rounded-lg border px-2 py-1 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)' }}
            />
            <p className="text-right text-xs text-white/25">{line.note.length}/120</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/40">Destino</label>
            <div className="flex gap-1">
              {(['cocina', 'barra', 'ninguno'] as const).map(dest => (
                <button
                  key={dest}
                  onClick={() => onUpdate({ destination: dest })}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize transition ${
                    line.destination === dest
                      ? 'bg-indigo-500 text-white'
                      : 'border border-white/15 text-white/50 hover:bg-white/8'
                  }`}
                >
                  {dest}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderSummaryPanel({ lines, onUpdateLine, onRemoveLine, onContinue, onBack }: {
  lines: OrderLine[]
  onUpdateLine: (id: string, patch: Partial<OrderLine>) => void
  onRemoveLine: (id: string) => void
  onContinue: () => void
  onBack: () => void
}) {
  const total = calculateTotal(lines).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
  return (
    <div className="flex flex-col h-full">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/35">Resumen</h2>

      {lines.length === 0 ? (
        <p className="flex-1 text-center text-sm text-white/25 py-8">Agrega productos desde el catálogo</p>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {lines.map(line => (
            <OrderLineItem
              key={line.menuItemId}
              line={line}
              onUpdate={patch => onUpdateLine(line.menuItemId, patch)}
              onRemove={() => onRemoveLine(line.menuItemId)}
            />
          ))}
        </div>
      )}

      <div className="mt-3 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between text-sm font-semibold text-white">
          <span>Total</span>
          <span>{total}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          onClick={onContinue}
          disabled={lines.length === 0}
          className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Continuar
        </button>
        <button
          onClick={onBack}
          className="w-full rounded-xl border py-2 text-sm font-medium text-white/60 transition hover:bg-white/6"
          style={{ borderColor: 'rgba(255,255,255,0.12)' }}
        >
          Atrás
        </button>
      </div>
    </div>
  )
}

export default function StepCatalogoVisual({ menuItems, lines, onAddItem, onUpdateLine, onRemoveLine, onContinue, onBack }: StepCatalogoVisualProps) {
  const [query, setQuery] = useState('')

  if (menuItems.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-white/40">No hay productos disponibles en el menú.</p>
        <a href="/carta" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Ir a Carta</a>
      </div>
    )
  }

  const filtered  = filterByName(menuItems, query)
  const grouped   = groupByCategory(filtered)
  const categories = Object.keys(grouped)
  const qtyMap    = lines.reduce<Record<string, number>>((acc, l) => { acc[l.menuItemId] = l.qty; return acc }, {})

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <SearchBar value={query} onChange={setQuery} />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/35">
              No hay productos que coincidan con &lsquo;{query}&rsquo;
            </p>
          ) : (
            categories.map(category => (
              <section key={category} className="mb-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/35">{category}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {grouped[category].map(item => (
                    <ProductCard key={item.id} item={item} qty={qtyMap[item.id] ?? 0} onAdd={() => onAddItem(item)} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {/* Right panel — desktop */}
      <aside
        className="hidden w-72 flex-shrink-0 border-l p-4 lg:flex lg:flex-col"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
      >
        <OrderSummaryPanel lines={lines} onUpdateLine={onUpdateLine} onRemoveLine={onRemoveLine} onContinue={onContinue} onBack={onBack} />
      </aside>

      {/* Bottom bar — mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t lg:hidden" style={{ background: '#1C1C2E', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-white/50">
            {lines.length === 0 ? 'Sin productos' : `${lines.reduce((s, l) => s + l.qty, 0)} ítem${lines.reduce((s, l) => s + l.qty, 0) !== 1 ? 's' : ''}`}
          </span>
          <span className="text-sm font-semibold text-white">
            {calculateTotal(lines).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
          </span>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button onClick={onBack} className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-white/60 hover:bg-white/6" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>Atrás</button>
          <button onClick={onContinue} disabled={lines.length === 0} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-30">Continuar</button>
        </div>
      </div>
    </div>
  )
}
