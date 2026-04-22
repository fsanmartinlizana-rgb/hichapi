'use client'

import type { StepMapaMesasProps, TableOption } from './types'
import { groupByZone } from './utils'
import Link from 'next/link'

const STATUS_CLASSES: Record<TableOption['status'], string> = {
  libre:     'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25',
  ocupada:   'bg-amber-500/15  border-amber-500/50  text-amber-300   hover:bg-amber-500/25',
  reservada: 'bg-blue-500/10   border-blue-500/30   text-blue-400/50   pointer-events-none opacity-50',
  bloqueada: 'bg-white/5       border-white/10      text-white/25      pointer-events-none opacity-50',
}

function TableCard({ table, selected, onSelect }: { table: TableOption; selected: boolean; onSelect: (t: TableOption) => void }) {
  const isSelectable = table.status === 'libre' || table.status === 'ocupada'
  const isSelected = selected && isSelectable
  return (
    <button
      type="button"
      onClick={() => isSelectable && onSelect(table)}
      className={[
        'flex flex-col items-center justify-center rounded-xl border-2 p-4 text-sm font-semibold transition-all',
        STATUS_CLASSES[table.status],
        isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0D0D1A]' : '',
        !isSelectable ? 'cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
      aria-pressed={isSelected}
      aria-label={`${table.label} — ${table.status}`}
    >
      {table.label}
      {table.status === 'ocupada' && (
        <span className="mt-1 text-[10px] font-normal text-amber-400/70">ocupada</span>
      )}
    </button>
  )
}

function PaxSelector({ pax, onChange }: { pax: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center gap-3 mt-4">
      <span className="text-sm font-medium text-white/60">Personas:</span>
      <button
        type="button"
        onClick={() => onChange(pax - 1)}
        disabled={pax <= 1}
        className="w-8 h-8 rounded-full border border-white/20 bg-white/8 flex items-center justify-center text-lg font-bold text-white/80 disabled:opacity-30 hover:bg-white/15 transition-colors"
        aria-label="Reducir personas"
      >−</button>
      <span className="w-6 text-center font-semibold text-white">{pax}</span>
      <button
        type="button"
        onClick={() => onChange(pax + 1)}
        disabled={pax >= 20}
        className="w-8 h-8 rounded-full border border-white/20 bg-white/8 flex items-center justify-center text-lg font-bold text-white/80 disabled:opacity-30 hover:bg-white/15 transition-colors"
        aria-label="Aumentar personas"
      >+</button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-base font-medium text-white/50 mb-2">No hay mesas disponibles</p>
      <Link href="/mesas" className="text-sm text-indigo-400 hover:underline">
        Ir a configuración de mesas
      </Link>
    </div>
  )
}

export default function StepMapaMesas({ tables, selectedTable, pax, onSelectTable, onChangePax, onConfirm }: StepMapaMesasProps) {
  if (tables.length === 0) return <EmptyState />

  const grouped = groupByZone(tables)
  const keys = Object.keys(grouped)
  const hasZones = !(keys.length === 1 && keys[0] === '')
  const isOcupada = selectedTable?.status === 'ocupada'

  return (
    <div className="flex flex-col gap-6">
      {keys.map(zone => (
        <div key={zone}>
          {hasZones && zone && (
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/35 mb-3">{zone}</h3>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {grouped[zone].map(table => (
              <TableCard key={table.id} table={table} selected={selectedTable?.id === table.id} onSelect={onSelectTable} />
            ))}
          </div>
        </div>
      ))}

      {selectedTable !== null && !isOcupada && <PaxSelector pax={pax} onChange={onChangePax} />}

      {isOcupada && (
        <p className="text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
          Esta mesa tiene una comanda activa. Los productos se agregarán a esa comanda.
        </p>
      )}

      <button
        type="button"
        onClick={onConfirm}
        disabled={selectedTable === null || (!isOcupada && pax < 1)}
        className={[
          'mt-2 w-full sm:w-auto sm:self-end rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors',
          isOcupada
            ? 'bg-amber-600 hover:bg-amber-500'
            : 'bg-emerald-600 hover:bg-emerald-500',
        ].join(' ')}
      >
        {isOcupada ? 'Agregar a comanda' : 'Confirmar mesa'}
      </button>
    </div>
  )
}
