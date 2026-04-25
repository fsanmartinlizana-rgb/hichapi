'use client'

import { useState, useRef, useCallback } from 'react'
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import type { StepCatalogoVisualProps, MenuItemOption, OrderLine } from './types'
import { filterByName, groupByCategory, calculateTotal } from './utils'

// ── SearchBar ─────────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Buscar producto…"
        className="w-full rounded-xl border py-2.5 pl-9 pr-8 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/40 transition-colors"
        style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)' }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
          aria-label="Limpiar búsqueda"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// ── CategoryTabs ──────────────────────────────────────────────────────────────

function CategoryTabs({
  categories,
  active,
  onSelect,
}: {
  categories: string[]
  active: string | null
  onSelect: (cat: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (categories.length <= 1) return null

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      style={{ scrollbarWidth: 'none' }}
    >
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={[
            'flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all',
            active === cat
              ? 'bg-[#FF6B35] text-white shadow-sm'
              : 'border border-white/12 text-white/50 hover:border-white/25 hover:text-white/80',
          ].join(' ')}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

// ── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({
  item,
  qty,
  onAdd,
}: {
  item: MenuItemOption
  qty: number
  onAdd: () => void
}) {
  const price = item.price.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
  return (
    <button
      onClick={onAdd}
      className="relative flex flex-col items-start rounded-xl border p-3 text-left transition-all hover:border-[#FF6B35]/40 hover:bg-[#FF6B35]/8 active:scale-95"
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderColor: qty > 0 ? 'rgba(255,107,53,0.4)' : 'rgba(255,255,255,0.08)',
      }}
    >
      {qty > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6B35] text-[10px] font-bold text-white shadow">
          {qty}
        </span>
      )}
      <span className="text-sm font-medium text-white/90 leading-snug">{item.name}</span>
      <span className="mt-1 text-xs font-semibold text-[#FF6B35]">{price}</span>
    </button>
  )
}

// ── CategorySection ───────────────────────────────────────────────────────────

