'use client'

import { useState, useRef } from 'react'
import { X, Camera, FileSpreadsheet, FileText, Upload, Check, Trash2, Loader2 } from 'lucide-react'

interface ExtractedItem {
  name: string
  quantity: number | null
  unit: string | null
  category: string | null
}

interface InventoryImportModalProps {
  restaurantId: string
  onClose:      () => void
  onImported:   (count: number) => void
}

export function InventoryImportModal({ restaurantId, onClose, onImported }: InventoryImportModalProps) {
  const [step, setStep]         = useState<'select' | 'preview' | 'done'>('select')
  const [items, setItems]       = useState<ExtractedItem[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja']

  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('restaurant_id', restaurantId)
      const res  = await fetch('/api/inventory/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error procesando archivo')
      if (!data.items || data.items.length === 0) {
        setError('No se pudieron extraer items del archivo. Intenta con otro formato.')
        return
      }
      setItems(data.items)
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setLoading(true)
    try {
      const blob = new Blob([JSON.stringify(items)], { type: 'application/json' })
      const fd   = new FormData()
      fd.append('file', new File([blob], 'items.json', { type: 'application/json' }))
      fd.append('restaurant_id', restaurantId)
      fd.append('confirm', 'true')
      fd.append('items', JSON.stringify(items))
      const res  = await fetch('/api/inventory/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStep('done')
      setTimeout(() => { onImported(data.imported); onClose() }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ExtractedItem, value: string | number | null) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-lg border border-white/10 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h3 className="text-white font-semibold">Cargar inventario</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select' && (
            <div className="space-y-4">
              {/* Upload buttons */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Camera,          label: 'Foto de lista',  accept: 'image/*' },
                  { icon: FileSpreadsheet, label: 'Excel / CSV',     accept: '.xlsx,.xls,.csv' },
                  { icon: FileText,        label: 'PDF de comanda', accept: '.pdf' },
                ].map(({ icon: Icon, label, accept }) => (
                  <button
                    key={label}
                    onClick={() => {
                      if (inputRef.current) {
                        inputRef.current.accept = accept
                        inputRef.current.click()
                      }
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
                  >
                    <Icon size={24} className="text-orange-400" />
                    <span className="text-gray-300 text-xs text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault(); setDragOver(false)
                  const f = e.dataTransfer.files[0]
                  if (f) handleFile(f)
                }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-orange-500 bg-orange-500/5' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <Upload size={28} className="mx-auto mb-2 text-gray-500" />
                <p className="text-gray-400 text-sm">o arrastra tu archivo aquí</p>
                <p className="text-gray-600 text-xs mt-1">JPG, PNG, PDF, XLSX, CSV</p>
              </div>

              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />

              {loading && (
                <div className="flex items-center justify-center gap-3 py-4 text-orange-400">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Procesando con IA...</span>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm">{items.length} items extraídos — revisa y edita antes de confirmar</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-black/20 rounded-lg p-2">
                    <input
                      value={item.name}
                      onChange={e => updateItem(i, 'name', e.target.value)}
                      className="flex-1 bg-transparent text-white text-sm focus:outline-none min-w-0"
                    />
                    <input
                      type="number"
                      value={item.quantity ?? ''}
                      onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || null)}
                      placeholder="Qty"
                      className="w-16 bg-transparent text-gray-300 text-sm text-center focus:outline-none"
                    />
                    <select
                      value={item.unit ?? 'unidad'}
                      onChange={e => updateItem(i, 'unit', e.target.value)}
                      className="bg-black/30 text-gray-300 text-xs rounded px-1 py-0.5 focus:outline-none"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button onClick={() => removeItem(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check size={24} className="text-green-400" />
              </div>
              <p className="text-white font-medium">¡Inventario importado!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="p-6 border-t border-white/5 flex gap-3">
            <button onClick={() => setStep('select')} className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-400 text-sm">
              Volver
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || items.length === 0}
              className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-40 transition-colors"
            >
              {loading ? 'Guardando...' : `Confirmar ${items.length} items`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
