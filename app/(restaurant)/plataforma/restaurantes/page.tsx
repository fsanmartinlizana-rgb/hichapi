'use client'

// ── /plataforma/restaurantes — Lista de todos los restaurantes ─────────────
// Super admin only. Muestra restaurants con filtro por plan / estado /
// claim / búsqueda.
//
// Sprint 4 (2026-04-19).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import { createClient } from '@/lib/supabase/client'
import {
  Store, RefreshCw, Search, Check, Clock, Crown, Loader2, Shield,
  ExternalLink, MapPin,
} from 'lucide-react'
import Link from 'next/link'

interface RestRow {
  id:             string
  name:           string
  slug:           string
  neighborhood:   string | null
  plan:           string | null
  claimed:        boolean | null
  active:         boolean | null
  brand_id:       string | null
  created_at:     string
}

const PLAN_STYLE: Record<string, string> = {
  enterprise: 'bg-violet-500/15 text-violet-300',
  pro:        'bg-[#FF6B35]/15 text-[#FF6B35]',
  starter:    'bg-blue-500/15 text-blue-400',
  free:       'bg-white/5 text-white/40',
}

export default function RestaurantesAdminPage() {
  const { isSuperAdmin, loading: ctxLoading, switchTo } = useRestaurant()
  const [rows, setRows]     = useState<RestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery]   = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'starter' | 'pro' | 'enterprise'>('all')
  const [claimFilter, setClaimFilter] = useState<'all' | 'claimed' | 'unclaimed'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, neighborhood, plan, claimed, active, brand_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    setRows((data ?? []) as RestRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (planFilter !== 'all' && (r.plan ?? 'free') !== planFilter) return false
      if (claimFilter === 'claimed' && !r.claimed) return false
      if (claimFilter === 'unclaimed' && r.claimed) return false
      if (query) {
        const q = query.toLowerCase()
        if (!r.name.toLowerCase().includes(q) && !r.slug.toLowerCase().includes(q) && !(r.neighborhood ?? '').toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [rows, query, planFilter, claimFilter])

  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <Shield size={32} className="text-red-400 mx-auto" />
          <p className="text-white font-semibold">Acceso restringido</p>
          <p className="text-white/40 text-sm">Solo super admins.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-[#FF6B35]" />
            <h1 className="text-white text-xl font-bold">Restaurantes</h1>
          </div>
          <p className="text-white/40 text-sm mt-0.5">
            {rows.length} totales · {filtered.length} con los filtros aplicados
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-white transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/8 flex-1 max-w-md">
          <Search size={13} className="text-white/30" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre, slug o barrio"
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 bg-white/3 border border-white/6 rounded-xl p-1">
          {(['all', 'free', 'starter', 'pro', 'enterprise'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-[11px] capitalize transition-all ${
                planFilter === p ? 'bg-[#FF6B35] text-white font-medium' : 'text-white/35 hover:text-white/60'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/3 border border-white/6 rounded-xl p-1">
          {(['all', 'claimed', 'unclaimed'] as const).map(p => (
            <button
              key={p}
              onClick={() => setClaimFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-[11px] transition-all ${
                claimFilter === p ? 'bg-[#FF6B35] text-white font-medium' : 'text-white/35 hover:text-white/60'
              }`}
            >
              {p === 'all' ? 'Todos' : p === 'claimed' ? 'Reclamados' : 'Sin reclamar'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="text-[#FF6B35] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-10">Sin resultados</p>
      ) : (
        <div className="bg-white/[0.02] border border-white/8 rounded-2xl overflow-hidden">
          {filtered.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors">
              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/40 text-[10px] font-bold shrink-0">
                {r.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-white text-sm font-medium truncate">{r.name}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${PLAN_STYLE[r.plan ?? 'free'] ?? PLAN_STYLE.free}`}>
                    {r.plan ?? 'free'}
                  </span>
                  {r.claimed ? (
                    <Check size={10} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Clock size={10} className="text-yellow-400 shrink-0" />
                  )}
                  {!r.active && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">inactivo</span>
                  )}
                </div>
                <p className="text-white/35 text-[11px] truncate flex items-center gap-1.5">
                  <span className="font-mono">{r.slug}</span>
                  {r.neighborhood && <>
                    <span>·</span>
                    <MapPin size={9} /> {r.neighborhood}
                  </>}
                  <span>·</span>
                  <span>{new Date(r.created_at).toLocaleDateString('es-CL')}</span>
                </p>
              </div>
              <button
                onClick={() => switchTo(r.id)}
                className="text-white/40 text-[11px] hover:text-white transition-colors px-2 py-1 rounded-lg border border-white/10 hover:border-white/25"
                title="Ver como este restaurant"
              >
                Ver como
              </button>
              <Link
                href={`/${r.slug}`}
                target="_blank"
                className="text-white/40 text-[11px] hover:text-white transition-colors px-2 py-1 rounded-lg border border-white/10 hover:border-white/25 flex items-center gap-1"
              >
                Página <ExternalLink size={10} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
