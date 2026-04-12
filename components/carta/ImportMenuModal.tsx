'use client'

import { useRef, useState } from 'react'
import {
  X, Camera, FileText, ClipboardPaste, Loader2, Check, AlertCircle,
  Trash2, Plus, Sparkles, Upload, RefreshCw,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Mode = 'upload' | 'review' | 'importing' | 'done' | 'error'

export interface ImportItem {
  name:        string
  description: string
  price:       number
  category:    string
  tags:        string[]
  available:   boolean
}

interface Props {
  restaurantId: string
  onClose: () => void
  onImported: (count: number) => void
}

const CATEGORIES = ['entrada', 'principal', 'postre', 'bebida', 'para compartir']

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const b64 = result.split(',')[1] ?? result
      resolve(b64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function parseTabular(text: string): ImportItem[] {
  // Accept CSV, TSV, or pasted Excel (tab-separated). Auto-detect delimiter.
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return []

  const first = lines[0]
  const delimiter = first.includes('\t') ? '\t' : first.includes(';') ? ';' : ','

  // Detect header: if first row contains "nombre"/"name" or "precio"/"price" keywords
  const headerRow = first.toLowerCase().split(delimiter).map(s => s.trim())
  const hasHeader = headerRow.some(h => /nombre|name|plato|precio|price/.test(h))
  const startIdx = hasHeader ? 1 : 0

  const nameIdx        = hasHeader ? headerRow.findIndex(h => /nombre|name|plato/.test(h)) : 0
  const priceIdx       = hasHeader ? headerRow.findIndex(h => /precio|price/.test(h))       : 1
  const descIdx        = hasHeader ? headerRow.findIndex(h => /descr|desc/.test(h))         : 2
  const categoryIdx    = hasHeader ? headerRow.findIndex(h => /categ/.test(h))              : 3
  const tagsIdx        = hasHeader ? headerRow.findIndex(h => /tag/.test(h))                : 4

  const out: ImportItem[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim())
    if (cols.length === 0 || !cols[nameIdx]) continue

    const rawPrice = (cols[priceIdx] ?? '').replace(/[^\d]/g, '')
    const price = parseInt(rawPrice, 10)
    if (!price) continue

    const catRaw = (cols[categoryIdx] ?? '').toLowerCase().trim()
    const category = CATEGORIES.includes(catRaw) ? catRaw : 'principal'

    const tags = (cols[tagsIdx] ?? '')
      .split(/[,|]/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)

    out.push({
      name:        cols[nameIdx] ?? '',
      description: cols[descIdx] ?? '',
      price,
      category,
      tags,
      available:   true,
    })
  }
  return out
}

// ── Component ────────────────────────────────────────────────────────────────

export function ImportMenuModal({ restaurantId, onClose, onImported }: Props) {
  const [mode, setMode] = useState<Mode>('upload')
  const [source, setSource] = useState<'photo' | 'paste'>('photo')
  const [items, setItems] = useState<ImportItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [importedCount, setImportedCount] = useState(0)

  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const arr = Array.from(files).slice(0, 6)
    setError(null)
    setMode('importing')

    try {
      const base64s = await Promise.all(arr.map(fileToBase64))
      const res = await fetch('/api/menu-items/extract', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          images: base64s,
          mime:   arr[0].type || 'image/jpeg',
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'No se pudo analizar la imagen')
        setMode('error')
        return
      }
      if (!data.items || data.items.length === 0) {
        setError('No encontramos platos en la imagen. Intenta con una foto más nítida.')
        setMode('error')
        return
      }
      setItems(data.items.map((i: ImportItem) => ({
        ...i,
        description: i.description ?? '',
        tags: i.tags ?? [],
        available: true,
      })))
      setMode('review')
    } catch (err) {
      console.error(err)
      setError('Error al procesar la imagen. Intenta de nuevo.')
      setMode('error')
    }
  }

  function handleParseText() {
    if (!pasteText.trim()) return
    const parsed = parseTabular(pasteText)
    if (parsed.length === 0) {
      setError('No se detectaron platos en el texto pegado.')
      return
    }
    setError(null)
    setItems(parsed)
    setMode('review')
  }

  async function handleImport() {
    setMode('importing')
    setError(null)
    const res = await fetch('/api/menu-items/bulk', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        restaurant_id: restaurantId,
        items,
      }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      setError(data.error ?? 'No se pudieron importar los platos')
      setMode('error')
      return
    }
    setImportedCount(data.count ?? items.length)
    setMode('done')
    onImported(data.count ?? items.length)
  }

  function updateItem(idx: number, patch: Partial<ImportItem>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function addBlankItem() {
    setItems(prev => [...prev, {
      name: '', description: '', price: 0, category: 'principal', tags: [], available: true,
    }])
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div
        className="bg-[#1C1C2E] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[#FF6B35]" />
            <h3 className="text-white font-bold">Importar carta</h3>
            {mode === 'review' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B35]/20 text-[#FF6B35] font-semibold">
                {items.length} detectados
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Upload mode ───────────────────────────────── */}
          {mode === 'upload' && (
            <div className="space-y-5">
              <div className="flex gap-2">
                <button
                  onClick={() => setSource('photo')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors
                    ${source === 'photo' ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35]' : 'bg-white/4 border-white/10 text-white/50 hover:border-white/20'}`}
                >
                  <Camera size={14} /> Foto de la carta
                </button>
                <button
                  onClick={() => setSource('paste')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors
                    ${source === 'paste' ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35]' : 'bg-white/4 border-white/10 text-white/50 hover:border-white/20'}`}
                >
                  <ClipboardPaste size={14} /> Pegar desde Excel
                </button>
              </div>

              {source === 'photo' && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={e => handleFiles(e.target.files)}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full h-56 rounded-2xl border-2 border-dashed border-white/15 bg-white/3 hover:border-[#FF6B35]/40 hover:bg-[#FF6B35]/5 transition-all flex flex-col items-center justify-center gap-3 group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[#FF6B35]/15 border border-[#FF6B35]/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Upload size={22} className="text-[#FF6B35]" />
                    </div>
                    <div className="text-center">
                      <p className="text-white text-sm font-semibold">Subir foto(s) o PDF de la carta</p>
                      <p className="text-white/40 text-xs mt-1">Hasta 6 archivos · JPG, PNG o PDF</p>
                    </div>
                  </button>

                  <div className="bg-[#FF6B35]/5 border border-[#FF6B35]/15 rounded-xl p-4 space-y-1.5">
                    <p className="text-[#FF6B35] text-xs font-semibold flex items-center gap-1.5">
                      <Sparkles size={11} /> Cómo funciona
                    </p>
                    <ol className="text-white/50 text-[11px] leading-relaxed space-y-1 list-decimal list-inside">
                      <li>Toma una foto nítida de cada página de tu carta</li>
                      <li>Chapi usará IA para detectar todos los platos, precios y descripciones</li>
                      <li>Revisa los resultados (edita si quieres) y confirma la importación</li>
                    </ol>
                  </div>
                </>
              )}

              {source === 'paste' && (
                <div className="space-y-3">
                  <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-[11px] text-white/50 space-y-1">
                    <p className="text-white font-semibold">Formato esperado (una fila por plato)</p>
                    <p>Columnas: <code className="text-[#FF6B35]">nombre · precio · descripción · categoría · tags</code></p>
                    <p className="text-white/35">Puedes pegar desde Excel / Google Sheets (tabulado) o CSV.</p>
                  </div>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    rows={10}
                    placeholder={`Nombre\tPrecio\tDescripción\tCategoría\tTags\nLomo vetado\t18000\tCon papas rústicas\tprincipal\tpopular\nPisco sour\t6500\tClásico chileno\tbebida\tpopular`}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/40 font-mono resize-none"
                  />
                  <button
                    onClick={handleParseText}
                    disabled={!pasteText.trim()}
                    className="w-full py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Analizar y previsualizar
                  </button>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30">
                  <AlertCircle size={12} className="text-red-300 mt-0.5 shrink-0" />
                  <p className="text-red-200 text-xs">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Review mode ───────────────────────────────── */}
          {mode === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <Check size={12} className="text-emerald-400" />
                <span className="text-white/70">
                  Revisa y edita los platos detectados. Elimina los que no quieras importar.
                </span>
              </div>

              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="bg-white/4 border border-white/8 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={item.name}
                        onChange={e => updateItem(i, { name: e.target.value })}
                        placeholder="Nombre"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-[#FF6B35]/40"
                      />
                      <input
                        value={item.price}
                        onChange={e => updateItem(i, { price: parseInt(e.target.value.replace(/\D/g, '') || '0') })}
                        className="w-24 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#FF6B35]/40"
                      />
                      <select
                        value={item.category}
                        onChange={e => updateItem(i, { category: e.target.value })}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#FF6B35]/40"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c} value={c} className="bg-[#1C1C2E]">{c}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeItem(i)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <input
                      value={item.description}
                      onChange={e => updateItem(i, { description: e.target.value })}
                      placeholder="Descripción (opcional)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-[11px] placeholder:text-white/25 focus:outline-none focus:border-[#FF6B35]/40"
                    />
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map(t => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35]/80 border border-[#FF6B35]/20">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addBlankItem}
                className="w-full py-2 rounded-xl border border-dashed border-white/15 text-white/40 text-xs hover:border-white/30 hover:text-white/70 transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={11} /> Agregar plato manualmente
              </button>
            </div>
          )}

          {/* ── Importing / Done / Error ──────────────────── */}
          {mode === 'importing' && (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="text-[#FF6B35] animate-spin" />
              <p className="text-white/70 text-sm">Analizando tu carta con IA...</p>
              <p className="text-white/30 text-[11px]">Puede demorar unos segundos</p>
            </div>
          )}
          {mode === 'done' && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Check size={22} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-base font-bold">¡Listo!</p>
                <p className="text-white/50 text-xs mt-1">Se agregaron {importedCount} platos a tu carta</p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
          {mode === 'error' && (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <AlertCircle size={28} className="text-red-300" />
              <p className="text-red-200 text-sm max-w-xs">{error}</p>
              <button
                onClick={() => { setError(null); setMode('upload') }}
                className="mt-2 px-4 py-1.5 rounded-lg border border-white/10 text-white/70 text-xs hover:border-white/25 transition-colors"
              >
                Intentar de nuevo
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {mode === 'review' && (
          <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between gap-2 shrink-0">
            <button
              onClick={() => setMode('upload')}
              className="px-4 py-2 rounded-xl border border-white/10 text-white/50 text-xs hover:border-white/20 transition-colors"
            >
              ← Atrás
            </button>
            <button
              onClick={handleImport}
              disabled={items.length === 0 || items.some(i => !i.name || !i.price)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Upload size={13} /> Importar {items.length} platos
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
