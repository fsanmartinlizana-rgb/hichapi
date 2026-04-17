'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Banknote, CreditCard, Layers, FileText, Building2, ChevronLeft, Loader2, Mail } from 'lucide-react'
import { formatCurrency } from '@/lib/i18n'

const clp = (n: number) => formatCurrency(n)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DteSelection {
  document_type:      39 | 33
  rut_receptor?:      string
  razon_receptor?:    string
  giro_receptor?:     string
  direccion_receptor?: string
  comuna_receptor?:   string
  fma_pago?:          1 | 2 | 3
  email_receptor?:    string
}

interface Receptor {
  rut:               string
  razon_social:      string
  giro:              string | null
  direccion:         string | null
  comuna:            string | null
  email:             string | null
  facturas_emitidas: number
}

interface PaymentMethodModalProps {
  orderId:       string
  total:         number
  restaurantId:  string
  onConfirm:  (
    method: 'cash' | 'digital' | 'mixed',
    dte: DteSelection,
    cashAmount?: number,
    digitalAmount?: number,
  ) => Promise<void>
  onClose:    () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidRut(rut: string): boolean {
  const stripped = rut.replace(/\./g, '').trim()
  return /^\d{7,8}-[\dkK]$/.test(stripped)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PaymentMethodModal({ orderId: _orderId, total, restaurantId, onConfirm, onClose }: PaymentMethodModalProps) {
  // Step 1: payment method
  const [step, setStep]         = useState<1 | 2>(1)
  const [method, setMethod]     = useState<'cash' | 'digital' | 'mixed' | null>(null)
  const [cashPart, setCashPart] = useState('')
  const [saving, setSaving]     = useState(false)

  // Step 2: document type
  const [docType, setDocType]   = useState<39 | 33>(39)

  // Factura receptor fields
  const [rut,       setRut]       = useState('')
  const [razon,     setRazon]     = useState('')
  const [giro,      setGiro]      = useState('')
  const [direccion, setDireccion] = useState('')
  const [comuna,    setComuna]    = useState('')
  const [email,     setEmail]     = useState('')

  // Autocompletado
  const [suggestions,     setSuggestions]     = useState<Receptor[]>([])
  const [loadingSuggest,  setLoadingSuggest]  = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const digitalPart = method === 'mixed' ? Math.max(0, total - (parseInt(cashPart) || 0)) : 0

  // Map payment method → fma_pago
  const fmaPago: 1 | 2 | 3 = method === 'cash' ? 1 : method === 'digital' ? 2 : 1

  // Factura form validation
  const rutValid  = docType === 39 || isValidRut(rut)
  const facturaOk = docType === 39 || (
    rutValid && razon.trim() && giro.trim() && direccion.trim() && comuna.trim()
  )

  // ── Autocompletado por RUT ─────────────────────────────────────────────────

  useEffect(() => {
    if (docType !== 33 || rut.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggest(true)
      try {
        const res  = await fetch(`/api/dte/receptores?restaurant_id=${restaurantId}&rut=${encodeURIComponent(rut)}`)
        const data = await res.json()
        setSuggestions(data.receptores ?? [])
        setShowSuggestions((data.receptores ?? []).length > 0)
      } catch {
        setSuggestions([])
      } finally {
        setLoadingSuggest(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [rut, docType, restaurantId])

  // Cerrar sugerencias al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function applyReceptor(r: Receptor) {
    setRut(r.rut)
    setRazon(r.razon_social)
    setGiro(r.giro ?? '')
    setDireccion(r.direccion ?? '')
    setComuna(r.comuna ?? '')
    setEmail(r.email ?? '')
    setShowSuggestions(false)
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleNextStep() {
    if (!method) return
    if (method === 'mixed' && !cashPart) return
    setStep(2)
  }

  async function handleConfirm() {
    if (!method || !facturaOk) return
    setSaving(true)

    const dte: DteSelection = docType === 33
      ? {
          document_type:      33,
          rut_receptor:       rut.replace(/\./g, '').trim(),
          razon_receptor:     razon.trim(),
          giro_receptor:      giro.trim(),
          direccion_receptor: direccion.trim(),
          comuna_receptor:    comuna.trim(),
          fma_pago:           fmaPago,
          email_receptor:     email.trim() || undefined,
        }
      : { document_type: 39 }

    try {
      if (method === 'cash') {
        await onConfirm('cash', dte, total, 0)
      } else if (method === 'digital') {
        await onConfirm('digital', dte, 0, total)
      } else {
        const cash    = parseInt(cashPart) || 0
        const digital = Math.max(0, total - cash)
        await onConfirm('mixed', dte, cash, digital)
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-sm border border-white/10 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="p-1 rounded-lg text-white/40 hover:text-white transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div>
              <h3 className="text-white font-semibold text-sm">
                {step === 1 ? 'Método de pago' : 'Tipo de documento'}
              </h3>
              <p className="text-white/40 text-xs">Total: {clp(total)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full transition-colors ${step === 1 ? 'bg-[#FF6B35]' : 'bg-white/20'}`} />
              <span className={`w-1.5 h-1.5 rounded-full transition-colors ${step === 2 ? 'bg-[#FF6B35]' : 'bg-white/20'}`} />
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors ml-1">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 max-h-[80vh] overflow-y-auto">

          {/* ── Step 1: Payment method ── */}
          {step === 1 && (
            <>
              <div className="space-y-2.5 mb-5">
                {[
                  { id: 'cash'    as const, icon: Banknote,   label: 'Efectivo',         desc: 'Sin comisión HiChapi' },
                  { id: 'digital' as const, icon: CreditCard, label: 'Digital (Stripe)',  desc: '1% comisión HiChapi' },
                  { id: 'mixed'   as const, icon: Layers,     label: 'Pago mixto',        desc: 'Parte efectivo + parte digital' },
                ].map(({ id, icon: Icon, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => setMethod(id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      method === id
                        ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${method === id ? 'bg-[#FF6B35]/20' : 'bg-white/5'}`}>
                      <Icon size={18} className={method === id ? 'text-[#FF6B35]' : 'text-white/40'} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{label}</p>
                      <p className="text-white/30 text-xs">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {method === 'mixed' && (
                <div className="mb-5">
                  <label className="text-white/40 text-xs mb-1.5 block">Parte en efectivo (CLP)</label>
                  <input
                    type="number"
                    value={cashPart}
                    onChange={e => setCashPart(e.target.value)}
                    placeholder="0"
                    max={total}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
                  />
                  {cashPart && (
                    <p className="text-white/30 text-xs mt-1">Digital: {clp(digitalPart)}</p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:border-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={!method || (method === 'mixed' && !cashPart)}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Document type ── */}
          {step === 2 && (
            <>
              <div className="space-y-2.5 mb-5">
                <button
                  onClick={() => setDocType(39)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    docType === 39
                      ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${docType === 39 ? 'bg-[#FF6B35]/20' : 'bg-white/5'}`}>
                    <FileText size={18} className={docType === 39 ? 'text-[#FF6B35]' : 'text-white/40'} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Boleta electrónica</p>
                    <p className="text-white/30 text-xs">Para consumidores finales</p>
                  </div>
                </button>

                <button
                  onClick={() => setDocType(33)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    docType === 33
                      ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${docType === 33 ? 'bg-[#FF6B35]/20' : 'bg-white/5'}`}>
                    <Building2 size={18} className={docType === 33 ? 'text-[#FF6B35]' : 'text-white/40'} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Factura electrónica</p>
                    <p className="text-white/30 text-xs">Para empresas con crédito fiscal</p>
                  </div>
                </button>
              </div>

              {/* Factura receptor form */}
              {docType === 33 && (
                <div className="space-y-3 mb-5 border-t border-white/8 pt-4">
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Datos del receptor</p>

                  {/* RUT con autocompletado */}
                  <div className="relative" ref={suggestRef}>
                    <label className="text-white/40 text-xs mb-1 block">RUT empresa *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={rut}
                        onChange={e => { setRut(e.target.value); setShowSuggestions(true) }}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        placeholder="76354771-K"
                        className={`w-full bg-black/30 border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none transition-colors pr-8 ${
                          rut && !rutValid
                            ? 'border-red-500/50 focus:border-red-500'
                            : 'border-white/10 focus:border-[#FF6B35]/50'
                        }`}
                      />
                      {loadingSuggest && (
                        <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
                      )}
                    </div>
                    {rut && !rutValid && (
                      <p className="text-red-400 text-[10px] mt-1">Formato inválido. Ej: 76354771-K</p>
                    )}

                    {/* Dropdown de sugerencias */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-[#1a1a2e] border border-white/15 rounded-xl shadow-xl overflow-hidden">
                        {suggestions.map(r => (
                          <button
                            key={r.rut}
                            type="button"
                            onMouseDown={() => applyReceptor(r)}
                            className="w-full px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-white text-xs font-semibold truncate">{r.razon_social}</p>
                                <p className="text-white/40 text-[10px] font-mono">{r.rut}</p>
                              </div>
                              <span className="text-white/20 text-[10px] shrink-0">
                                {r.facturas_emitidas} fact.
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Razón social *</label>
                    <input
                      type="text"
                      value={razon}
                      onChange={e => setRazon(e.target.value)}
                      placeholder="Empresa Ejemplo SpA"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Giro *</label>
                    <input
                      type="text"
                      value={giro}
                      onChange={e => setGiro(e.target.value)}
                      placeholder="Servicios de alimentación"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-white/40 text-xs mb-1 block">Dirección *</label>
                      <input
                        type="text"
                        value={direccion}
                        onChange={e => setDireccion(e.target.value)}
                        placeholder="Av. Providencia 1234"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs mb-1 block">Comuna *</label>
                      <input
                        type="text"
                        value={comuna}
                        onChange={e => setComuna(e.target.value)}
                        placeholder="Providencia"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Email — para envío automático del XML cuando sea aceptada */}
                  <div>
                    <label className="text-white/40 text-xs mb-1 flex items-center gap-1.5 block">
                      <Mail size={10} className="text-white/30" />
                      Correo electrónico
                      <span className="text-white/20 text-[10px] font-normal">(opcional — recibe el XML al ser aceptada)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="contabilidad@empresa.cl"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:border-white/20 transition-colors"
                >
                  ← Volver
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!facturaOk || saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Registrando…' : 'Confirmar pago'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
