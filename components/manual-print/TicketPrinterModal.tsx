'use client'

/**
 * TicketPrinterModal
 *
 * Shown when there are multiple printers of the same kind (cocina/barra)
 * and the waiter needs to choose which one to send the ticket to.
 *
 * Groups items by destination, then for each group that has multiple printers
 * asks the waiter to pick one. Groups with a single printer are sent automatically.
 */

import { useState } from 'react'
import { Printer, ChefHat, Wine, X, Send, Check } from 'lucide-react'

export interface PrinterOption {
  id:   string
  name: string
}

export interface TicketGroup {
  /** 'cocina' | 'barra' */
  kind:     string
  /** Items in this group */
  items:    Array<{ nombre: string; cantidad: number; observacion: string }>
  /** Available printers for this kind */
  printers: PrinterOption[]
  /** Auto-selected if only one printer */
  autoSelected?: string
}

interface TicketPrinterModalProps {
  groups:    TicketGroup[]
  onConfirm: (selections: Record<string, string>) => void   // kind → printerName
  onCancel:  () => void
}

const KIND_LABEL: Record<string, string> = {
  cocina: 'Cocina',
  barra:  'Barra',
}

const KIND_ICON: Record<string, typeof ChefHat> = {
  cocina: ChefHat,
  barra:  Wine,
}

const KIND_COLOR: Record<string, string> = {
  cocina: '#FBBF24',
  barra:  '#60A5FA',
}

export function TicketPrinterModal({ groups, onConfirm, onCancel }: TicketPrinterModalProps) {
  // Only groups that need selection (multiple printers)
  const needsSelection = groups.filter(g => g.printers.length > 1)
  const autoGroups     = groups.filter(g => g.printers.length === 1)

  // Initial selections: auto-fill single-printer groups
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    autoGroups.forEach(g => { init[g.kind] = g.printers[0].name })
    return init
  })

  const allSelected = needsSelection.every(g => !!selections[g.kind])

  function handleConfirm() {
    if (!allSelected) return
    onConfirm(selections)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
        style={{ background: '#161622' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-[#FF6B35]" />
            <p className="text-white font-semibold text-sm">Enviar tickets</p>
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Auto-send groups (single printer) */}
          {autoGroups.map(g => {
            const Icon  = KIND_ICON[g.kind] ?? Printer
            const color = KIND_COLOR[g.kind] ?? '#FF6B35'
            return (
              <div
                key={g.kind}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                style={{ borderColor: color + '30', background: color + '08' }}
              >
                <Icon size={14} style={{ color }} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color }}>
                    {KIND_LABEL[g.kind] ?? g.kind} → <span className="font-mono">{g.printers[0].name}</span>
                  </p>
                  <p className="text-[10px] text-white/35 mt-0.5">
                    {g.items.length} ítem{g.items.length !== 1 ? 's' : ''} · envío automático
                  </p>
                </div>
                <Check size={13} className="text-emerald-400 shrink-0" />
              </div>
            )
          })}

          {/* Groups that need selection */}
          {needsSelection.map(g => {
            const Icon  = KIND_ICON[g.kind] ?? Printer
            const color = KIND_COLOR[g.kind] ?? '#FF6B35'
            return (
              <div key={g.kind} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon size={13} style={{ color }} />
                  <p className="text-xs font-semibold" style={{ color }}>
                    {KIND_LABEL[g.kind] ?? g.kind}
                  </p>
                  <span className="text-[10px] text-white/30">
                    ({g.items.length} ítem{g.items.length !== 1 ? 's' : ''})
                  </span>
                </div>

                {/* Items preview */}
                <div className="px-2 space-y-0.5">
                  {g.items.map((item, i) => (
                    <p key={i} className="text-[11px] text-white/50">
                      {item.cantidad}× {item.nombre}
                      {item.observacion && <span className="text-amber-400/60"> · {item.observacion}</span>}
                    </p>
                  ))}
                </div>

                {/* Printer selector */}
                <div className="grid grid-cols-2 gap-1.5">
                  {g.printers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelections(prev => ({ ...prev, [g.kind]: p.name }))}
                      className={[
                        'py-2.5 px-3 rounded-xl border text-xs font-mono font-semibold transition-all',
                        selections[g.kind] === p.name
                          ? 'text-white'
                          : 'bg-white/3 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20',
                      ].join(' ')}
                      style={
                        selections[g.kind] === p.name
                          ? { background: color + '20', borderColor: color + '50', color }
                          : {}
                      }
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allSelected}
            className="flex-[2] py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Send size={14} />
            Enviar tickets
          </button>
        </div>
      </div>
    </div>
  )
}
