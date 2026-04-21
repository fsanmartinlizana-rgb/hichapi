'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Check, ChevronDown } from 'lucide-react'

interface ActecoCode {
  code: string
  description: string
  category: 'restaurant' | 'food_service' | 'retail' | 'other'
}

interface ActecoSelectorProps {
  value?: string
  onChange: (code: string, description: string) => void
  placeholder?: string
  className?: string
}

const CATEGORY_LABELS: Record<ActecoCode['category'], string> = {
  restaurant:   'Restaurante',
  food_service: 'Servicio de comida',
  retail:       'Retail',
  other:        'Otro',
}

const CATEGORY_COLORS: Record<ActecoCode['category'], string> = {
  restaurant:   'bg-orange-100 text-orange-800',
  food_service: 'bg-blue-100 text-blue-800',
  retail:       'bg-green-100 text-green-800',
  other:        'bg-gray-100 text-gray-800',
}

export function ActecoSelector({
  value,
  onChange,
  placeholder = 'Seleccionar código ACTECO...',
  className = '',
}: ActecoSelectorProps) {
  const [isOpen, setIsOpen]               = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [actecos, setActecos]             = useState<ActecoCode[]>([])
  const [loading, setLoading]             = useState(false)
  const [selectedActeco, setSelectedActeco] = useState<ActecoCode | null>(null)
  const [activeCategory, setActiveCategory] = useState<ActecoCode['category'] | 'all'>('all')

  // Carga inicial — todos los códigos
  useEffect(() => {
    loadAll()
  }, [])

  // Sincronizar selección cuando llega el value desde el padre
  useEffect(() => {
    if (value && actecos.length > 0) {
      const found = actecos.find(a => a.code === value)
      setSelectedActeco(found || null)
    } else if (!value) {
      setSelectedActeco(null)
    }
  }, [value, actecos])

  async function loadAll() {
    setLoading(true)
    try {
      // Cargamos todas las categorías en paralelo y las unimos
      const [resRest, resFoodSvc, resRetail, resOther] = await Promise.all([
        fetch('/api/sii/lookup?type=acteco&category=restaurant'),
        fetch('/api/sii/lookup?type=acteco&category=food_service'),
        fetch('/api/sii/lookup?type=acteco&category=retail'),
        fetch('/api/sii/lookup?type=acteco&category=other'),
      ])

      const [dRest, dFood, dRetail, dOther] = await Promise.all([
        resRest.json(),
        resFoodSvc.json(),
        resRetail.json(),
        resOther.json(),
      ])

      const all: ActecoCode[] = [
        ...(dRest.actecos   || []),
        ...(dFood.actecos   || []),
        ...(dRetail.actecos || []),
        ...(dOther.actecos  || []),
      ]

      setActecos(all)
    } catch (err) {
      console.error('Error cargando ACTECOs:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filtrado local (categoría + texto)
  const filtered = useMemo(() => {
    let list = actecos

    if (activeCategory !== 'all') {
      list = list.filter(a => a.category === activeCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(a =>
        a.code.includes(q) || a.description.toLowerCase().includes(q),
      )
    }

    return list
  }, [actecos, activeCategory, searchQuery])

  function handleSelect(acteco: ActecoCode) {
    setSelectedActeco(acteco)
    onChange(acteco.code, acteco.description)
    setIsOpen(false)
    setSearchQuery('')
  }

  const categories: Array<ActecoCode['category'] | 'all'> = ['all', 'restaurant', 'food_service', 'retail', 'other']

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white text-left text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors flex items-center justify-between"
      >
        <div className="flex-1 min-w-0">
          {selectedActeco ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[#FF6B35] shrink-0">{selectedActeco.code}</span>
              <span className="text-white/70 truncate">{selectedActeco.description}</span>
            </div>
          ) : (
            <span className="text-white/40">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-white/30 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A2E] border border-white/12 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Buscador */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por código o descripción..."
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/8 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35]/50"
                autoFocus
              />
            </div>
          </div>

          {/* Filtros de categoría */}
          <div className="flex gap-1 px-3 py-2 border-b border-white/10 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#FF6B35] text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                }`}
              >
                {cat === 'all' ? `Todos (${actecos.length})` : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-white/50 text-sm">
                Cargando códigos ACTECO...
              </div>
            ) : filtered.length > 0 ? (
              filtered.map(acteco => (
                <button
                  key={acteco.code}
                  type="button"
                  onClick={() => handleSelect(acteco)}
                  className="w-full p-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-[#FF6B35] text-sm font-medium">
                          {acteco.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[acteco.category]}`}>
                          {CATEGORY_LABELS[acteco.category]}
                        </span>
                      </div>
                      <p className="text-white/60 text-xs leading-relaxed">
                        {acteco.description}
                      </p>
                    </div>
                    {selectedActeco?.code === acteco.code && (
                      <Check size={14} className="text-[#FF6B35] shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-white/50 text-sm">
                {searchQuery ? 'Sin resultados para esa búsqueda' : 'No hay códigos disponibles'}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-white/10">
            <p className="text-white/30 text-[10px]">
              {filtered.length} código{filtered.length !== 1 ? 's' : ''} · ACTECO identifica tu actividad económica ante el SII
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
