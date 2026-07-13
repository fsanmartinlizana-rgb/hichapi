'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Search, Utensils, XCircle, Plus, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'
import { MenuItemCard, type OrderableItem } from './CartPanel'
import { formatCurrency } from '@/lib/i18n'

interface PublicMenuProps {
  initialItems: OrderableItem[]
  categories: string[]
  /** Use light (white background) theme instead of dark */
  lightMode?: boolean
}

// ── Light-mode MenuItem Row ───────────────────────────────────────────────────
// A simpler card for the light theme: no add-to-cart button, just display.

let globalAddToCartRef: ((item: OrderableItem) => void) | null = null
// We import the global from CartPanel via a side-channel — instead we just
// re-export the dark card and build a light one here.

function LightMenuItemCard({ item }: { item: OrderableItem }) {
  const [adding, setAdding] = useState(false)

  function handleAdd() {
    if (!item.available) return
    // Access CartPanel's global via dynamic import trick — use window event instead
    setAdding(true)
    window.dispatchEvent(new CustomEvent('hichapi:addToCart', { detail: item }))
    setTimeout(() => setAdding(false), 600)
  }

  const isPromoted = item.tags?.includes('promovido')
  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  return (
    <div
      className={`group flex items-start gap-4 py-3.5 border-b border-neutral-100 last:border-0 cursor-pointer
        ${!item.available ? 'opacity-50' : ''}`}
      onClick={handleAdd}
      role="button"
      tabIndex={item.available ? 0 : -1}
      onKeyDown={e => e.key === 'Enter' && handleAdd()}
    >
      {/* Photo */}
      {item.photo_url && (
        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-neutral-100 bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          {isPromoted && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B35]/10 text-[#E55A2B] font-semibold">
              ⭐ Chapi sugiere
            </span>
          )}
          {!item.available && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-500 font-medium">
              Agotado
            </span>
          )}
        </div>
        <p className={`text-sm font-semibold text-[#1A1A2E] leading-tight ${!item.available ? 'line-through' : ''}`}>
          {item.name}
        </p>
        {item.description && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed line-clamp-2">{item.description}</p>
        )}
        {item.tags && item.tags.filter(t => t !== 'promovido').length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.tags.filter(t => t !== 'promovido').map(t => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium capitalize">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Price + add */}
      <div className="shrink-0 flex flex-col items-end gap-2">
        <p className="text-sm font-semibold font-mono text-[#1A1A2E]">{formatCLP(item.price)}</p>
        {item.available && (
          <button
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
              ${adding
                ? 'bg-green-500/15 border border-green-400/30'
                : 'bg-[#FF6B35]/10 border border-[#FF6B35]/20 group-hover:bg-[#FF6B35] group-hover:border-[#FF6B35]'}`}
            onClick={e => { e.stopPropagation(); handleAdd() }}
            aria-label={`Agregar ${item.name} al carrito`}
          >
            {adding
              ? <CheckCircle2 size={14} className="text-green-500" />
              : <Plus size={14} className="text-[#E55A2B] group-hover:text-[var(--text-strong)] transition-colors" />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PublicMenu({ initialItems, categories, lightMode = false }: PublicMenuProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    categories.forEach(cat => {
      initial[cat] = false // expanded by default
    })
    return initial
  })

  function toggleCategory(category: string) {
    setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }))
  }

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return initialItems
    return initialItems.filter(item => {
      const matchesName = item.name.toLowerCase().includes(query)
      const matchesDesc = (item.description ?? '').toLowerCase().includes(query)
      const matchesCat  = item.category.toLowerCase().includes(query)
      const matchesTags = (item.tags ?? []).some(t => t.toLowerCase().includes(query))
      return matchesName || matchesDesc || matchesCat || matchesTags
    })
  }, [searchQuery, initialItems])

  const groupedItems = useMemo(() => {
    const groups: Record<string, OrderableItem[]> = {}
    for (const cat of categories) groups[cat] = []
    for (const item of filteredItems) {
      const cat = item.category || 'Otros'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }
    return groups
  }, [filteredItems, categories])

  const totalFilteredCount = filteredItems.length

  // ── Styles based on theme ──
  const searchInputCls = lightMode
    ? 'w-full pl-11 pr-10 py-3 rounded-xl bg-neutral-50 border border-neutral-200 text-[#1A1A2E] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/50 transition-colors'
    : 'w-full pl-11 pr-10 py-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/50 transition-colors'

  const searchIconCls = lightMode ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]'
  const clearBtnCls   = lightMode ? 'text-[var(--text-muted)] hover:text-neutral-600' : 'text-[var(--text-muted)] hover:text-[var(--text-muted)]'

  const emptyStateCls = lightMode
    ? 'bg-neutral-50 rounded-2xl border border-neutral-100 p-12 text-center space-y-3'
    : 'bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-subtle)] p-12 text-center space-y-3'

  const emptyIconCls  = lightMode ? 'text-[var(--text-muted)] mx-auto' : 'text-[var(--text-muted)] mx-auto'
  const emptyTitleCls = lightMode ? 'text-[#1A1A2E] font-semibold text-base' : 'text-[var(--text-strong)] font-semibold text-base'
  const emptySubCls   = lightMode ? 'text-[var(--text-muted)] text-xs' : 'text-[var(--text-muted)] text-xs'

  const accordionWrapCls = lightMode
    ? 'bg-neutral-50 border border-neutral-100 rounded-2xl overflow-hidden transition-all duration-200'
    : 'bg-[var(--bg-canvas)]/40 border border-[var(--border-subtle)] rounded-2xl overflow-hidden transition-all duration-200'

  const accordionHeaderCls = lightMode
    ? 'w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-100 transition-colors text-left'
    : 'w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-sunken)] transition-colors text-left'

  const catLabelCls = lightMode
    ? 'text-sm font-bold text-[#1A1A2E] uppercase tracking-wider'
    : 'text-sm font-bold text-[var(--text-strong)] uppercase tracking-wider'

  const catBadgeCls = lightMode
    ? 'text-[10px] px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-500 border border-neutral-200 font-medium'
    : 'text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-muted)] border border-[var(--border-subtle)] font-medium'

  const chevronWrapCls = lightMode
    ? 'w-8 h-8 rounded-lg bg-neutral-200 border border-neutral-200 flex items-center justify-center text-neutral-500 transition-colors'
    : 'w-8 h-8 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] transition-colors'

  const accordionBodyCls = lightMode
    ? 'px-5 pb-2 pt-0 border-t border-neutral-100'
    : 'px-5 pb-5 pt-1 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)]/40 space-y-2.5'

  return (
    <div className="space-y-4">
      {/* ── Search Bar ── */}
      <div className="relative">
        <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${searchIconCls}`} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar platos, postres, bebidas..."
          className={searchInputCls}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${clearBtnCls}`}>
            <XCircle size={16} />
          </button>
        )}
      </div>

      {/* ── Accordion ── */}
      {totalFilteredCount === 0 ? (
        <div className={emptyStateCls}>
          <Utensils size={32} className={emptyIconCls} />
          <h3 className={emptyTitleCls}>No hay resultados</h3>
          <p className={emptySubCls}>Prueba escribiendo otra palabra o borrando la búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(category => {
            const items = groupedItems[category] ?? []
            if (items.length === 0) return null

            const isCollapsed    = collapsedCategories[category] ?? false
            const availableCount = items.filter(i => i.available).length

            return (
              <div key={category} className={accordionWrapCls}>
                {/* Header */}
                <button type="button" onClick={() => toggleCategory(category)} className={accordionHeaderCls}>
                  <div className="flex items-center gap-3">
                    <span className={catLabelCls}>{category}</span>
                    <span className={catBadgeCls}>
                      {items.length} {items.length === 1 ? 'plato' : 'platos'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {availableCount > 0 && (
                      <span className="text-green-600 text-[10px] font-semibold hidden sm:inline">
                        ● {availableCount} disponibles
                      </span>
                    )}
                    <div className={chevronWrapCls}>
                      {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </div>
                  </div>
                </button>

                {/* Body */}
                {!isCollapsed && (
                  <div className={accordionBodyCls}>
                    {lightMode
                      ? items.map(item => <LightMenuItemCard key={item.id} item={item} />)
                      : items.map(item => <MenuItemCard key={item.id} item={item} />)
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
