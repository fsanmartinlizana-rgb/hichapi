'use client'

import { useState } from 'react'
import {
  Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight,
  Image, X, Check, ChevronDown, AlertCircle, Loader2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  tags: string[]
  available: boolean
  photo_url?: string
  cost_price?: number
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['entrada', 'principal', 'postre', 'bebida', 'para compartir']

const INITIAL_ITEMS: MenuItem[] = [
  { id: '1', name: 'Lomo vetado', description: 'Con papas fritas y ensalada', price: 15900, category: 'principal', tags: [], available: true, cost_price: 6200 },
  { id: '2', name: 'Pasta arrabiata', description: 'Salsa de tomate picante, albahaca fresca', price: 12900, category: 'principal', tags: ['vegano'], available: true, cost_price: 3100 },
  { id: '3', name: 'Salmón grillado', description: 'Con puré de papas y salsa de limón', price: 16900, category: 'principal', tags: ['sin gluten'], available: true, cost_price: 7800 },
  { id: '4', name: 'Ensalada César', description: 'Lechuga romana, crutones, parmesano', price: 8900, category: 'entrada', tags: [], available: true, cost_price: 2100 },
  { id: '5', name: 'Tiramisú', description: 'Receta italiana tradicional', price: 6900, category: 'postre', tags: ['vegetariano'], available: true, cost_price: 1800 },
  { id: '6', name: 'Gazpacho', description: 'Sopa fría de tomate andaluza', price: 7500, category: 'entrada', tags: ['vegano', 'sin gluten'], available: false, cost_price: 1500 },
  { id: '7', name: 'Pisco sour', description: 'Clásico chileno con pisco 35°', price: 5900, category: 'bebida', tags: [], available: true, cost_price: 900 },
  { id: '8', name: 'Tabla de quesos', description: 'Selección de quesos con frutos secos y mermelada', price: 13900, category: 'para compartir', tags: ['vegetariano'], available: true, cost_price: 4500 },
]

const TAG_OPTIONS = ['vegano', 'vegetariano', 'sin gluten', 'sin lactosa', 'picante', 'popular', 'nuevo']

// ── ItemForm ──────────────────────────────────────────────────────────────────

function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<MenuItem>
  onSave: (item: Omit<MenuItem, 'id'>) => void
  onCancel: () => void
}) {
  const [name, setName]           = useState(initial?.name ?? '')
  const [desc, setDesc]           = useState(initial?.description ?? '')
  const [price, setPrice]         = useState(initial?.price?.toString() ?? '')
  const [cost, setCost]           = useState(initial?.cost_price?.toString() ?? '')
  const [category, setCategory]   = useState(initial?.category ?? 'principal')
  const [tags, setTags]           = useState<string[]>(initial?.tags ?? [])
  const [available, setAvailable] = useState(initial?.available ?? true)
  const [saving, setSaving]       = useState(false)

  function toggleTag(t: string) {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleSave() {
    if (!name || !price) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 400)) // simulate API
    onSave({ name, description: desc, price: parseInt(price), category, tags, available, cost_price: cost ? parseInt(cost) : undefined })
    setSaving(false)
  }

  const margin = price && cost ? Math.round((1 - parseInt(cost) / parseInt(price)) * 100) : null

  return (
    <div className="bg-[#1C1C2E] border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <label className="text-white/50 text-xs">Nombre del plato</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Lomo vetado"
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                       placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-white/50 text-xs">Descripción</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ingredientes, preparación..."
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                       placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs">Precio (CLP)</label>
          <input value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="15900"
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                       placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors font-mono" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-white/50 text-xs">Costo (opcional)</label>
            {margin !== null && (
              <span className={`text-[10px] font-semibold ${margin > 60 ? 'text-emerald-400' : margin > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                {margin}% margen
              </span>
            )}
          </div>
          <input value={cost} onChange={e => setCost(e.target.value.replace(/\D/g, ''))} placeholder="6200"
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                       placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors font-mono" />
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs">Categoría</label>
          <div className="relative">
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full appearance-none px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                         focus:outline-none focus:border-[#FF6B35]/50 transition-colors">
              {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#1C1C2E]">{c}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs">Disponible</label>
          <button onClick={() => setAvailable(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all w-full
              ${available ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/8 text-white/30'}`}>
            {available ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {available ? 'Disponible' : 'No disponible'}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-white/50 text-xs">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {TAG_OPTIONS.map(t => (
            <button key={t} onClick={() => toggleTag(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all
                ${tags.includes(t) ? 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]' : 'bg-white/3 border-white/8 text-white/30 hover:border-white/20'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:border-white/20 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={!name || !price || saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm
                     font-semibold hover:bg-[#e85d2a] disabled:opacity-40 transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? 'Guardando...' : 'Guardar plato'}
        </button>
      </div>
    </div>
  )
}

// ── ItemRow ───────────────────────────────────────────────────────────────────

function ItemRow({ item, onEdit, onDelete, onToggle }: {
  item: MenuItem
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const margin = item.cost_price ? Math.round((1 - item.cost_price / item.price) * 100) : null

  return (
    <div className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all
      ${item.available ? 'bg-[#1C1C2E] border-white/5 hover:border-white/10' : 'bg-white/2 border-white/3 opacity-60'}`}>
      {/* Photo placeholder */}
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
        <Image size={14} className="text-white/20" />
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-white text-sm font-semibold truncate">{item.name}</p>
          {item.tags.map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35]/80 border border-[#FF6B35]/20 shrink-0">
              {t}
            </span>
          ))}
        </div>
        <p className="text-white/30 text-xs truncate">{item.description}</p>
      </div>
      {/* Price + margin */}
      <div className="text-right shrink-0">
        <p className="text-white font-semibold text-sm font-mono">${(item.price / 1000).toFixed(1)}k</p>
        {margin !== null && (
          <p className={`text-[10px] font-mono ${margin > 60 ? 'text-emerald-400/70' : margin > 40 ? 'text-yellow-400/70' : 'text-red-400/70'}`}>
            {margin}% margen
          </p>
        )}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onToggle}
          className={`p-1.5 rounded-lg transition-colors ${item.available ? 'text-emerald-400 hover:bg-emerald-400/10' : 'text-white/20 hover:bg-white/5'}`}>
          {item.available ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
        </button>
        <button onClick={onEdit} className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors">
          <Edit2 size={13} />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CartaPage() {
  const [items, setItems]         = useState<MenuItem[]>(INITIAL_ITEMS)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('todas')
  const [adding, setAdding]       = useState(false)
  const [editing, setEditing]     = useState<string | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)

  const cats = ['todas', ...CATEGORIES]

  const filtered = items
    .filter(i => catFilter === 'todas' || i.category === catFilter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()))

  function addItem(data: Omit<MenuItem, 'id'>) {
    setItems(prev => [...prev, { ...data, id: Date.now().toString() }])
    setAdding(false)
  }

  function updateItem(id: string, data: Omit<MenuItem, 'id'>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))
    setEditing(null)
  }

  function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    setDeleting(null)
  }

  function toggleItem(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, available: !i.available } : i))
  }

  const stats = {
    total: items.length,
    available: items.filter(i => i.available).length,
    avgMargin: items.filter(i => i.cost_price).length > 0
      ? Math.round(items.filter(i => i.cost_price).reduce((s, i) => s + (1 - i.cost_price! / i.price) * 100, 0) / items.filter(i => i.cost_price).length)
      : null,
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Carta digital</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-white/35">
            <span>{stats.total} platos</span>
            <span>·</span>
            <span className="text-emerald-400/80">{stats.available} disponibles</span>
            {stats.avgMargin !== null && <><span>·</span><span className="text-[#FF6B35]/70">{stats.avgMargin}% margen promedio</span></>}
          </div>
        </div>
        <button onClick={() => setAdding(true)} disabled={adding}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold
                     hover:bg-[#e85d2a] disabled:opacity-50 transition-colors">
          <Plus size={14} /> Agregar plato
        </button>
      </div>

      {/* Add form */}
      {adding && <ItemForm onSave={addItem} onCancel={() => setAdding(false)} />}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar plato..."
            className="pl-8 pr-4 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                       placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/40 w-44 transition-colors" />
        </div>
        <div className="flex gap-1 bg-white/3 border border-white/6 rounded-xl p-1">
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1 rounded-lg text-xs capitalize transition-all
                ${catFilter === c ? 'bg-[#FF6B35] text-white font-medium' : 'text-white/35 hover:text-white/60'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Items by category */}
      <div className="space-y-6">
        {(catFilter === 'todas' ? CATEGORIES : [catFilter]).map(cat => {
          const catItems = filtered.filter(i => i.category === cat)
          if (catItems.length === 0) return null
          return (
            <div key={cat}>
              <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2 capitalize">{cat}</h3>
              <div className="space-y-2">
                {catItems.map(item => (
                  editing === item.id
                    ? <ItemForm key={item.id} initial={item}
                        onSave={(data) => updateItem(item.id, data)}
                        onCancel={() => setEditing(null)} />
                    : <ItemRow key={item.id} item={item}
                        onEdit={() => setEditing(item.id)}
                        onDelete={() => setDeleting(item.id)}
                        onToggle={() => toggleItem(item.id)} />
                ))}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-white/20">
            <p className="text-sm">No hay platos que coincidan</p>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1C1C2E] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold">¿Eliminar plato?</p>
                <p className="text-white/40 text-sm mt-1">
                  "{items.find(i => i.id === deleting)?.name}" se eliminará permanentemente de la carta.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleting(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:border-white/20 transition-colors">
                Cancelar
              </button>
              <button onClick={() => deleteItem(deleting)}
                className="flex-1 py-2.5 rounded-xl bg-red-500/80 text-white text-sm font-semibold hover:bg-red-500 transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
