'use client'

import { useState, useMemo } from 'react'
import { Plus, Minus, CheckCircle2, AlertCircle, User } from 'lucide-react'
import { formatCurrency } from '@/lib/i18n'

const clp = (n: number) => formatCurrency(n)

interface OrderItem {
  id: string
  name: string
  quantity: number
  unit_price: number
  orderId: string // para identificar de qué comanda viene
}

interface SplitConfiguratorByItemsProps {
  items: OrderItem[]
  totalAmount: number
  defaultPax: number
  onConfirm: (assignments: Record<string, number>, numPeople: number) => void
  onBack: () => void
}

// Colores por persona
const PERSON_COLORS = [
  { bg: 'bg-blue-500/20',   border: 'border-blue-500/40',   text: 'text-blue-300',   dot: 'bg-blue-400'   },
  { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-300', dot: 'bg-violet-400' },
  { bg: 'bg-emerald-500/20',border: 'border-emerald-500/40',text: 'text-emerald-300',dot: 'bg-emerald-400'},
  { bg: 'bg-amber-500/20',  border: 'border-amber-500/40',  text: 'text-amber-300',  dot: 'bg-amber-400'  },
  { bg: 'bg-pink-500/20',   border: 'border-pink-500/40',   text: 'text-pink-300',   dot: 'bg-pink-400'   },
  { bg: 'bg-cyan-500/20',   border: 'border-cyan-500/40',   text: 'text-cyan-300',   dot: 'bg-cyan-400'   },
]

function getColor(personIndex: number) {
  return PERSON_COLORS[personIndex % PERSON_COLORS.length]
}

export function SplitConfiguratorByItems({
  items,
  totalAmount,
  defaultPax,
  onConfirm,
  onBack,
}: SplitConfiguratorByItemsProps) {
  const [numPeople, setNumPeople] = useState(Math.max(2, defaultPax))
  // assignments: itemId → personIndex (0-based). -1 = sin asignar
  const [assignments, setAssignments] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map(it => [it.id, -1]))
  )

  // Expandir items con quantity > 1 en unidades individuales
  const expandedItems = useMemo(() => {
    const result: Array<{ key: string; name: string; unit_price: number; originalId: string }> = []
    for (const item of items) {
      if (item.quantity === 1) {
        result.push({ key: item.id, name: item.name, unit_price: item.unit_price, originalId: item.id })
      } else {
        for (let i = 0; i < item.quantity; i++) {
          result.push({
            key: `${item.id}__${i}`,
            name: `${item.name}`,
            unit_price: item.unit_price,
            originalId: item.id,
          })
        }
      }
    }
    return result
  }, [items])

  // Estado de asignaciones por unidad expandida
  const [unitAssignments, setUnitAssignments] = useState<Record<string, number>>(() =>
    Object.fromEntries(expandedItems.map(it => [it.key, -1]))
  )

  // Totales por persona
  const totalsPerPerson = useMemo(() => {
    const totals = Array(numPeople).fill(0) as number[]
    for (const item of expandedItems) {
      const person = unitAssignments[item.key]
      if (person >= 0 && person < numPeople) {
        totals[person] += item.unit_price
      }
    }
    return totals
  }, [expandedItems, unitAssignments, numPeople])

  const unassignedCount = expandedItems.filter(it => unitAssignments[it.key] === -1).length
  const allAssigned = unassignedCount === 0
  const sumAssigned = totalsPerPerson.reduce((a, b) => a + b, 0)

  function assignUnit(key: string, personIndex: number) {
    setUnitAssignments(prev => ({ ...prev, [key]: personIndex }))
  }

  function assignAllToPerson(personIndex: number) {
    setUnitAssignments(prev => {
      const next = { ...prev }
      for (const item of expandedItems) {
        if (next[item.key] === -1) next[item.key] = personIndex
      }
      return next
    })
  }

  function clearAssignments() {
    setUnitAssignments(Object.fromEntries(expandedItems.map(it => [it.key, -1])))
  }

  function handleConfirm() {
    if (!allAssigned) return
    // Convertir unitAssignments de vuelta a assignments por originalId
    // (para items con qty > 1, usamos el primer personIndex encontrado — simplificación)
    const result: Record<string, number> = {}
    for (const item of expandedItems) {
      result[item.key] = unitAssignments[item.key]
    }
    onConfirm(result, numPeople)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-semibold text-base mb-1">Dividir por items</h3>
        <p className="text-white/40 text-xs">
          Total: <span className="text-white font-semibold">{clp(totalAmount)}</span>
        </p>
      </div>

      {/* Selector de número de personas */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
        <span className="text-white/50 text-xs flex-1">Número de personas</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (numPeople > 2) {
                setNumPeople(p => p - 1)
                // Limpiar asignaciones de la persona eliminada
                setUnitAssignments(prev => {
                  const next = { ...prev }
                  for (const key of Object.keys(next)) {
                    if (next[key] === numPeople - 1) next[key] = -1
                  }
                  return next
                })
              }
            }}
            disabled={numPeople <= 2}
            className="w-7 h-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/12 transition-colors"
          >
            <Minus size={12} />
          </button>
          <span className="text-white font-bold w-4 text-center text-sm">{numPeople}</span>
          <button
            onClick={() => numPeople < 6 && setNumPeople(p => p + 1)}
            disabled={numPeople >= 6}
            className="w-7 h-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/12 transition-colors"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Leyenda de personas */}
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: numPeople }, (_, i) => {
          const c = getColor(i)
          return (
            <button
              key={i}
              onClick={() => assignAllToPerson(i)}
              title={`Asignar todos los sin asignar a Persona ${i + 1}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all hover:opacity-80 ${c.bg} ${c.border} ${c.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              P{i + 1}
              {totalsPerPerson[i] > 0 && (
                <span className="opacity-70 font-normal">{clp(totalsPerPerson[i])}</span>
              )}
            </button>
          )
        })}
        {unassignedCount > 0 && (
          <button
            onClick={clearAssignments}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-white/30 text-xs hover:text-white/50 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Lista de items */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {expandedItems.map((item) => {
          const assigned = unitAssignments[item.key]
          const c = assigned >= 0 ? getColor(assigned) : null

          return (
            <div
              key={item.key}
              className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                c ? `${c.bg} ${c.border}` : 'bg-white/3 border-white/8'
              }`}
            >
              {/* Nombre y precio */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${c ? c.text : 'text-white/70'}`}>
                  {item.name}
                </p>
                <p className="text-white/30 text-[10px]" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  {clp(item.unit_price)}
                </p>
              </div>

              {/* Botones de asignación */}
              <div className="flex items-center gap-1 shrink-0">
                {Array.from({ length: numPeople }, (_, i) => {
                  const pc = getColor(i)
                  const isSelected = assigned === i
                  return (
                    <button
                      key={i}
                      onClick={() => assignUnit(item.key, isSelected ? -1 : i)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                        isSelected
                          ? `${pc.bg} ${pc.border} ${pc.text} scale-110`
                          : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10'
                      }`}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Estado de asignación */}
      <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs ${
        allAssigned
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-white/5 border-white/10 text-white/40'
      }`}>
        {allAssigned
          ? <><CheckCircle2 size={13} /> Todos los items asignados</>
          : <><AlertCircle size={13} /> {unassignedCount} item{unassignedCount !== 1 ? 's' : ''} sin asignar</>
        }
      </div>

      {/* Resumen por persona */}
      {allAssigned && (
        <div className="grid grid-cols-2 gap-1.5">
          {Array.from({ length: numPeople }, (_, i) => {
            const c = getColor(i)
            return (
              <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${c.bg} ${c.border}`}>
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${c.text}`}>
                  <User size={10} /> P{i + 1}
                </span>
                <span className={`text-xs font-bold ${c.text}`} style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  {clp(totalsPerPerson[i])}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:border-white/20 hover:text-white transition-colors"
        >
          ← Volver
        </button>
        <button
          onClick={handleConfirm}
          disabled={!allAssigned}
          className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}
