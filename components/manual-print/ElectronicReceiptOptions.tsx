'use client'

import { useState } from 'react'
import { Printer, Mail, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { useElectronicReceipt } from '@/lib/manual-print/hooks'
import type { ElectronicReceiptOptionsProps } from '@/lib/manual-print/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

// ── ElectronicReceiptOptions ──────────────────────────────────────────────────

/**
 * ElectronicReceiptOptions
 *
 * Displays two options for delivering the boleta electrónica:
 *   1. Print physically ("Imprimir boleta")
 *   2. Send by email ("Enviar por email")
 *
 * When email is selected, an email input field is shown with real-time
 * validation. Submission is blocked until the email format is valid.
 *
 * All interactive elements meet the 44×44 CSS point minimum touch target
 * requirement (Req 9.1). Options are visually distinct with icons (Req 9.2).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 9.1, 9.2
 */
export function ElectronicReceiptOptions({
  total,
  restaurantId,
  onPrintSelected,
  onEmailSelected,
  onCancel,
  loading,
}: ElectronicReceiptOptionsProps) {
  // 'none' | 'print' | 'email'
  const [selectedOption, setSelectedOption] = useState<'none' | 'print' | 'email'>('none')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | undefined>(undefined)

  const { emailValidation, validateEmail } = useElectronicReceipt(
    restaurantId,
    '', // orderId not needed for validation
    total
  )

  const isProcessing = loading
  const isSuccess = submitStatus === 'success'
  const isError = submitStatus === 'error'

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handlePrintSubmit() {
    if (isProcessing || isSuccess) return
    setSubmitStatus('idle')
    setSubmitError(undefined)
    try {
      await onPrintSelected()
      setSubmitStatus('success')
    } catch (err) {
      setSubmitStatus('error')
      setSubmitError(err instanceof Error ? err.message : 'Error al imprimir boleta')
    }
  }

  async function handleEmailSubmit() {
    if (isProcessing || isSuccess || !emailValidation.isValid) return
    setSubmitStatus('idle')
    setSubmitError(undefined)
    try {
      await onEmailSelected(emailValidation.email.trim())
      setSubmitStatus('success')
    } catch (err) {
      setSubmitStatus('error')
      setSubmitError(err instanceof Error ? err.message : 'Error al enviar boleta por email')
    }
  }

  function handleRetry() {
    setSubmitStatus('idle')
    setSubmitError(undefined)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="px-4 py-3 border-t space-y-3"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Section label */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
        Boleta electrónica
      </p>

      {/* Total display */}
      <p className="text-xs text-white/50">
        Total:{' '}
        <span className="text-white/80 font-semibold">{formatCurrency(total)}</span>
      </p>

      {/* Success state */}
      {isSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-emerald-400">
          <CheckCircle2 size={15} className="shrink-0" />
          <p className="text-sm font-semibold">
            {selectedOption === 'email'
              ? 'Boleta enviada por email'
              : 'Boleta enviada a impresora'}
          </p>
        </div>
      )}

      {/* Error state */}
      {isError && submitError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
          <AlertCircle size={13} className="shrink-0 mt-0.5 text-red-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-300 leading-snug">{submitError}</p>
            <button
              onClick={handleRetry}
              className="mt-1.5 text-[11px] font-semibold text-red-400 hover:text-red-300 underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Option selector — only shown when not yet succeeded (Req 3.1) */}
      {!isSuccess && (
        <div className="grid grid-cols-2 gap-2">
          {/* Print option — Req 3.2, 9.1, 9.2 */}
          <button
            onClick={() => !isProcessing && setSelectedOption('print')}
            disabled={isProcessing}
            aria-pressed={selectedOption === 'print'}
            aria-label="Imprimir boleta"
            className={[
              // Base — min 44px height for touch targets (Req 9.1)
              'min-h-[44px] flex flex-col items-center justify-center gap-1.5',
              'rounded-xl border text-xs font-semibold',
              'transition-all duration-200',
              isProcessing ? 'cursor-not-allowed opacity-50' : 'active:scale-[0.97]',
              // Selected vs unselected styles (Req 9.2)
              selectedOption === 'print'
                ? 'bg-[#FF6B35]/15 border-[#FF6B35]/50 text-[#FF6B35]'
                : 'bg-white/5 border-white/12 text-white/60 hover:bg-white/8 hover:border-white/20 hover:text-white/80',
            ].join(' ')}
          >
            <Printer size={18} className="shrink-0" />
            <span>Imprimir boleta</span>
          </button>

          {/* Email option — Req 3.3, 9.1, 9.2 */}
          <button
            onClick={() => !isProcessing && setSelectedOption('email')}
            disabled={isProcessing}
            aria-pressed={selectedOption === 'email'}
            aria-label="Enviar por email"
            className={[
              // Base — min 44px height for touch targets (Req 9.1)
              'min-h-[44px] flex flex-col items-center justify-center gap-1.5',
              'rounded-xl border text-xs font-semibold',
              'transition-all duration-200',
              isProcessing ? 'cursor-not-allowed opacity-50' : 'active:scale-[0.97]',
              // Selected vs unselected styles (Req 9.2)
              selectedOption === 'email'
                ? 'bg-blue-500/15 border-blue-500/50 text-blue-400'
                : 'bg-white/5 border-white/12 text-white/60 hover:bg-white/8 hover:border-white/20 hover:text-white/80',
            ].join(' ')}
          >
            <Mail size={18} className="shrink-0" />
            <span>Enviar por email</span>
          </button>
        </div>
      )}

      {/* Email input — shown when email option is selected (Req 3.3) */}
      {selectedOption === 'email' && !isSuccess && (
        <div className="space-y-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="correo@ejemplo.com"
            value={emailValidation.email}
            onChange={e => validateEmail(e.target.value)}
            disabled={isProcessing}
            aria-label="Correo electrónico del cliente"
            aria-invalid={
              emailValidation.email.length > 0 && !emailValidation.isValid
            }
            className={[
              // Min 44px height for touch target (Req 9.1)
              'w-full min-h-[44px] rounded-xl border px-3 py-2',
              'bg-white/5 text-sm text-white placeholder:text-white/30',
              'outline-none transition-all duration-200',
              'focus:ring-1',
              isProcessing ? 'cursor-not-allowed opacity-50' : '',
              emailValidation.email.length > 0 && !emailValidation.isValid
                ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/30'
                : emailValidation.isValid
                ? 'border-emerald-500/40 focus:border-emerald-500/60 focus:ring-emerald-500/20'
                : 'border-white/12 focus:border-white/30 focus:ring-white/10',
            ].join(' ')}
          />

          {/* Inline validation error (Req 3.4) */}
          {emailValidation.email.length > 0 && !emailValidation.isValid && (
            <div className="flex items-center gap-1.5 text-red-400/80">
              <AlertCircle size={11} className="shrink-0" />
              <p className="text-[11px]">{emailValidation.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {selectedOption !== 'none' && !isSuccess && (
        <div className="flex gap-2">
          {/* Cancel */}
          <button
            onClick={onCancel}
            disabled={isProcessing}
            aria-label="Cancelar"
            className={[
              'min-h-[44px] flex-1 rounded-xl border border-white/12 bg-white/5',
              'text-sm font-semibold text-white/50',
              'transition-all duration-200',
              isProcessing
                ? 'cursor-not-allowed opacity-40'
                : 'hover:bg-white/8 hover:text-white/70 active:scale-[0.98]',
            ].join(' ')}
          >
            Cancelar
          </button>

          {/* Confirm — Req 3.2 (print) / Req 3.4, 3.5 (email) */}
          <button
            onClick={
              selectedOption === 'print' ? handlePrintSubmit : handleEmailSubmit
            }
            disabled={
              isProcessing ||
              (selectedOption === 'email' && !emailValidation.isValid)
            }
            aria-label={
              isProcessing
                ? 'Procesando…'
                : selectedOption === 'print'
                ? 'Confirmar impresión'
                : 'Confirmar envío por email'
            }
            className={[
              'min-h-[44px] flex-[2] flex items-center justify-center gap-2',
              'rounded-xl border text-sm font-semibold',
              'transition-all duration-200',
              isProcessing
                ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                : selectedOption === 'email' && !emailValidation.isValid
                ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                : selectedOption === 'print'
                ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35] hover:bg-[#FF6B35]/20 active:scale-[0.98]'
                : 'bg-blue-500/15 border-blue-500/40 text-blue-400 hover:bg-blue-500/20 active:scale-[0.98]',
            ].join(' ')}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={14} className="animate-spin shrink-0" />
                <span>Procesando…</span>
              </>
            ) : selectedOption === 'print' ? (
              <>
                <Printer size={14} className="shrink-0" />
                <span>Imprimir</span>
              </>
            ) : (
              <>
                <Mail size={14} className="shrink-0" />
                <span>Enviar</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Cancel-only button when no option selected yet */}
      {selectedOption === 'none' && !isSuccess && (
        <button
          onClick={onCancel}
          disabled={isProcessing}
          aria-label="Cancelar"
          className={[
            'w-full min-h-[44px] rounded-xl border border-white/12 bg-white/5',
            'text-sm font-semibold text-white/50',
            'transition-all duration-200',
            isProcessing
              ? 'cursor-not-allowed opacity-40'
              : 'hover:bg-white/8 hover:text-white/70 active:scale-[0.98]',
          ].join(' ')}
        >
          Cancelar
        </button>
      )}
    </div>
  )
}
