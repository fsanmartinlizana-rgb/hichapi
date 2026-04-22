'use client'

import { useState, useRef } from 'react'
import { X, ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { SplitTypeSelector, type SplitType } from './SplitTypeSelector'
import { SplitConfiguratorEqual } from './SplitConfiguratorEqual'
import { SplitConfiguratorCustom } from './SplitConfiguratorCustom'
import { SplitConfiguratorByItems } from './SplitConfiguratorByItems'
import { PaymentMethodModal, type DteSelection } from '@/components/PaymentMethodModal'
import { calculateEqualSplits, createCustomSplits, type Split } from '@/lib/bills/split-calculator'

const clp = (n: number) => formatCurrency(n)

interface Order {
  id: string
  total: number
  order_items: Array<{
    id: string
    name: string
    quantity: number
    unit_price: number
  }>
}

interface BillSplitModalProps {
  tableId: string
  tableLabel: string
  orders: Order[]
  totalAmount: number
  pax: number
  restaurantId: string
  onComplete: () => void
  onClose: () => void
}

type Step = 'type' | 'config' | 'payment'

export function BillSplitModal({
  tableId,
  tableLabel,
  orders,
  totalAmount,
  pax,
  restaurantId,
  onComplete,
  onClose
}: BillSplitModalProps) {
  const [step, setStep] = useState<Step>('type')
  const [splitType, setSplitType] = useState<SplitType | null>(null)
  const [splits, setSplits] = useState<Split[]>([])
  const [currentSplitIndex, setCurrentSplitIndex] = useState(0)
  const [billSplitId, setBillSplitId] = useState<string | null>(null)
  const billSplitIdRef = useRef<string | null>(null) // ref para acceso síncrono
  const [creating, setCreating] = useState(false)
  const [processing, setProcessing] = useState(false) // nuevo: evita que el modal se reabra
  const [error, setError] = useState<string | null>(null)

  const currentSplit = splits[currentSplitIndex]
  const allPaid = splits.every(s => s.paid)
  const numPaid = splits.filter(s => s.paid).length

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSelectType(type: SplitType) {
    setSplitType(type)
    setError(null)

    if (type === 'full') {
      setSplits([{ index: 0, amount: totalAmount, paid: false }])
      // Ir directamente a payment para pago completo (sin paso intermedio)
      setStep('payment')
    } else {
      setStep('config')
    }
  }

  function handleConfigureEqual(numPeople: number) {
    setSplits(calculateEqualSplits(totalAmount, numPeople))
    setStep('payment')
  }

  function handleConfigureCustom(amounts: number[]) {
    setSplits(createCustomSplits(amounts))
    setStep('payment')
  }

  function handleConfigureByItems(assignments: Record<string, number>, numPeople: number) {
    // Calcular monto por persona sumando los unit_price de los items asignados
    const totals = Array(numPeople).fill(0) as number[]
    for (const [key, personIndex] of Object.entries(assignments)) {
      if (personIndex < 0) continue
      // Buscar el item por key (puede ser "id" o "id__n" para qty > 1)
      const baseId = key.split('__')[0]
      const item = allItems.find(it => it.id === baseId)
      if (item) totals[personIndex] += item.unit_price
    }
    const newSplits: Split[] = totals
      .map((amount, index) => ({ index, amount, paid: false }))
      .filter(s => s.amount > 0)
    // Re-indexar
    newSplits.forEach((s, i) => { s.index = i })
    setSplits(newSplits)
    setStep('payment')
  }

  // Todos los items de todas las órdenes aplanados
  const allItems = orders.flatMap(o =>
    o.order_items.map(it => ({ ...it, orderId: o.id }))
  )

  function handleBack() {
    setError(null)
    if (step === 'config') {
      setStep('type')
      setSplitType(null)
    } else if (step === 'payment' && currentSplitIndex === 0 && !billSplitId) {
      // Para pago completo, volver directamente a 'type' (sin paso 'config')
      if (splitType === 'full') {
        setStep('type')
        setSplitType(null)
        setSplits([])
      } else {
        // Para otros tipos de división, volver a 'config'
        setStep('config')
      }
    }
  }

  // Recibe los splits resueltos como parámetro para evitar leer estado stale
  async function createBillSplitWith(resolvedSplits: Split[], resolvedType: SplitType): Promise<string> {
    setCreating(true)
    setError(null)

    const splitConfig =
      resolvedType === 'equal'  ? { num_people: resolvedSplits.length } :
      resolvedType === 'custom' ? { amounts: resolvedSplits.map(s => s.amount) } :
      {}

    try {
      const response = await fetch('/api/bills/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          table_id: tableId,
          order_ids: orders.map(o => o.id),
          split_type: resolvedType,
          total_amount: totalAmount,
          num_splits: resolvedSplits.length,
          split_config: splitConfig,
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al crear división')

      // Guardar en ref (síncrono) Y en estado (para UI)
      billSplitIdRef.current = data.bill_split_id as string
      setBillSplitId(data.bill_split_id)
      return data.bill_split_id as string

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      throw err
    } finally {
      setCreating(false)
    }
  }

  async function handlePaymentConfirm(
    method: 'cash' | 'digital' | 'mixed',
    dte: DteSelection,
    cashAmount?: number,
    digitalAmount?: number
  ) {
    const activeSplit = splits[currentSplitIndex]
    if (!activeSplit || processing) return

    // El total real cobrado incluye propina — usar la suma de cash+digital
    // que viene del PaymentMethodModal (ya incluye propina)
    const actualAmount = (cashAmount || 0) + (digitalAmount || 0)
    if (actualAmount === 0) return

    setProcessing(true) // Evitar que el modal se reabra
    try {
      let splitId = billSplitIdRef.current
      if (!splitId) {
        splitId = await createBillSplitWith(splits, splitType!)
      }

      const response = await fetch(`/api/bills/split/${splitId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_index: currentSplitIndex,
          amount: actualAmount,          // total real con propina
          payment_method: method,
          cash_amount: cashAmount || 0,
          digital_amount: digitalAmount || 0,
          dte,
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al procesar pago')

      setSplits(prev => prev.map((s, i) =>
        i === currentSplitIndex ? { ...s, paid: true } : s
      ))

      if (data.completed) {
        // El servidor ya actualizó la mesa a 'libre' y disparó el evento de Realtime
        // El cliente recibirá el evento y redirigirá a la página de review
        onComplete()
      } else {
        setCurrentSplitIndex(prev => prev + 1)
        setProcessing(false) // Permitir siguiente pago
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      setProcessing(false) // Permitir reintentar
    }
  }

  function handleCloseAttempt() {
    if (billSplitId && !allPaid) {
      const confirmed = window.confirm(
        `Hay ${splits.length - numPaid} pagos pendientes. ¿Seguro que quieres cerrar?`
      )
      if (!confirmed) return
    }
    onClose()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-md border border-white/10 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              {step !== 'type' && !billSplitId && (
                <button
                  onClick={handleBack}
                  className="p-1 rounded-lg text-white/40 hover:text-white transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <div>
                <h3 className="text-white font-semibold text-sm">
                  {step === 'type' && 'Cobrar mesa'}
                  {step === 'config' && 'Configurar división'}
                  {step === 'payment' && splits.length > 1 && `Pago ${currentSplitIndex + 1} de ${splits.length}`}
                  {step === 'payment' && splits.length === 1 && 'Procesar pago'}
                </h3>
                <p className="text-white/40 text-xs">
                  {tableLabel} · {orders.length} comanda{orders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Progress indicator */}
              {step === 'payment' && splits.length > 1 && (
                <div className="flex items-center gap-1 mr-2">
                  {splits.map((split, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        split.paid
                          ? 'bg-emerald-400'
                          : i === currentSplitIndex
                            ? 'bg-[#FF6B35]'
                            : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>
              )}

              <button
                onClick={handleCloseAttempt}
                className="text-white/30 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                <X size={12} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {creating && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="text-[#FF6B35] animate-spin" />
              </div>
            )}

            {!creating && (
              <>
                {/* Step 1: Seleccionar tipo */}
                {step === 'type' && (
                  <SplitTypeSelector
                    totalAmount={totalAmount}
                    pax={pax}
                    onSelect={handleSelectType}
                  />
                )}

                {/* Step 2: Configurar división */}
                {step === 'config' && splitType === 'full' && (
                  <div className="space-y-4">
                    <div className="bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[#FF6B35]/70 text-xs font-medium">
                          Pago completo
                        </span>
                        <span className="text-[#FF6B35] font-bold text-2xl" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                          {clp(totalAmount)}
                        </span>
                      </div>
                      <p className="text-white/40 text-xs mt-2">
                        Una persona paga todo
                      </p>
                    </div>

                    <button
                      onClick={() => setStep('payment')}
                      className="w-full py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] transition-colors"
                    >
                      Continuar al pago
                    </button>
                  </div>
                )}

                {step === 'config' && splitType === 'equal' && (
                  <SplitConfiguratorEqual
                    totalAmount={totalAmount}
                    defaultPax={pax}
                    onConfirm={handleConfigureEqual}
                    onBack={handleBack}
                  />
                )}

                {step === 'config' && splitType === 'custom' && (
                  <SplitConfiguratorCustom
                    totalAmount={totalAmount}
                    onConfirm={handleConfigureCustom}
                    onBack={handleBack}
                  />
                )}

                {step === 'config' && splitType === 'by_items' && (
                  <SplitConfiguratorByItems
                    items={allItems}
                    totalAmount={totalAmount}
                    defaultPax={pax}
                    onConfirm={handleConfigureByItems}
                    onBack={handleBack}
                  />
                )}

                {/* Step 3: Procesar pagos - mostrar info antes del modal de pago */}
                {step === 'payment' && currentSplit && !allPaid && (
                  <div className="space-y-4">
                    {/* Info del pago actual */}
                    <div className="bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[#FF6B35]/70 text-xs font-medium">
                          {splits.length > 1 ? `División ${currentSplitIndex + 1}` : 'Total a cobrar'}
                        </span>
                        <span className="text-[#FF6B35] font-bold text-lg" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                          {clp(currentSplit.amount)}
                        </span>
                      </div>
                      {splits.length > 1 && (
                        <p className="text-white/40 text-xs">
                          {numPaid} de {splits.length} pagos completados
                        </p>
                      )}
                    </div>

                    {/* Resumen de divisiones */}
                    {splits.length > 1 && (
                      <div className="space-y-2">
                        <p className="text-white/40 text-xs font-medium">Resumen de divisiones</p>
                        {splits.map((split, i) => (
                          <div
                            key={i}
                            className={`flex items-center justify-between p-2 rounded-lg ${
                              split.paid
                                ? 'bg-emerald-500/10 border border-emerald-500/20'
                                : i === currentSplitIndex
                                  ? 'bg-[#FF6B35]/10 border border-[#FF6B35]/30'
                                  : 'bg-white/3 border border-white/8'
                            }`}
                          >
                            <span className={`text-xs ${
                              split.paid ? 'text-emerald-400' : i === currentSplitIndex ? 'text-[#FF6B35]' : 'text-white/40'
                            }`}>
                              División {i + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${
                                split.paid ? 'text-emerald-400' : i === currentSplitIndex ? 'text-white' : 'text-white/40'
                              }`} style={{ fontFamily: 'var(--font-dm-mono)' }}>
                                {clp(split.amount)}
                              </span>
                              {split.paid && <CheckCircle2 size={14} className="text-emerald-400" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Completado */}
                {allPaid && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} className="text-emerald-400" />
                    </div>
                    <h4 className="text-white font-semibold text-lg mb-2">
                      ¡Pago completado!
                    </h4>
                    <p className="text-white/40 text-sm">
                      {tableLabel} cobrada: {clp(totalAmount)}
                      {splits.length > 1 && ` en ${splits.length} pagos`}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Method Modal - se abre cuando step === 'payment' y hay un split actual */}
      {step === 'payment' && currentSplit && !currentSplit.paid && !creating && !processing && (
        <PaymentMethodModal
          orderId={orders[0].id} // No se usa realmente, pero es requerido
          total={currentSplit.amount}
          restaurantId={restaurantId}
          onConfirm={handlePaymentConfirm}
          onClose={() => {
            // No permitir cerrar el modal de pago si ya se creó el bill_split
            if (!billSplitId) {
              handleBack()
            }
          }}
        />
      )}
    </>
  )
}
