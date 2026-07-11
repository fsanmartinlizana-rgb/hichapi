'use client'

import { useState } from 'react'
import { ChevronDown, Check, Plus, X } from 'lucide-react'
import type { TagGroup } from '@/lib/tags/catalog'

// Reusable grouped tag picker (Airbnb-style amenities).
// Maintains the selected tag values; calls onChange with the new array.

interface TagPickerProps {
  groups: TagGroup[]
  selected: string[]
  onChange: (next: string[]) => void
  max?: number
  allowCustom?: boolean
  size?: 'sm' | 'md'
}

export function TagPicker({
  groups, selected, onChange, max = 30, allowCustom = false, size = 'md',
}: TagPickerProps) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g, i) => [g.key, i < 2]))
  )
  const [customVal, setCustomVal] = useState('')

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter(t => t !== value))
    } else if (selected.length < max) {
      onChange([...selected, value])
    }
  }

  function addCustom() {
    const v = customVal.trim().toLowerCase()
    if (!v) return
    if (selected.includes(v)) return
    if (selected.length >= max) return
    onChange([...selected, v])
    setCustomVal('')
  }

  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs'
  const pad = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1'

  // Detect selected tags that are NOT in any predefined group (custom ones)
  const allKnown = new Set(groups.flatMap(g => g.options.map(o => o.value)))
  const customSelected = selected.filter(v => !allKnown.has(v))

  return (
    <div className="space-y-3">
      {/* Summary + counter */}
      <div className="flex items-center justify-between">
        <p className="text-[var(--text-muted)] text-[10px]">
          {selected.length} / {max} seleccionadas
        </p>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[var(--text-muted)] hover:text-[var(--text-muted)] text-[10px] transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Groups */}
      {groups.map(group => {
        const groupSelected = group.options.filter(o => selected.includes(o.value))
        return (
          <div
            key={group.key}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpen(p => ({ ...p, [group.key]: !p[group.key] }))}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--surface-sunken)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-strong)] text-xs font-semibold">{group.label}</span>
                {groupSelected.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FF6B35]/20 text-[#E55A2B] font-bold">
                    {groupSelected.length}
                  </span>
                )}
              </div>
              <ChevronDown
                size={13}
                className={`text-[var(--text-muted)] transition-transform ${open[group.key] ? 'rotate-180' : ''}`}
              />
            </button>

            {open[group.key] && (
              <div className="p-3 pt-0 border-t border-[var(--border-subtle)]">
                {group.description && (
                  <p className="text-[var(--text-muted)] text-[10px] mt-2 mb-2">{group.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {group.options.map(opt => {
                    const active = selected.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggle(opt.value)}
                        title={opt.description}
                        className={`${pad} ${textSize} rounded-full border flex items-center gap-1 transition-all
                          ${active
                            ? 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#E55A2B]'
                            : 'bg-[var(--surface-sunken)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-subtle)] hover:text-[var(--text-body)]'}`}
                      >
                        {opt.icon && <span className="text-[11px]">{opt.icon}</span>}
                        {opt.label}
                        {active && <Check size={10} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Custom tags */}
      {allowCustom && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 space-y-2">
          <p className="text-[var(--text-strong)] text-xs font-semibold">Otros tags personalizados</p>
          {customSelected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customSelected.map(t => (
                <span
                  key={t}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-body)]"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => toggle(t)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={customVal}
              onChange={e => setCustomVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
              placeholder="Agregar tag personalizado..."
              className="flex-1 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-[var(--text-strong)] text-[11px] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/40"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!customVal.trim()}
              className="px-3 py-1.5 rounded-lg bg-[#FF6B35]/15 border border-[#FF6B35]/30 text-[#E55A2B] text-[11px] font-semibold disabled:opacity-40 hover:bg-[#FF6B35]/25 transition-colors flex items-center gap-1"
            >
              <Plus size={11} /> Añadir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
