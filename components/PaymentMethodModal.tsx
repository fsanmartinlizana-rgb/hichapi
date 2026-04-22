'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Banknote, CreditCard, Layers, Building2, Loader2, Mail } from 'lucide-react'
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
  // Payment method
  const [method, setMethod]     = useState<'cash' | 'digital' | 'mixed' | null>(null)
  const [cashPart, setCashPart] = useState('')
  const [saving, setSaving]     = useState(false)

  // Propina — por defecto 10%, editable
  const [tipPct, setTipPct]       = useState(10)
  const [tipCustom, setTipCustom] = useState('')
  const [tipMode, setTipMode]     = useState<'pct' | 'custom'>('pct')

  const tipAmount  = tipMode === 'pct'
    ? Math.round(total * tipPct / 100)
    : Math.max(0, parseInt(tipCustom) || 0)
  const grandTotal = total + tipAmount

  // Invoice toggle - visible from the start
  const [needsInvoice, setNeedsInvoice] = useState(false)

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

  const digitalPart = method === 'mixed' ? Math.max(0, grandTotal - (parseInt(cashPart) || 0)) : 0

  // Map payment method → fma_pago
  const fmaPago: 1 | 2 | 3 = method === 'cash' ? 1 : method === 'digital' ? 2 : 1

  // Factura form validation
  const rutValid  = !needsInvoice || isValidRut(rut)
  const facturaOk = !needsInvoice || (
    rutValid && razon.trim() && giro.trim() && direccion.trim() && comuna.trim()
  )

  // ── Autocompletado por RUT ─────────────────────────────────────────────────

  useEffect(() => {
    if (!needsInvoice || rut.length < 3) {
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
  }, [rut, needsInvoice, restaurantId])

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

  async function handleConfirm() {
    if (!method || !facturaOk || saving) return
    if (method === 'mixed' && !cashPart) return
    setSaving(true)

    const dte: DteSelection = needsInvoice
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
        await onConfirm('cash', dte, grandTotal, 0)
      } else if (method === 'digital') {
        await onConfirm('digital', dte, 0, grandTotal)
      } else {
        const cash    = parseInt(cashPart) || 0
        const digital = Math.max(0, grandTotal - cash)
        await onConfirm('mixed', dte, cash, digital)
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Prevent closing when clicking backdrop if saving
        if (e.target === e.currentTarget && !saving) {
          onClose()
        }
      }}
    >
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-sm border border-white/10 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h3 className="text-white font-semibold text-sm">Método de pago</h3>
            <p className="text-white/40 text-xs">
              Subtotal: {clp(total)}
              {tipAmount > 0 && <span className="text-emerald-400"> + {clp(tipAmount)} propina = <span className="text-white font-semibold">{clp(grandTotal)}</span></span>}
              {tipAmount === 0 && <span> · Sin propina</span>}
            </p>
          </div>
          <button 
            onClick={onClose} 
            disabled={saving}
            className="text-white/30 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 max-h-[80vh] overflow-y-auto">

          {/* Propina */}
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-emerald-300 text-xs font-semibold">Propina</span>
              <span className="text-emerald-400 font-bold text-sm" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                {clp(tipAmount)}
              </span>
            </div>

            {/* Botones de porcentaje rápido */}
            <div className="flex gap-1.5 mb-2.5">
              {[0, 5, 10, 15, 20].map(pct => (
                <button
                  key={pct}
                  onClick={() => { setTipPct(pct); setTipMode('pct'); setTipCustom('') }}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    tipMode === 'pct' && tipPct === pct
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                      : 'bg-white/5 text-white/40 border border-white/8 hover:bg-white/8'
                  }`}
                >
                  {pct === 0 ? 'Sin' : `${pct}%`}
                </button>
              ))}
            </div>

            {/* Monto personalizado */}
            <div className="flex items-center gap-2">
              <span className="text-white/30 text-xs shrink-0">Monto fijo:</span>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">$</span>
                <input
                  type="number"
                  value={tipCustom}
                  onChange={e => { setTipCustom(e.target.value); setTipMode('custom') }}
                  onFocus={() => setTipMode('custom')}
                  placeholder="0"
                  min={0}
                  className={`w-full bg-black/30 border rounded-lg pl-6 pr-2 py-1.5 text-white text-xs focus:outline-none transition-colors ${
                    tipMode === 'custom'
                      ? 'border-emerald-500/50'
                      : 'border-white/10 focus:border-emerald-500/30'
                  }`}
                  style={{ fontFamily: 'var(--font-dm-mono)' }}
                />
              </div>
            </div>

            {/* Total con propina */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-500/15">
              <span className="text-white/50 text-xs">Total a cobrar</span>
              <span className="text-white font-bold text-base" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                {clp(grandTotal)}
              </span>
            </div>
          </div>

          {/* Payment methods */}
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

          {/* Mixed payment input */}
          {method === 'mixed' && (
            <div className="mb-5">
              <label className="text-white/40 text-xs mb-1.5 block">Parte en efectivo (CLP)</label>
              <input
                type="number"
                value={cashPart}
                onChange={e => setCashPart(e.target.value)}
                placeholder="0"
                max={grandTotal}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
              />
              {cashPart && (
                <p className="text-white/30 text-xs mt-1">Digital: {clp(digitalPart)}</p>
              )}
            </div>
          )}

          {/* Invoice toggle - visible from the start */}
          <div className="mb-5 p-3.5 rounded-xl bg-blue-500/8 border border-blue-500/20">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">¿Necesitas factura?</p>
                  <p className="text-white/30 text-xs">Para empresas con crédito fiscal</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={needsInvoice}
                  onChange={e => setNeedsInvoice(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 rounded-full peer-checked:bg-[#FF6B35] transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>
          </div>

          {/* Invoice form - shown conditionally */}
          {needsInvoice && (
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

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!method || (method === 'mixed' && !cashPart) || !facturaOk || saving}
              className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Procesando…' : 'Confirmar pago'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
