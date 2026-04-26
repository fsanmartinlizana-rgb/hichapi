'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Package, AlertTriangle, ShoppingCart, Upload, List,
  Plus, Filter, Pencil, SlidersHorizontal, Trash2, FlaskConical,
  X, Check, ChevronRight, FileText, Send, RotateCcw,
} from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import { useStockAlerts } from '@/lib/stock/useStockAlerts'
import { useStockRealtime } from '@/lib/stock/useStockRealtime'
import type { StockItem } from '@/lib/stock/useStockAlerts'
import { formatCurrency } from '@/lib/i18n'

type StockTab = 'inventario' | 'movimientos' | 'importar' | 'ordenes'
const UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja', 'onza'] as const
type Unit = typeof UNITS[number]

const WASTE_REASONS = [
  { value: 'vencimiento', label: 'Vencimiento' },
  { value: 'deterioro', label: 'Deterioro' },
  { value: 'rotura', label: 'Rotura' },
  { value: 'error_prep', label: 'Error de preparación' },
  { value: 'sobras', label: 'Sobras' },
  { value: 'merma', label: 'Merma general' },
  { value: 'otro', label: 'Otro' },
] as const

function TabButton({ active, icon: Icon, children, onClick, badge }: {
  active: boolean
  icon: React.ComponentType<{ size?: number; className?: string }>
  children: React.ReactNode
  onClick: () => void
  badge?: number
}) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${active ? 'border-[#FF6B35] text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}>
      <Icon size={14} />
      {children}
      {badge != null && badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold flex items-center justify-center">{badge}</span>
      )}
    </button>
  )
}

function PlaceholderTab({ label }: { label: string }) {
  return <div className="flex items-center justify-center py-20 text-white/25 text-sm">{label} — próximamente</div>
}

type ImportPreview = {
  import_id: string
  productos_preview: { nombre: string; unidad: string; cantidad: number; costo: number }[]
  recetas_preview: { preparacion: string; producto: string; cantidad: number }[]
  errores: { fila: number; razon: string }[]
}

type ImportSummary = {
  creados: number
  actualizados: number
  recetas_procesadas: number
  errores: number
}

