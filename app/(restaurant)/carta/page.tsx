'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight,
  Image, X, Check, ChevronDown, AlertCircle, Loader2, Camera, RefreshCw,
  ChefHat, Wine, Package, BookOpen,
} from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import { EmptyState } from '@/components/ui/EmptyState'
import { TagPicker } from '@/components/ui/TagPicker'
import { MENU_ITEM_TAG_GROUPS } from '@/lib/tags/catalog'
import { ImportMenuModal } from '@/components/carta/ImportMenuModal'
import { Sparkles } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Destination = 'cocina' | 'barra' | 'ninguno'

interface Ingredient {
  stock_item_id: string
  qty: number
}

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
  destination: Destination
  ingredients?: Ingredient[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['entrada', 'principal', 'postre', 'bebida', 'para compartir']

type ProductType = 'plato' | 'postre' | 'bebestible' | 'entrada' | 'otro'

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'plato',       label: 'Plato' },
  { value: 'postre',      label: 'Postre' },
  { value: 'bebestible',  label: 'Bebestible' },
  { value: 'entrada',     label: 'Entrada' },
  { value: 'otro',        label: 'Otro' },
]

const CATEGORIES_BY_PRODUCT_TYPE: Record<ProductType, string[]> = {
  plato:       ['principal', 'para compartir'],
  postre:      ['postre'],
  bebestible:  ['bebida'],
  entrada:     ['entrada'],
  otro:        CATEGORIES,
}

const DESTINATIONS: { value: Destination; label: string; icon: typeof ChefHat; hint: string }[] = [
  { value: 'cocina',  label: 'Cocina',  icon: ChefHat, hint: 'Va a la pantalla de cocina' },
  { value: 'barra',   label: 'Barra',   icon: Wine,    hint: 'Va a la pantalla de barra' },
  { value: 'ninguno', label: 'Sin prep', icon: Package, hint: 'No requiere preparación' },
]

// ── ItemForm ─────────────────────────────────────────────────────────────────

