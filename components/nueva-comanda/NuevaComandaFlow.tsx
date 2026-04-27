'use client'

import { useState, useEffect } from 'react'
import type { NuevaComandaFlowProps, FlowState, OrderLine, MenuItemOption, TableOption } from './types'
import { getDefaultDestination } from './utils'
import FlowProgressBar from './FlowProgressBar'
import StepMapaMesas from './StepMapaMesas'
import StepCatalogoVisual from './StepCatalogoVisual'
import StepConfirmacion from './StepConfirmacion'

export default function NuevaComandaFlow({
  onClose,
  onSave,
  tables,
  menuItems,
  restaurantId,
}: NuevaComandaFlowProps) {
  const [step, setStep] = useState<FlowState['step']>(0)
  const [selectedTable, setSelectedTable] = useState<TableOption | null>(null)
  const [pax, setPax] = useState(2)
  const [lines, setLines] = useState<OrderLine[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saving, onClose])

  function handleSelectTable(table: TableOption) { setSelectedTable(table) }
  function handleChangePax(value: number) { setPax(Math.min(20, Math.max(1, value))) }
  function handleConfirmMesa() { setStep(1) }

  function handleAddItem(item: MenuItemOption) {
    setLines(prev => {
      const existing = prev.find(l => l.menuItemId === item.id)
      if (existing) return prev.map(l => l.menuItemId === item.id ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { menuItemId: item.id, name: item.name, unitPrice: item.price, qty: 1, note: '', destination: getDefaultDestination(item) }]
    })
  }

  function handleUpdateLine(menuItemId: string, patch: Partial<OrderLine>) {
    setLines(prev => prev.map(l => l.menuItemId === menuItemId ? { ...l, ...patch } : l))
  }

  function handleRemoveLine(menuItemId: string) {
    setLines(prev => prev.filter(l => l.menuItemId !== menuItemId))
  }

  function handleContinue() { setStep(2) }
  function handleBack() { setStep(prev => (prev > 0 ? ((prev - 1) as FlowState['step']) : prev)) }

  async function handleConfirm() {
    if (!selectedTable) return
    setSaving(true)
    setError(null)

    // Usamos /api/orders/internal (server-side) en vez de inserts directos
    // a Supabase desde el cliente. Tres motivos:
    //   1. Resuelve station_id por cada item (override por plato + routing
    //      por categoria) igual que el flujo publico del QR. Sin esto las
    //      comandas manuales nunca rutean cross-local aunque la config
    //      este bien.
    //   2. Hace rollback del order padre si falla el insert de items.
    //   3. Centraliza logica que antes estaba duplicada cliente/server.
    try {
      const res = await fetch('/api/orders/internal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          restaurant_id: restaurantId,
          table_id:      selectedTable.id,
          cart: lines.map(l => ({
            menu_item_id: l.menuItemId,
            name:         l.name,
            quantity:     l.qty,
            unit_price:   l.unitPrice,
            note:         l.note || null,
            destination:  l.destination,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('[nueva-comanda] orders/internal failed:', data)
        // data.details puede ser un array de Zod issues (objetos) → si lo
        // ponemos en template literal sale "[object Object]". Lo
        // normalizamos a algo legible para que el restorant sepa qué
        // ajustar (campo, motivo).
        let detailStr = ''
        if (data.details) {
          if (Array.isArray(data.details)) {
            detailStr = data.details
              .map((d: { path?: string[]; message?: string }) =>
                d?.message
                  ? `${d.path?.join('.') ?? '?'}: ${d.message}`
                  : JSON.stringify(d),
              )
              .join('; ')
          } else if (typeof data.details === 'string') {
            detailStr = data.details
          } else {
            detailStr = JSON.stringify(data.details)
          }
        }
        const fullError = `${data.error ?? 'No se pudo crear la comanda'}${detailStr ? ` · ${detailStr}` : ''}`
        setError(fullError)
        return
      }
      onSave()
    } catch (err) {
      console.error('[nueva-comanda] network error:', err)
      setError('Sin conexión. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0D0D1A' }}>
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex-1">
          <FlowProgressBar currentStep={step} />
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label="Cerrar"
          className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/8 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-40 text-xl transition-colors"
        >
          ×
        </button>
      </header>

      {/* Body */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {step === 0 && (
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <StepMapaMesas
              tables={tables} selectedTable={selectedTable} pax={pax}
              onSelectTable={handleSelectTable} onChangePax={handleChangePax} onConfirm={handleConfirmMesa}
            />
          </div>
        )}
        {step === 1 && (
          <StepCatalogoVisual
            menuItems={menuItems} lines={lines}
            onAddItem={handleAddItem} onUpdateLine={handleUpdateLine} onRemoveLine={handleRemoveLine}
            onContinue={handleContinue} onBack={handleBack}
          />
        )}
        {step === 2 && selectedTable && (
          <StepConfirmacion
            selectedTable={selectedTable} pax={pax} lines={lines}
            saving={saving} error={error} onConfirm={handleConfirm} onBack={handleBack}
          />
        )}
      </main>
    </div>
  )
}