function ImportarTab({ restaurantId }: { restaurantId: string }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
  const VALID_EXTS = ['.xlsx', '.csv']

  function validateFile(f: File): string {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase()
    if (!VALID_EXTS.includes(ext)) return 'Solo se aceptan archivos .xlsx o .csv'
    if (f.size > MAX_SIZE) return `El archivo supera el límite de 10 MB (${(f.size / 1024 / 1024).toFixed(1)} MB)`
    return ''
  }

  function handleFileSelect(f: File) {
    const err = validateFile(f)
    setFileError(err)
    setFile(err ? null : f)
    setPreview(null)
    setSummary(null)
    setUploadError('')
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave() {
    setDragging(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFileSelect(f)
  }

  async function downloadTemplate() {
    const res = await fetch('/api/stock/import/template')
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_stock.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function processFile() {
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('restaurant_id', restaurantId)
      const res = await fetch('/api/stock/import', { method: 'POST', body: form })
      if (!res.ok) {
        const d = await res.json()
        setUploadError(d.error ?? 'Error al procesar el archivo')
        return
      }
      const data = await res.json()
      setPreview(data)
    } catch {
      setUploadError('Error de red')
    } finally {
      setUploading(false)
    }
  }

  async function confirmImport() {
    if (!preview) return
    setConfirming(true)
    setConfirmError('')
    try {
      const res = await fetch('/api/stock/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ import_id: preview.import_id }),
      })
      if (!res.ok) {
        const d = await res.json()
        setConfirmError(d.error ?? 'Error al confirmar importación')
        return
      }
      const data = await res.json()
      setSummary(data)
      setPreview(null)
    } catch {
      setConfirmError('Error de red')
    } finally {
      setConfirming(false)
    }
  }

  function reset() {
    setFile(null)
    setFileError('')
    setUploadError('')
    setPreview(null)
    setSummary(null)
    setConfirmError('')
  }

  if (summary) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Check size={18} className="text-green-400" />
            <h3 className="text-green-300 font-semibold text-sm">Importación completada</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/40 text-xs mb-1">Productos creados</p>
              <p className="text-white text-xl font-bold">{summary.creados}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/40 text-xs mb-1">Productos actualizados</p>
              <p className="text-white text-xl font-bold">{summary.actualizados}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/40 text-xs mb-1">Recetas procesadas</p>
              <p className="text-white text-xl font-bold">{summary.recetas_procesadas}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/40 text-xs mb-1">Filas con error</p>
              <p className={`text-xl font-bold ${summary.errores > 0 ? 'text-amber-400' : 'text-white'}`}>{summary.errores}</p>
            </div>
          </div>
        </div>
        <button onClick={reset} className="flex items-center gap-2 px-4 py-2 text-sm bg-white/10 text-white rounded-lg hover:bg-white/15 transition-colors">
          <Upload size={14} />Importar otro archivo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Dropzone */}
      {!preview && (
        <div className="space-y-3">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => document.getElementById('import-file-input')?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-[#FF6B35]/60 bg-[#FF6B35]/5' : 'border-white/15 hover:border-white/30 bg-white/3'}`}
          >
            <Upload size={28} className={dragging ? 'text-[#FF6B35]' : 'text-white/30'} />
            {file ? (
              <div className="text-center">
                <p className="text-white text-sm font-medium">{file.name}</p>
                <p className="text-white/40 text-xs mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-white/60 text-sm">Arrastra tu archivo aquí o haz clic para seleccionar</p>
                <p className="text-white/30 text-xs mt-1">Formatos aceptados: .xlsx, .csv — máximo 10 MB</p>
              </div>
            )}
            <input id="import-file-input" type="file" accept=".xlsx,.csv" className="hidden" onChange={onInputChange} />
          </div>

          {fileError && <p className="text-red-400 text-xs">{fileError}</p>}
          {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={processFile}
              disabled={!file || uploading}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#FF6B35]/80 disabled:opacity-40 transition-colors"
            >
              <Upload size={14} />
              {uploading ? 'Procesando…' : 'Procesar archivo'}
            </button>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-white/8 text-white/70 rounded-lg hover:bg-white/12 hover:text-white transition-colors border border-white/10"
            >
              Descargar plantilla
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-5">
          {/* Productos preview */}
          {preview.productos_preview.length > 0 && (
            <div>
              <h3 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                Productos detectados ({preview.productos_preview.length})
              </h3>
              <div className="bg-white/3 rounded-2xl border border-white/8 overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left text-white/40 text-xs font-medium px-4 py-2.5">Nombre</th>
                      <th className="text-left text-white/40 text-xs font-medium px-3 py-2.5">Unidad</th>
                      <th className="text-right text-white/40 text-xs font-medium px-3 py-2.5">Cantidad</th>
                      <th className="text-right text-white/40 text-xs font-medium px-4 py-2.5">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.productos_preview.map((p, i) => (
                      <tr key={i} className={i < preview.productos_preview.length - 1 ? 'border-b border-white/5' : ''}>
                        <td className="px-4 py-2.5 text-white">{p.nombre}</td>
                        <td className="px-3 py-2.5 text-white/50">{p.unidad}</td>
                        <td className="px-3 py-2.5 text-right text-white/70 font-mono">{p.cantidad}</td>
                        <td className="px-4 py-2.5 text-right text-white/70">{formatCurrency(p.costo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recetas preview */}
          {preview.recetas_preview.length > 0 && (
            <div>
              <h3 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                Recetas detectadas ({preview.recetas_preview.length})
              </h3>
              <div className="bg-white/3 rounded-2xl border border-white/8 overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left text-white/40 text-xs font-medium px-4 py-2.5">Preparación</th>
                      <th className="text-left text-white/40 text-xs font-medium px-3 py-2.5">Producto</th>
                      <th className="text-right text-white/40 text-xs font-medium px-4 py-2.5">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.recetas_preview.map((r, i) => (
                      <tr key={i} className={i < preview.recetas_preview.length - 1 ? 'border-b border-white/5' : ''}>
                        <td className="px-4 py-2.5 text-white">{r.preparacion}</td>
                        <td className="px-3 py-2.5 text-white/50">{r.producto}</td>
                        <td className="px-4 py-2.5 text-right text-white/70 font-mono">{r.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errores */}
          {preview.errores.length > 0 && (
            <div>
              <h3 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                Filas con error ({preview.errores.length})
              </h3>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 space-y-1.5">
                {preview.errores.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-amber-400/60 font-mono shrink-0">Fila {e.fila}</span>
                    <span className="text-amber-300/70">{e.razon}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {confirmError && <p className="text-red-400 text-xs">{confirmError}</p>}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={confirmImport}
              disabled={confirming}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#FF6B35]/80 disabled:opacity-40 transition-colors"
            >
              <Check size={14} />
              {confirming ? 'Confirmando…' : 'Confirmar importación'}
            </button>
            <button onClick={reset} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ item }: { item: StockItem }) {
  if (item.current_qty < 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-400">Negativo</span>
  if (item.current_qty <= item.min_qty) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400">Bajo mínimo</span>
  return null
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold text-sm">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-white/50 text-xs">{label}</label>{children}</div>
}

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#FF6B35]/50'

function ProductModal({ restaurantId, item, onClose, onSaved }: { restaurantId: string; item?: StockItem | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!item
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: item?.name ?? '', unit: (item?.unit ?? 'unidad') as Unit,
    current_qty: item?.current_qty?.toString() ?? '0', min_qty: item?.min_qty?.toString() ?? '0',
    cost_per_unit: item?.cost_per_unit?.toString() ?? '0', category: item?.category ?? '', supplier: item?.supplier ?? '',
    expiry_date: item?.expiry_date ?? '',
    shelf_life_days: item?.shelf_life_days?.toString() ?? '',
    lot_number: item?.lot_number ?? '',
    alert_days_before: item?.alert_days_before?.toString() ?? '3',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = {
        ...(isEdit ? { id: item!.id } : { restaurant_id: restaurantId }),
        name: form.name,
        unit: form.unit,
        current_qty: parseFloat(form.current_qty) || 0,
        min_qty: parseFloat(form.min_qty) || 0,
        cost_per_unit: parseInt(form.cost_per_unit) || 0,
        category: form.category || undefined,
        supplier: form.supplier || undefined,
        expiry_date: form.expiry_date || null,
        shelf_life_days: form.shelf_life_days ? parseInt(form.shelf_life_days) : null,
        lot_number: form.lot_number || null,
        alert_days_before: parseInt(form.alert_days_before) || 3,
      }
      const res = await fetch('/api/stock', { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error al guardar'); return }
      onSaved(); onClose()
    } catch { setError('Error de red') } finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nombre *"><input className={inputCls} value={form.name} onChange={set('name')} required placeholder="Ej: Lomo Liso" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unidad *"><select className={inputCls} value={form.unit} onChange={set('unit')}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></Field>
          <Field label="Categoría"><input className={inputCls} value={form.category} onChange={set('category')} placeholder="Ej: Carnes" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad inicial"><input className={inputCls} type="number" step="0.001" inputMode="decimal" value={form.current_qty} onChange={set('current_qty')} /></Field>
          <Field label="Cantidad mínima"><input className={inputCls} type="number" step="0.001" inputMode="decimal" value={form.min_qty} onChange={set('min_qty')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Costo/unidad (CLP)"><input className={inputCls} type="number" step="1" inputMode="numeric" value={form.cost_per_unit} onChange={set('cost_per_unit')} /></Field>
          <Field label="Proveedor"><input className={inputCls} value={form.supplier} onChange={set('supplier')} placeholder="Opcional" /></Field>
        </div>

        {/* Trazabilidad y vencimiento */}
        <div className="pt-2 border-t border-white/8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2">Trazabilidad y vencimiento</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vence el"><input className={inputCls} type="date" value={form.expiry_date} onChange={set('expiry_date')} /></Field>
            <Field label="Vida útil (días)"><input className={inputCls} type="number" inputMode="numeric" min="0" value={form.shelf_life_days} onChange={set('shelf_life_days')} placeholder="Opcional" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Número de lote"><input className={inputCls} value={form.lot_number} onChange={set('lot_number')} placeholder="Ej: L-2026-04-A" /></Field>
            <Field label="Aviso días antes"><input className={inputCls} type="number" inputMode="numeric" min="0" max="90" value={form.alert_days_before} onChange={set('alert_days_before')} /></Field>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#FF6B35]/80 disabled:opacity-50 transition-colors">{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}</button>
        </div>
      </form>
    </Modal>
  )
}

function AdjustModal({ item, onClose, onSaved }: { item: StockItem; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const d = parseFloat(delta)
    if (!d || d === 0) { setError('El delta no puede ser cero'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/stock/adjust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock_item_id: item.id, delta: d, reason: reason || undefined }) })
      if (!res.ok) { const d2 = await res.json(); setError(d2.error ?? 'Error al ajustar'); return }
      onSaved(); onClose()
    } catch { setError('Error de red') } finally { setSaving(false) }
  }

  return (
    <Modal title={`Ajustar stock — ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-white/40 text-xs">Cantidad actual: <span className="text-white font-medium">{item.current_qty} {item.unit}</span></p>
        <Field label="Delta (positivo = entrada, negativo = salida) *"><input className={inputCls} type="number" step="0.001" value={delta} onChange={e => setDelta(e.target.value)} placeholder="Ej: 5 o -2" required /></Field>
        <Field label="Razón (opcional)"><input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: Conteo físico" /></Field>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#FF6B35]/80 disabled:opacity-50 transition-colors">{saving ? 'Ajustando…' : 'Aplicar ajuste'}</button>
        </div>
      </form>
    </Modal>
  )
}

function MermaModal({ item, onClose, onSaved }: { item: StockItem; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState<string>(WASTE_REASONS[0].value)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = parseFloat(qty)
    if (!q || q <= 0) { setError('La cantidad debe ser mayor a cero'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/mermas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurant_id: item.restaurant_id, stock_item_id: item.id, qty_lost: q, reason }) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error al registrar merma'); return }
      onSaved(); onClose()
    } catch { setError('Error de red') } finally { setSaving(false) }
  }

  return (
    <Modal title={`Registrar merma — ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-white/40 text-xs">Cantidad actual: <span className="text-white font-medium">{item.current_qty} {item.unit}</span></p>
        <Field label="Cantidad perdida *"><input className={inputCls} type="number" step="0.001" min="0.001" value={qty} onChange={e => setQty(e.target.value)} placeholder="Ej: 1.5" required /></Field>
        <Field label="Razón *"><select className={inputCls} value={reason} onChange={e => setReason(e.target.value)}>{WASTE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-500/80 disabled:opacity-50 transition-colors">{saving ? 'Registrando…' : 'Registrar merma'}</button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteModal({ item, onClose, onDeleted }: { item: StockItem; onClose: () => void; onDeleted: (action: 'deactivated' | 'deleted') => void }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true); setError('')
    try {
      const res = await fetch(`/api/stock?id=${item.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error al eliminar'); return }
      const d = await res.json(); onDeleted(d.action); onClose()
    } catch { setError('Error de red') } finally { setDeleting(false) }
  }

  return (
    <Modal title="Eliminar producto" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-white/70 text-sm">¿Eliminar <span className="text-white font-medium">{item.name}</span>? Si tiene movimientos recientes será marcado como inactivo.</p>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-500/80 disabled:opacity-50 transition-colors">{deleting ? 'Eliminando…' : 'Eliminar'}</button>
        </div>
      </div>
    </Modal>
  )
}

type ModalState = { type: 'create' } | { type: 'edit'; item: StockItem } | { type: 'adjust'; item: StockItem } | { type: 'merma'; item: StockItem } | { type: 'delete'; item: StockItem } | null

function InventarioTab({ restaurantId }: { restaurantId: string }) {
  const { items, loading, refetch } = useStockRealtime(restaurantId)
  const [filterBelowMin, setFilterBelowMin] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)
  const [deleteToast, setDeleteToast] = useState<string | null>(null)

  const displayItems = useMemo(() => filterBelowMin ? items.filter(i => i.current_qty <= i.min_qty) : items, [items, filterBelowMin])

  const grouped = useMemo(() => {
    const map = new Map<string, StockItem[]>()
    for (const item of displayItems) {
      const cat = item.category ?? 'Sin categoría'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }
    return map
  }, [displayItems])

  function showDeleteToast(action: 'deactivated' | 'deleted') {
    setDeleteToast(action === 'deactivated' ? 'Producto desactivado (tiene movimientos recientes)' : 'Producto eliminado')
    setTimeout(() => setDeleteToast(null), 3500)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => setFilterBelowMin(f => !f)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterBelowMin ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}>
          <Filter size={12} />Solo bajo mínimo{filterBelowMin && <Check size={12} />}
        </button>
        <button onClick={() => setModal({ type: 'create' })} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FF6B35] text-white hover:bg-[#FF6B35]/80 transition-colors">
          <Plus size={12} />Nuevo producto
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/25 text-sm">Cargando…</div>
      ) : grouped.size === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/25">
          <Package size={32} />
          <p className="text-sm">{filterBelowMin ? 'No hay productos bajo mínimo' : 'No hay productos en el inventario'}</p>
          {!filterBelowMin && <button onClick={() => setModal({ type: 'create' })} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FF6B35] text-white hover:bg-[#FF6B35]/80 transition-colors"><Plus size={12} />Agregar primer producto</button>}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([category, catItems]) => (
            <div key={category}>
              <h3 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2 px-1">{category}</h3>
              <div className="bg-white/3 rounded-2xl border border-white/8 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left text-white/40 text-xs font-medium px-4 py-2.5">Nombre</th>
                      <th className="text-left text-white/40 text-xs font-medium px-3 py-2.5">Unidad</th>
                      <th className="text-right text-white/40 text-xs font-medium px-3 py-2.5">Cantidad</th>
                      <th className="text-right text-white/40 text-xs font-medium px-3 py-2.5">Mínimo</th>
                      <th className="text-right text-white/40 text-xs font-medium px-3 py-2.5">Costo/u</th>
                      <th className="text-right text-white/40 text-xs font-medium px-3 py-2.5">Valor total</th>
                      <th className="text-center text-white/40 text-xs font-medium px-3 py-2.5">Estado</th>
                      <th className="text-right text-white/40 text-xs font-medium px-4 py-2.5">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((item, idx) => (
                      <tr key={item.id} className={`${idx < catItems.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/3 transition-colors`}>
                        <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                        <td className="px-3 py-3 text-white/50">{item.unit}</td>
                        <td className={`px-3 py-3 text-right font-mono font-medium ${item.current_qty < 0 ? 'text-red-400' : 'text-white'}`}>{item.current_qty}</td>
                        <td className="px-3 py-3 text-right font-mono text-white/50">{item.min_qty}</td>
                        <td className="px-3 py-3 text-right text-white/70">{formatCurrency(item.cost_per_unit)}</td>
                        <td className="px-3 py-3 text-right text-white/70">{formatCurrency(item.current_qty * item.cost_per_unit)}</td>
                        <td className="px-3 py-3 text-center"><StatusBadge item={item} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setModal({ type: 'edit', item })} title="Editar" className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => setModal({ type: 'adjust', item })} title="Ajustar" className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"><SlidersHorizontal size={13} /></button>
                            <button onClick={() => setModal({ type: 'merma', item })} title="Registrar merma" className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"><FlaskConical size={13} /></button>
                            <button onClick={() => setModal({ type: 'delete', item })} title="Eliminar" className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal?.type === 'create' && <ProductModal restaurantId={restaurantId} onClose={() => setModal(null)} onSaved={refetch} />}
      {modal?.type === 'edit' && <ProductModal restaurantId={restaurantId} item={modal.item} onClose={() => setModal(null)} onSaved={refetch} />}
      {modal?.type === 'adjust' && <AdjustModal item={modal.item} onClose={() => setModal(null)} onSaved={refetch} />}
      {modal?.type === 'merma' && <MermaModal item={modal.item} onClose={() => setModal(null)} onSaved={refetch} />}
      {modal?.type === 'delete' && <DeleteModal item={modal.item} onClose={() => setModal(null)} onDeleted={showDeleteToast} />}

      {deleteToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm shadow-xl z-50 flex items-center gap-2">
          <Check size={14} className="text-green-400" />{deleteToast}
        </div>
      )}
    </div>
  )
}

type Movement = {
  id: string
  stock_item_id: string
  stock_item_name?: string
  delta: number
  reason: string
  valor_monetario: number
  logged_at: string
  logged_by?: string | null
  order_id?: string | null
}

const MOVEMENT_TYPES = [
  { value: '', label: 'Todos' },
  { value: 'compra', label: 'Compra' },
  { value: 'orden', label: 'Orden' },
  { value: 'ajuste_manual', label: 'Ajuste manual' },
  { value: 'merma', label: 'Merma' },
] as const

function formatDelta(delta: number, unit: string) {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)} ${unit}`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function MovimientosTab({ restaurantId }: { restaurantId: string }) {
  const { items: stockItems } = useStockRealtime(restaurantId)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    stock_item_id: '',
    type: '',
    from_date: '',
    to_date: '',
  })

  const stockItemMap = useMemo(() => {
    const map = new Map<string, StockItem>()
    for (const item of stockItems) map.set(item.id, item)
    return map
  }, [stockItems])

  const fetchMovements = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ restaurant_id: restaurantId })
      if (filters.stock_item_id) params.set('stock_item_id', filters.stock_item_id)
      if (filters.type) params.set('type', filters.type)
      if (filters.from_date) params.set('from_date', filters.from_date)
      if (filters.to_date) params.set('to_date', filters.to_date)
      const res = await fetch(`/api/stock/movements?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMovements(data.movements ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [restaurantId, filters])

  useEffect(() => { fetchMovements() }, [fetchMovements])

  function setFilter(key: keyof typeof filters) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFilters(f => ({ ...f, [key]: e.target.value }))
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-white/40 text-xs">Producto</label>
          <select className={inputCls} value={filters.stock_item_id} onChange={setFilter('stock_item_id')}>
            <option value="">Todos los productos</option>
            {stockItems.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-white/40 text-xs">Tipo de movimiento</label>
          <select className={inputCls} value={filters.type} onChange={setFilter('type')}>
            {MOVEMENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-white/40 text-xs">Desde</label>
          <input type="date" className={inputCls} value={filters.from_date} onChange={setFilter('from_date')} />
        </div>
        <div className="space-y-1">
          <label className="text-white/40 text-xs">Hasta</label>
          <input type="date" className={inputCls} value={filters.to_date} onChange={setFilter('to_date')} />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/25 text-sm">Cargando…</div>
      ) : movements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/25">
          <List size={32} />
          <p className="text-sm">No hay movimientos para los filtros seleccionados</p>
        </div>
      ) : (
        <div className="bg-white/3 rounded-2xl border border-white/8 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left text-white/40 text-xs font-medium px-4 py-2.5">Fecha</th>
                <th className="text-left text-white/40 text-xs font-medium px-3 py-2.5">Producto</th>
                <th className="text-left text-white/40 text-xs font-medium px-3 py-2.5">Tipo</th>
                <th className="text-right text-white/40 text-xs font-medium px-3 py-2.5">Delta</th>
                <th className="text-right text-white/40 text-xs font-medium px-3 py-2.5">Valor</th>
                <th className="text-left text-white/40 text-xs font-medium px-3 py-2.5">Razón</th>
                <th className="text-left text-white/40 text-xs font-medium px-4 py-2.5">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m, idx) => {
                const stockItem = stockItemMap.get(m.stock_item_id)
                const unit = stockItem?.unit ?? ''
                const itemName = stockItem?.name ?? m.stock_item_id.slice(0, 8)
                return (
                  <tr key={m.id} className={`${idx < movements.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/3 transition-colors`}>
                    <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">{formatDateTime(m.logged_at)}</td>
                    <td className="px-3 py-3 text-white font-medium">{itemName}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        m.reason === 'compra' ? 'bg-green-500/20 text-green-400' :
                        m.reason === 'orden' ? 'bg-blue-500/20 text-blue-400' :
                        m.reason === 'merma' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-white/10 text-white/50'
                      }`}>
                        {m.reason}
                      </span>
                    </td>
                    <td className={`px-3 py-3 text-right font-mono font-medium ${m.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatDelta(m.delta, unit)}
                    </td>
                    <td className="px-3 py-3 text-right text-white/70">{formatCurrency(m.valor_monetario)}</td>
                    <td className="px-3 py-3 text-white/50 text-xs">{m.reason ?? '—'}</td>
                    <td className="px-4 py-3 text-white/40 text-xs font-mono">{m.logged_by ? m.logged_by.slice(0, 8) + '…' : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Órdenes de Compra ────────────────────────────────────────────────────────

type PurchaseOrderStatus = 'borrador' | 'enviada' | 'recibida' | 'cancelada'
type InvoiceStatus = 'pendiente' | 'pagada'

type PurchaseOrderItem = {
  id?: string
  stock_item_id: string
  qty_ordered: number
  cost_per_unit: number
}

type PurchaseOrder = {
  id: string
  supplier: string
  status: PurchaseOrderStatus
  notes?: string | null
  created_at: string
  items: PurchaseOrderItem[]
}

type PurchaseInvoice = {
  id: string
  purchase_order_id: string
  invoice_number?: string | null
  total_amount: number
  issued_at?: string | null
  due_at?: string | null
  paid_at?: string | null
  paid_amount?: number | null
  payment_status: InvoiceStatus
  notes?: string | null
  supplier?: string
}

const ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
}

const ORDER_STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  borrador: 'bg-white/10 text-white/50',
  enviada: 'bg-blue-500/20 text-blue-400',
  recibida: 'bg-green-500/20 text-green-400',
  cancelada: 'bg-red-500/20 text-red-400',
}

function OrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${ORDER_STATUS_COLORS[status]}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}

function calcOrderTotal(items: PurchaseOrderItem[]) {
  return items.reduce((sum, i) => sum + (i.qty_ordered * i.cost_per_unit), 0)
}

// Modal for creating a new purchase order
function NuevaOrdenModal({
  restaurantId,
  stockItems,
  onClose,
  onSaved,
}: {
  restaurantId: string
  stockItems: StockItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<{ stock_item_id: string; qty_ordered: string; cost_per_unit: string }[]>([
    { stock_item_id: '', qty_ordered: '', cost_per_unit: '' },
  ])

  function addItem() {
    setItems(prev => [...prev, { stock_item_id: '', qty_ordered: '', cost_per_unit: '' }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function setItemField(idx: number, field: 'stock_item_id' | 'qty_ordered' | 'cost_per_unit', value: string) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplier.trim()) { setError('El proveedor es requerido'); return }
    const parsedItems = items.map(i => ({
      stock_item_id: i.stock_item_id,
      qty_ordered: parseFloat(i.qty_ordered) || 0,
      cost_per_unit: parseInt(i.cost_per_unit) || 0,
    }))
    if (parsedItems.some(i => !i.stock_item_id || i.qty_ordered <= 0)) {
      setError('Cada ítem debe tener un producto y cantidad mayor a cero')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, supplier: supplier.trim(), notes: notes || undefined, items: parsedItems }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error al crear orden'); return }
      onSaved(); onClose()
    } catch { setError('Error de red') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold text-sm">Nueva orden de compra</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Proveedor *">
              <input className={inputCls} value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Ej: Distribuidora XYZ" required />
            </Field>
            <Field label="Notas (opcional)">
              <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones…" />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Ítems</p>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-[#FF6B35] hover:text-[#FF6B35]/80 transition-colors">
                <Plus size={12} />Agregar ítem
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_100px_32px] gap-2 items-end">
                  <div className="space-y-1">
                    {idx === 0 && <label className="text-white/40 text-xs">Producto</label>}
                    <select
                      className={inputCls}
                      value={item.stock_item_id}
                      onChange={e => setItemField(idx, 'stock_item_id', e.target.value)}
                      required
                    >
                      <option value="">Seleccionar…</option>
                      {stockItems.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    {idx === 0 && <label className="text-white/40 text-xs">Cantidad</label>}
                    <input
                      className={inputCls}
                      type="number"
                      step="0.001"
                      min="0.001"
                      placeholder="0"
                      value={item.qty_ordered}
                      onChange={e => setItemField(idx, 'qty_ordered', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    {idx === 0 && <label className="text-white/40 text-xs">Costo/u (CLP)</label>}
                    <input
                      className={inputCls}
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={item.cost_per_unit}
                      onChange={e => setItemField(idx, 'cost_per_unit', e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-20"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#FF6B35]/80 disabled:opacity-50 transition-colors">
              {saving ? 'Creando…' : 'Crear orden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal for generating an invoice from a received order
function GenerarFacturaModal({
  order,
  onClose,
  onSaved,
}: {
  order: PurchaseOrder
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [notes, setNotes] = useState('')
  const total = calcOrderTotal(order.items)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/purchase-orders/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_order_id: order.id,
          invoice_number: invoiceNumber || undefined,
          issued_at: issuedAt || undefined,
          due_at: dueAt || undefined,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error al generar factura'); return }
      onSaved(); onClose()
    } catch { setError('Error de red') } finally { setSaving(false) }
  }

  return (
    <Modal title={`Generar factura — ${order.supplier}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-white/40 text-xs">Monto total: <span className="text-white font-medium">{formatCurrency(total)}</span></p>
        <Field label="Número de factura (opcional)">
          <input className={inputCls} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ej: F-001234" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de emisión">
            <input type="date" className={inputCls} value={issuedAt} onChange={e => setIssuedAt(e.target.value)} />
          </Field>
          <Field label="Fecha de vencimiento">
            <input type="date" className={inputCls} value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Notas (opcional)">
          <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones…" />
        </Field>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#FF6B35]/80 disabled:opacity-50 transition-colors">
            {saving ? 'Generando…' : 'Generar factura'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function OrdenesTab({ restaurantId }: { restaurantId: string }) {
  const { items: stockItems } = useStockRealtime(restaurantId)

  // Orders state
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<PurchaseOrderStatus | ''>('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [showNuevaOrden, setShowNuevaOrden] = useState(false)
  const [transitioningId, setTransitioningId] = useState<string | null>(null)

  // Invoices state
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [invoiceOrder, setInvoiceOrder] = useState<PurchaseOrder | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return
    setOrdersLoading(true)
    try {
      const params = new URLSearchParams({ restaurant_id: restaurantId })
      if (filterStatus) params.set('status', filterStatus)
      if (filterSupplier.trim()) params.set('supplier', filterSupplier.trim())
      const res = await fetch(`/api/purchase-orders?${params}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders ?? [])
      }
    } finally {
      setOrdersLoading(false)
    }
  }, [restaurantId, filterStatus, filterSupplier])

  const fetchInvoices = useCallback(async () => {
    if (!restaurantId) return
    setInvoicesLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders/invoices?restaurant_id=${restaurantId}`)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices ?? [])
      }
    } finally {
      setInvoicesLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  async function transitionStatus(order: PurchaseOrder, newStatus: PurchaseOrderStatus) {
    setTransitioningId(order.id)
    try {
      const res = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        await fetchOrders()
        if (newStatus === 'recibida') await fetchInvoices()
      }
    } finally {
      setTransitioningId(null)
    }
  }

  const totalPendiente = useMemo(
    () => invoices.filter(i => i.payment_status === 'pendiente').reduce((sum, i) => sum + i.total_amount, 0),
    [invoices]
  )

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Filters + New button */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-white/40 text-xs">Estado</label>
          <select
            className={`${inputCls} w-36`}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as PurchaseOrderStatus | '')}
          >
            <option value="">Todos</option>
            {(Object.keys(ORDER_STATUS_LABELS) as PurchaseOrderStatus[]).map(s => (
              <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-white/40 text-xs">Proveedor</label>
          <input
            className={`${inputCls} w-48`}
            placeholder="Buscar proveedor…"
            value={filterSupplier}
            onChange={e => setFilterSupplier(e.target.value)}
          />
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowNuevaOrden(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#FF6B35] text-white hover:bg-[#FF6B35]/80 transition-colors"
          >
            <Plus size={12} />Nueva orden
          </button>
        </div>
      </div>

      {/* Orders table */}
      {ordersLoading ? (
        <div className="flex items-center justify-center py-16 text-white/25 text-sm">Cargando…</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/25">
          <ShoppingCart size={32} />
          <p className="text-sm">No hay órdenes de compra</p>
          <button
            onClick={() => setShowNuevaOrden(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FF6B35] text-white hover:bg-[#FF6B35]/80 transition-colors"
          >
            <Plus size={12} />Crear primera orden
          </button>
        </div>
      ) : (
        <div className="bg-white/3 rounded-2xl border border-white/8 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left text-white/40 text-xs font-medium px-4 py-2.5">Fecha</th>
                <th className="text-left text-white/40 text-xs font-medium px-3 py-2.5">Proveedor</th>
                <th className="text-left text-white/40 text-xs font-medium px-3 py-2.5">Estado</th>
                <th className="text-right text-white/40 text-xs font-medium px-3 py-2.5">Total estimado</th>
                <th className="text-right text-white/40 text-xs font-medium px-4 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, idx) => (
                <tr key={order.id} className={`${idx < orders.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/3 transition-colors`}>
                  <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">{formatDate(order.created_at)}</td>
                  <td className="px-3 py-3 text-white font-medium">{order.supplier}</td>
                  <td className="px-3 py-3"><OrderStatusBadge status={order.status} /></td>
                  <td className="px-3 py-3 text-right text-white/70">{formatCurrency(calcOrderTotal(order.items))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {order.status === 'borrador' && (
                        <>
                          <button
                            onClick={() => transitionStatus(order, 'enviada')}
                            disabled={transitioningId === order.id}
                            title="Marcar como enviada"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-40"
                          >
                            <Send size={10} />Enviar
                          </button>
                          <button
                            onClick={() => transitionStatus(order, 'cancelada')}
                            disabled={transitioningId === order.id}
                            title="Cancelar orden"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40"
                          >
                            <X size={10} />Cancelar
                          </button>
                        </>
                      )}
                      {order.status === 'enviada' && (
                        <>
                          <button
                            onClick={() => transitionStatus(order, 'recibida')}
                            disabled={transitioningId === order.id}
                            title="Marcar como recibida"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-40"
                          >
                            <Check size={10} />Recibida
                          </button>
                          <button
                            onClick={() => transitionStatus(order, 'cancelada')}
                            disabled={transitioningId === order.id}
                            title="Cancelar orden"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40"
                          >
                            <X size={10} />Cancelar
                          </button>
                        </>
                      )}
                      {order.status === 'recibida' && (
                        <button
                          onClick={() => setInvoiceOrder(order)}
                          title="Generar factura"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors"
                        >
                          <FileText size={10} />Factura
                        </button>
                      )}
                      {(order.status === 'cancelada') && (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoices sub-section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-white/50 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
            <FileText size={12} />Facturas de compra
          </h3>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-white/40 text-xs">Total pendiente:</span>
            <span className="text-amber-400 font-semibold text-sm">{formatCurrency(totalPendiente)}</span>
          </div>
        </div>

        {invoicesLoading ? (
          <div className="flex items-center justify-center py-10 text-white/25 text-sm">Cargando facturas…</div>
        ) : invoices.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-white/25 text-sm">
            No hay facturas registradas. Genera una desde una orden recibida.
          </div>
        ) : (
          <div className="bg-white/3 rounded-2xl border border-white/8 overflow-x-auto">
            <table className="w-full text-sm min-w-[650px]">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left text-white/40 text-xs font-medium px-4 py-2.5">Fecha</th>
                  <th className="text-left text-white/40 text-xs font-medium px-3 py-2.5">Proveedor</th>
                  <th className="text-left text-white/40 text-xs font-medium px-3 py-2.5">Número</th>
                  <th className="text-right text-white/40 text-xs font-medium px-3 py-2.5">Monto</th>
                  <th className="text-left text-white/40 text-xs font-medium px-4 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => (
                  <tr key={inv.id} className={`${idx < invoices.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/3 transition-colors`}>
                    <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">
                      {inv.issued_at ? formatDate(inv.issued_at) : '—'}
                    </td>
                    <td className="px-3 py-3 text-white font-medium">{inv.supplier ?? '—'}</td>
                    <td className="px-3 py-3 text-white/50 font-mono text-xs">{inv.invoice_number ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-white/70">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        inv.payment_status === 'pagada'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {inv.payment_status === 'pagada' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNuevaOrden && (
        <NuevaOrdenModal
          restaurantId={restaurantId}
          stockItems={stockItems}
          onClose={() => setShowNuevaOrden(false)}
          onSaved={() => { fetchOrders(); fetchInvoices() }}
        />
      )}
      {invoiceOrder && (
        <GenerarFacturaModal
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
          onSaved={() => { fetchInvoices() }}
        />
      )}
    </div>
  )
}

export default function StockPage() {
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id ?? ''
  const [tab, setTab] = useState<StockTab>('inventario')
  const { alertCount, negativeItems, belowMinItems, totalInventoryValue, loading } = useStockAlerts(restId)
  const alertedItems = [...negativeItems, ...belowMinItems]

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div>
        <h1 className="text-white text-xl font-bold">Control de Stock</h1>
        <p className="text-white/40 text-sm mt-0.5">Inventario, movimientos, importación y órdenes de compra</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/8">
          <p className="text-white/40 text-xs mb-1">Valor del inventario</p>
          <p className="text-white text-2xl font-bold">{loading ? '—' : formatCurrency(totalInventoryValue)}</p>
        </div>
        <div className={`rounded-2xl p-4 border ${alertCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/8'}`}>
          <p className="text-white/40 text-xs mb-1">Alertas activas</p>
          <p className={`text-2xl font-bold ${alertCount > 0 ? 'text-red-400' : 'text-white'}`}>{loading ? '—' : alertCount}</p>
        </div>
      </div>

      {!loading && alertCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-sm font-semibold mb-0.5">{alertCount} producto{alertCount > 1 ? 's' : ''} requieren atención</p>
            <p className="text-red-300/70 text-xs">{alertedItems.map(i => i.name).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="flex border-b border-white/10 gap-1">
        <TabButton active={tab === 'inventario'} icon={Package} onClick={() => setTab('inventario')} badge={alertCount}>Inventario</TabButton>
        <TabButton active={tab === 'movimientos'} icon={List} onClick={() => setTab('movimientos')}>Movimientos</TabButton>
        <TabButton active={tab === 'importar'} icon={Upload} onClick={() => setTab('importar')}>Importar</TabButton>
        <TabButton active={tab === 'ordenes'} icon={ShoppingCart} onClick={() => setTab('ordenes')}>Órdenes de Compra</TabButton>
      </div>

      {tab === 'inventario' && <InventarioTab restaurantId={restId} />}
      {tab === 'movimientos' && <MovimientosTab restaurantId={restId} />}
      {tab === 'importar' && <ImportarTab restaurantId={restId} />}
      {tab === 'ordenes' && <OrdenesTab restaurantId={restId} />}
    </div>
  )
}