function ItemForm({
  initial,
  stockItems,
  onSave,
  onCancel,
}: {
  initial?: Partial<MenuItem>
  stockItems: { id: string; name: string; unit: string }[]
  onSave: (item: Omit<MenuItem, 'id'>) => Promise<void>
  onCancel: () => void
}) {
  // Infer initial product type from category
  function inferProductType(cat: string): ProductType {
    if (['principal', 'para compartir'].includes(cat)) return 'plato'
    if (cat === 'postre') return 'postre'
    if (cat === 'bebida') return 'bebestible'
    if (cat === 'entrada') return 'entrada'
    return 'otro'
  }

  const [name, setName]               = useState(initial?.name ?? '')
  const [desc, setDesc]               = useState(initial?.description ?? '')
  const [price, setPrice]             = useState(initial?.price?.toString() ?? '')
  const [cost, setCost]               = useState(initial?.cost_price?.toString() ?? '')
  const [productType, setProductType] = useState<ProductType>(inferProductType(initial?.category ?? 'principal'))
  const [category, setCategory]       = useState(initial?.category ?? 'principal')
  const [tags, setTags]               = useState<string[]>(initial?.tags ?? [])
  const [available, setAvailable]     = useState(initial?.available ?? true)
  const [destination, setDestination] = useState<Destination>(initial?.destination ?? 'cocina')
  const [ingredients, setIngredients] = useState<Ingredient[]>(initial?.ingredients ?? [])
  const [saving, setSaving]           = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.photo_url ?? null)

  function addIngredient() {
    if (stockItems.length === 0) return
    setIngredients(prev => [...prev, { stock_item_id: stockItems[0].id, qty: 0 }])
  }
  function removeIngredient(i: number) {
    setIngredients(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateIngredient(i: number, patch: Partial<Ingredient>) {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, ...patch } : ing))
  }

  const availableCategories = CATEGORIES_BY_PRODUCT_TYPE[productType]

  function handleProductTypeChange(pt: ProductType) {
    setProductType(pt)
    const cats = CATEGORIES_BY_PRODUCT_TYPE[pt]
    if (!cats.includes(category)) {
      setCategory(cats[0])
    }
  }

  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPhotoPreview(url)
  }

  function removePhoto() {
    setPhotoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSave() {
    if (!name || !price) return
    setSaving(true)
    try {
      await onSave({
        name,
        description: desc,
        price: parseInt(price),
        category,
        tags,
        available,
        destination,
        cost_price: cost ? parseInt(cost) : undefined,
        photo_url: photoPreview ?? undefined,
        ingredients: ingredients.filter(i => i.qty > 0 && i.stock_item_id),
      })
    } finally {
      setSaving(false)
    }
  }

  const margin = price && cost ? Math.round((1 - parseInt(cost) / parseInt(price)) * 100) : null

  return (
    <div className="bg-[#1C1C2E] border border-white/10 rounded-2xl p-5 space-y-4">

      {/* Photo upload zone */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {photoPreview ? (
        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-white/10">
          <img
            src={photoPreview}
            alt="Vista previa"
            className="w-full h-full object-cover"
          />
          <button
            onClick={removePhoto}
            className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full h-40 rounded-xl border-2 border-dashed border-white/15 bg-white/3 hover:border-[#FF6B35]/40 hover:bg-[#FF6B35]/5 transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <Camera size={22} className="text-white/25 group-hover:text-[#FF6B35]/60 transition-colors" />
          <span className="text-white/35 group-hover:text-white/50 text-sm font-medium transition-colors">
            Subir foto
          </span>
          <span className="text-white/20 text-[10px]">Max 5MB · JPG, PNG, WebP</span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <label className="text-white/50 text-xs">Nombre del producto</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Lomo vetado"
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-white/50 text-xs">Descripción</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ingredientes, preparación..."
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs">Precio (CLP)</label>
          <input value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="15900"
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors font-mono" />
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
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors font-mono" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-white/50 text-xs">Tipo de producto</label>
          <div className="flex gap-2 flex-wrap">
            {PRODUCT_TYPES.map(pt => (
              <button
                key={pt.value}
                type="button"
                onClick={() => handleProductTypeChange(pt.value)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all
                  ${productType === pt.value
                    ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35]'
                    : 'bg-white/3 border-white/8 text-white/40 hover:border-white/20 hover:text-white/60'}`}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs">Categoría</label>
          <div className="relative">
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full appearance-none px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors">
              {availableCategories.map(c => <option key={c} value={c} className="bg-[#1C1C2E]">{c}</option>)}
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
        <label className="text-white/50 text-xs">Tags · ayuda a que Chapi y los buscadores de IA recomienden este producto</label>
        <TagPicker
          groups={MENU_ITEM_TAG_GROUPS}
          selected={tags}
          onChange={setTags}
          max={15}
          allowCustom
          size="sm"
        />
      </div>
      {/* Destino de comanda */}
      <div className="space-y-1.5">
        <label className="text-white/50 text-xs">Destino de comanda</label>
        <div className="grid grid-cols-3 gap-2">
          {DESTINATIONS.map(d => {
            const Icon = d.icon
            const active = destination === d.value
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => setDestination(d.value)}
                className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition-all
                  ${active
                    ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35]'
                    : 'bg-white/3 border-white/8 text-white/40 hover:border-white/20 hover:text-white/60'}`}
              >
                <Icon size={14} />
                <span className="text-xs font-semibold">{d.label}</span>
                <span className="text-[10px] opacity-70 leading-tight">{d.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      {/* Ingredientes / Gramaje */}
      <div className="space-y-2 border-t border-white/5 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-white/70 text-xs font-semibold">Ingredientes y gramaje</label>
            <p className="text-white/35 text-[10px] mt-0.5">
              Se descuenta del stock automáticamente al confirmar pedido
            </p>
          </div>
          {stockItems.length > 0 && (
            <button
              type="button"
              onClick={addIngredient}
              className="text-[#FF6B35] text-xs hover:text-[#ff8255] flex items-center gap-1 transition-colors"
            >
              <Plus size={11} /> Agregar
            </button>
          )}
        </div>
        {stockItems.length === 0 ? (
          <p className="text-white/30 text-[11px] px-3 py-2 rounded-lg bg-white/3 border border-white/6">
            Primero registra ingredientes en <span className="text-[#FF6B35]">Stock</span> para poder asociarlos.
          </p>
        ) : ingredients.length === 0 ? (
          <p className="text-white/30 text-[11px] px-3 py-2 rounded-lg bg-white/3 border border-white/6">
            Sin ingredientes. No se descontará stock al vender este producto.
          </p>
        ) : (
          <div className="space-y-1.5">
            {ingredients.map((ing, i) => {
              const stockItem = stockItems.find(s => s.id === ing.stock_item_id)
              return (
                <div key={i} className="flex gap-1.5">
                  <select
                    value={ing.stock_item_id}
                    onChange={e => updateIngredient(i, { stock_item_id: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-xs focus:outline-none focus:border-[#FF6B35]/50 appearance-none"
                  >
                    {stockItems.map(s => (
                      <option key={s.id} value={s.id} className="bg-[#1C1C2E]">{s.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={ing.qty || ''}
                    onChange={e => updateIngredient(i, { qty: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                    placeholder="0"
                    className="w-20 px-2 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-xs focus:outline-none focus:border-[#FF6B35]/50 text-right font-mono"
                  />
                  <span className="px-2 py-2 rounded-xl bg-white/3 border border-white/6 text-white/40 text-xs min-w-[50px] text-center">
                    {stockItem?.unit ?? '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeIngredient(i)}
                    className="w-9 px-2 py-2 rounded-xl bg-white/3 hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:border-white/20 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={!name || !price || saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40 transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? 'Guardando...' : 'Guardar producto'}
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
      {/* Photo thumbnail */}
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0 overflow-hidden">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <Image size={14} className="text-white/20" />
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-white text-sm font-semibold truncate">{item.name}</p>
          {item.destination !== 'cocina' && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 inline-flex items-center gap-1
              ${item.destination === 'barra'
                ? 'bg-purple-500/15 text-purple-300/90 border-purple-500/25'
                : 'bg-white/5 text-white/40 border-white/10'}`}>
              {item.destination === 'barra' ? <Wine size={9} /> : <Package size={9} />}
              {item.destination === 'barra' ? 'barra' : 'sin prep'}
            </span>
          )}
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
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [items, setItems]         = useState<MenuItem[]>([])
  const [stockItems, setStockItems] = useState<{ id: string; name: string; unit: string }[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('todas')
  const [adding, setAdding]       = useState(false)
  const [editing, setEditing]     = useState<string | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  // ── Load stock items (for ingredient association) ────────────────────────
  useEffect(() => {
    if (!restId) return
    fetch(`/api/stock?restaurant_id=${restId}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.items)) {
          setStockItems(d.items.map((s: Record<string, unknown>) => ({
            id:   s.id as string,
            name: s.name as string,
            unit: (s.unit as string) || 'unidad',
          })))
        }
      })
      .catch(err => console.error('Error loading stock items:', err))
  }, [restId])

  // ── Load items from API ──────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/menu-items?restaurant_id=${restId}`)
      const data = await res.json()
      if (data.items) {
        setItems(data.items.map((i: Record<string, unknown>) => ({
          id:          i.id as string,
          name:        i.name as string,
          description: (i.description as string) || '',
          price:       i.price as number,
          category:    (i.category as string) || 'principal',
          tags:        (i.tags as string[]) || [],
          available:   i.available !== false,
          photo_url:   (i.photo_url as string) || undefined,
          cost_price:  (i.cost_price as number) || undefined,
          destination: ((i.destination as Destination) || 'cocina'),
          // Defensive filter: data legacy puede venir como string[] (nombres
          // sueltos) en vez de {stock_item_id, qty}[]. Si accedemos a .qty o
          // .stock_item_id sobre un string, la página entera se cae al
          // renderizar. Filtramos para dejar solo objetos válidos.
          ingredients: Array.isArray(i.ingredients)
            ? (i.ingredients as unknown[]).filter(
                (ing): ing is Ingredient =>
                  typeof ing === 'object' &&
                  ing !== null &&
                  'stock_item_id' in ing &&
                  'qty' in ing,
              )
            : [],
        })))
      }
    } catch (err) {
      console.error('Error loading menu items:', err)
    }
    setLoading(false)
  }, [restId])

  useEffect(() => { loadItems() }, [loadItems])

  // ── CRUD handlers ────────────────────────────────────────────────────────
  async function addItem(data: Omit<MenuItem, 'id'>) {
    const res = await fetch('/api/menu-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, restaurant_id: restId }),
    })
    const result = await res.json()
    if (result.item) {
      setItems(prev => [...prev, {
        ...result.item,
        description: result.item.description || '',
        tags: result.item.tags || [],
      }])
      setAdding(false)
    }
  }

  async function updateItem(id: string, data: Omit<MenuItem, 'id'>) {
    const res = await fetch('/api/menu-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restaurant_id: restId, ...data }),
    })
    const result = await res.json()
    if (result.item) {
      setItems(prev => prev.map(i => i.id === id ? {
        ...result.item,
        description: result.item.description || '',
        tags: result.item.tags || [],
      } : i))
      setEditing(null)
    }
  }

  async function deleteItem(id: string) {
    const res = await fetch('/api/menu-items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restaurant_id: restId }),
    })
    const result = await res.json()
    if (result.ok) {
      setItems(prev => prev.filter(i => i.id !== id))
      setDeleting(null)
    }
  }

  async function toggleItem(id: string) {
    const item = items.find(i => i.id === id)
    if (!item) return
    // Optimistic update
    setItems(prev => prev.map(i => i.id === id ? { ...i, available: !i.available } : i))
    await fetch('/api/menu-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restaurant_id: restId, available: !item.available }),
    })
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const cats = ['todas', ...CATEGORIES]
  const allCategories = [...new Set(items.map(i => i.category))]
  const displayCategories = catFilter === 'todas'
    ? [...CATEGORIES, ...allCategories.filter(c => !CATEGORIES.includes(c))]
    : [catFilter]

  const filtered = items
    .filter(i => catFilter === 'todas' || i.category === catFilter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()))

  const stats = {
    total: items.length,
    available: items.filter(i => i.available).length,
    avgMargin: items.filter(i => i.cost_price).length > 0
      ? Math.round(items.filter(i => i.cost_price).reduce((s, i) => s + (1 - i.cost_price! / i.price) * 100, 0) / items.filter(i => i.cost_price).length)
      : null,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw size={20} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Carta digital</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-white/35">
            <span>{stats.total} productos</span>
            <span>·</span>
            <span className="text-emerald-400/80">{stats.available} disponibles</span>
            {stats.avgMargin !== null && <><span>·</span><span className="text-[#FF6B35]/70">{stats.avgMargin}% margen promedio</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadItems} className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-white transition-colors">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-[#FF6B35]/40 text-sm font-medium transition-colors"
          >
            <Sparkles size={13} className="text-[#FF6B35]" /> Importar carta
          </button>
          <button onClick={() => setAdding(true)} disabled={adding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-50 transition-colors">
            <Plus size={14} /> Agregar producto
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && <ItemForm stockItems={stockItems} onSave={addItem} onCancel={() => setAdding(false)} />}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..."
            className="pl-8 pr-4 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/40 w-44 transition-colors" />
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

      {/* Empty state */}
      {items.length === 0 && !adding && (
        <EmptyState
          icon={BookOpen}
          title="Tu carta está vacía"
          description="Agrega tu primer producto y se publicará automáticamente en tu perfil de HiChapi"
          action={{ label: 'Agregar primer producto', onClick: () => setAdding(true) }}
        />
      )}

      {/* Items by category */}
      <div className="space-y-6">
        {displayCategories.map(cat => {
          const catItems = filtered.filter(i => i.category === cat)
          if (catItems.length === 0) return null
          return (
            <div key={cat}>
              <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2 capitalize">{cat}</h3>
              <div className="space-y-2">
                {catItems.map(item => (
                  editing === item.id
                    ? <ItemForm key={item.id} initial={item}
                        stockItems={stockItems}
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
        {filtered.length === 0 && items.length > 0 && (
          <EmptyState
            icon={Search}
            title="No hay productos que coincidan"
            description="Prueba con otra búsqueda o limpia los filtros"
          />
        )}
      </div>

      {/* Sync notice */}
      {items.length > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3 flex items-center gap-2">
          <Check size={14} className="text-emerald-400 shrink-0" />
          <p className="text-emerald-400/70 text-xs">
            Los cambios se sincronizan automáticamente con tu perfil público en HiChapi Discovery.
          </p>
        </div>
      )}

      {/* Import modal */}
      {importing && restId && (
        <ImportMenuModal
          restaurantId={restId}
          onClose={() => setImporting(false)}
          onImported={() => { loadItems(); }}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1C1C2E] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold">¿Eliminar producto?</p>
                <p className="text-white/40 text-sm mt-1">
                  &quot;{items.find(i => i.id === deleting)?.name}&quot; se eliminará permanentemente de la carta.
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