function CategorySection({
  category,
  items,
  qtyMap,
  onAdd,
  isOpen,
  onToggle,
  sectionRef,
}: {
  category: string
  items: MenuItemOption[]
  qtyMap: Record<string, number>
  onAdd: (item: MenuItemOption) => void
  isOpen: boolean
  onToggle: () => void
  sectionRef?: (el: HTMLElement | null) => void
}) {
  const totalInCart = items.reduce((sum, item) => sum + (qtyMap[item.id] ?? 0), 0)

  return (
    <section ref={sectionRef} className="mb-2">
      {/* Category header — clickable to collapse/expand */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-white/4"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown size={14} className="text-white/40 flex-shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-white/40 flex-shrink-0" />
          )}
          <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
            {category}
          </span>
          <span className="text-[10px] text-white/25">({items.length})</span>
        </div>
        {totalInCart > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FF6B35]/20 px-1.5 text-[10px] font-bold text-[#FF6B35]">
            {totalInCart}
          </span>
        )}
      </button>

      {/* Products grid */}
      {isOpen && (
        <div className="mt-2 mb-1 grid grid-cols-2 gap-2 px-1 sm:grid-cols-3 lg:grid-cols-4">
          {items.map(item => (
            <ProductCard
              key={item.id}
              item={item}
              qty={qtyMap[item.id] ?? 0}
              onAdd={() => onAdd(item)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ── OrderLineItem ─────────────────────────────────────────────────────────────

function OrderLineItem({
  line,
  onUpdate,
  onRemove,
}: {
  line: OrderLine
  onUpdate: (p: Partial<OrderLine>) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const partialPrice = (line.unitPrice * line.qty).toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
  })

  return (
    <div
      className="rounded-lg border p-2 text-sm"
      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => (line.qty <= 1 ? onRemove() : onUpdate({ qty: line.qty - 1 }))}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/70 hover:bg-white/15 transition-colors"
            aria-label="Decrementar"
          >
            −
          </button>
          <span className="w-5 text-center font-medium text-white">{line.qty}</span>
          <button
            onClick={() => onUpdate({ qty: line.qty + 1 })}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/70 hover:bg-white/15 transition-colors"
            aria-label="Incrementar"
          >
            +
          </button>
        </div>

        <div className="flex flex-1 min-w-0 flex-col">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-left w-full"
          >
            <span className="flex-1 truncate text-xs font-medium text-white/80">{line.name}</span>
            {line.note && (
              <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" title="Tiene nota" />
            )}
            <ChevronDown
              size={12}
              className={`flex-shrink-0 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
          <span className="text-xs font-semibold text-[#FF6B35]">{partialPrice}</span>
        </div>

        <button
          onClick={onRemove}
          className="flex-shrink-0 text-white/25 hover:text-red-400 transition-colors"
          aria-label={`Eliminar ${line.name}`}
        >
          <X size={14} />
        </button>
      </div>

      {expanded && (
        <div
          className="mt-2 space-y-2 border-t pt-2"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div>
            <label className="mb-1 block text-xs text-white/40">Nota (máx. 120 caracteres)</label>
            <textarea
              value={line.note}
              onChange={e => onUpdate({ note: e.target.value.slice(0, 120) })}
              maxLength={120}
              rows={2}
              placeholder="Ej: sin cebolla, término medio…"
              className="w-full resize-none rounded-lg border px-2 py-1 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-[#FF6B35]/40"
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
                      ? 'bg-[#FF6B35] text-white'
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

// ── OrderSummaryPanel ─────────────────────────────────────────────────────────

function OrderSummaryPanel({
  lines,
  onUpdateLine,
  onRemoveLine,
  onContinue,
  onBack,
}: {
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
        <p className="flex-1 text-center text-sm text-white/25 py-8">
          Agrega productos desde el catálogo
        </p>
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
          className="w-full rounded-xl bg-[#FF6B35] py-2.5 text-sm font-semibold text-white transition hover:bg-[#ff8255] disabled:cursor-not-allowed disabled:opacity-30"
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function StepCatalogoVisual({
  menuItems,
  lines,
  onAddItem,
  onUpdateLine,
  onRemoveLine,
  onContinue,
  onBack,
}: StepCatalogoVisualProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const filtered = filterByName(menuItems, query)
  const grouped = groupByCategory(filtered)
  const categories = Object.keys(grouped).sort((a, b) => {
    // "Sin categoría" always last
    if (a === 'Sin categoría') return 1
    if (b === 'Sin categoría') return -1
    return a.localeCompare(b, 'es')
  })

  const qtyMap = lines.reduce<Record<string, number>>((acc, l) => {
    acc[l.menuItemId] = l.qty
    return acc
  }, {})

  // Track which categories are open (all open by default)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map(c => [c, true]))
  )

  // When categories change (e.g. after search), ensure new ones are open
  const ensureOpen = useCallback(
    (cats: string[]) => {
      setOpenCategories(prev => {
        const next = { ...prev }
        cats.forEach(c => {
          if (next[c] === undefined) next[c] = true
        })
        return next
      })
    },
    []
  )

  // Sync open state when filtered categories change
  if (categories.some(c => openCategories[c] === undefined)) {
    ensureOpen(categories)
  }

  function toggleCategory(cat: string) {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  function handleCategoryTabClick(cat: string) {
    setActiveCategory(cat)
    // Ensure the section is open
    setOpenCategories(prev => ({ ...prev, [cat]: true }))
    // Scroll to section
    const el = sectionRefs.current[cat]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (menuItems.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-white/40">No hay productos disponibles en el menú.</p>
        <a
          href="/carta"
          className="rounded-xl bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff8255]"
        >
          Ir a Carta
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Search + category tabs */}
        <div className="px-4 pt-4 pb-3 space-y-3">
          <SearchBar value={query} onChange={setQuery} />
          <CategoryTabs
            categories={categories}
            active={activeCategory}
            onSelect={handleCategoryTabClick}
          />
        </div>

        {/* Scrollable product list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/35">
              No hay productos que coincidan con &lsquo;{query}&rsquo;
            </p>
          ) : (
            categories.map(category => (
              <CategorySection
                key={category}
                category={category}
                items={grouped[category]}
                qtyMap={qtyMap}
                onAdd={onAddItem}
                isOpen={openCategories[category] ?? true}
                onToggle={() => toggleCategory(category)}
                sectionRef={el => { sectionRefs.current[category] = el }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel — desktop ── */}
      <aside
        className="hidden w-72 flex-shrink-0 border-l p-4 lg:flex lg:flex-col"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
      >
        <OrderSummaryPanel
          lines={lines}
          onUpdateLine={onUpdateLine}
          onRemoveLine={onRemoveLine}
          onContinue={onContinue}
          onBack={onBack}
        />
      </aside>

      {/* ── Bottom bar — mobile ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10 border-t lg:hidden"
        style={{ background: '#1C1C2E', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-white/50">
            {lines.length === 0
              ? 'Sin productos'
              : `${lines.reduce((s, l) => s + l.qty, 0)} ítem${lines.reduce((s, l) => s + l.qty, 0) !== 1 ? 's' : ''}`}
          </span>
          <span className="text-sm font-semibold text-white">
            {calculateTotal(lines).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
          </span>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={onBack}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-white/60 hover:bg-white/6"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
          >
            Atrás
          </button>
          <button
            onClick={onContinue}
            disabled={lines.length === 0}
            className="flex-1 rounded-xl bg-[#FF6B35] py-2.5 text-sm font-semibold text-white hover:bg-[#ff8255] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
