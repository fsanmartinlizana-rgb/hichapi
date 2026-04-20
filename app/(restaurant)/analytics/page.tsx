'use client'

// ── /analytics — dashboard unificado ────────────────────────────────────────
// Sprint 3 (2026-04-19): unifica /reporte y /analytics en 3 tabs:
//   • Resumen del día → KPIs del día + Chapi Tip
//   • Métricas         → gráficos del período (semana, mes, 30d)
//   • Mi dashboard     → widgets configurables
//
// El mock data viejo fue reemplazado por /api/analytics/summary que consulta
// orders/order_items/stock_items en supabase.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  RefreshCw, BarChart2, Sparkles, LayoutDashboard, Plus, X, Loader2, Settings,
} from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import { canAccessModule } from '@/lib/plans'
import { DashboardWidget } from '@/components/restaurant/analytics/DashboardWidget'
import type { AnalyticsSummary, WidgetInstance } from '@/components/restaurant/analytics/types'
import { WIDGET_CATALOG } from '@/components/restaurant/analytics/widget-catalog'

type Tab = 'resumen' | 'metricas' | 'dashboard'

export default function AnalyticsPage() {
  const { restaurant } = useRestaurant()
  const restId     = restaurant?.id
  const plan       = restaurant?.plan ?? 'free'
  const searchParams = useSearchParams()
  const router     = useRouter()

  const initialTab = (searchParams.get('tab') as Tab) || 'resumen'
  const [tab, setTab]         = useState<Tab>(initialTab)
  const [period, setPeriod]   = useState<'dia' | 'semana' | 'mes' | '30d'>('semana')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  // Dashboard custom widgets
  const [widgets, setWidgets] = useState<WidgetInstance[]>([])
  const [editing, setEditing] = useState(false)
  const [picker, setPicker]   = useState(false)

  const loadSummary = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    const res  = await fetch(`/api/analytics/summary?restaurant_id=${restId}&period=${period}`)
    const data = await res.json()
    setSummary(data as AnalyticsSummary)
    setLoading(false)
  }, [restId, period])

  useEffect(() => { loadSummary() }, [loadSummary])

  // Load user dashboard layout
  useEffect(() => {
    if (!restId) return
    fetch(`/api/dashboard/layout?restaurant_id=${restId}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.widgets)) setWidgets(d.widgets as WidgetInstance[])
      })
      .catch(() => {})
  }, [restId])

  const saveLayout = useCallback(async (next: WidgetInstance[]) => {
    if (!restId) return
    await fetch('/api/dashboard/layout', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ restaurant_id: restId, widgets: next }),
    })
  }, [restId])

  function addWidget(type: string) {
    const def = WIDGET_CATALOG.find(w => w.type === type)
    if (!def) return
    const newW: WidgetInstance = {
      id:   crypto.randomUUID(),
      type,
      x:    0,
      y:    widgets.length,
      w:    def.defaultSize.w,
      h:    def.defaultSize.h,
    }
    const next = [...widgets, newW]
    setWidgets(next)
    saveLayout(next)
    setPicker(false)
  }

  function removeWidget(id: string) {
    const next = widgets.filter(w => w.id !== id)
    setWidgets(next)
    saveLayout(next)
  }

  // Gate del tab Dashboard por plan pro+
  const canUseDashboard = useMemo(() => canAccessModule(plan, 'pro'), [plan])

  function changeTab(next: Tab) {
    setTab(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    router.replace(`/analytics?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white text-xl font-bold">Analytics</h1>
          <p className="text-white/40 text-sm mt-0.5">Datos reales de tu operación · {restaurant?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/3 border border-white/6 rounded-xl p-1">
            {(['dia', 'semana', 'mes', '30d'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all
                  ${period === p ? 'bg-[#FF6B35] text-white font-medium' : 'text-white/35 hover:text-white/60'}`}
              >
                {p === 'dia' ? 'Hoy' : p === 'semana' ? '7 días' : p === 'mes' ? '30 días' : '30d'}
              </button>
            ))}
          </div>
          <button
            onClick={loadSummary}
            className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-1">
        <TabButton active={tab === 'resumen'}   icon={Sparkles}          onClick={() => changeTab('resumen')}>Resumen del día</TabButton>
        <TabButton active={tab === 'metricas'}  icon={BarChart2}         onClick={() => changeTab('metricas')}>Métricas</TabButton>
        <TabButton active={tab === 'dashboard'} icon={LayoutDashboard}   onClick={() => changeTab('dashboard')} locked={!canUseDashboard}>Mi dashboard</TabButton>
      </div>

      {/* Content */}
      {loading && !summary ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
        </div>
      ) : tab === 'resumen' ? (
        <ResumenTab summary={summary} />
      ) : tab === 'metricas' ? (
        <MetricasTab summary={summary} />
      ) : canUseDashboard ? (
        <DashboardTab
          widgets={widgets}
          summary={summary}
          editing={editing}
          onToggleEdit={() => setEditing(e => !e)}
          onAdd={() => setPicker(true)}
          onRemove={removeWidget}
        />
      ) : (
        <UpgradeGate />
      )}

      {/* Widget picker */}
      {picker && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPicker(false)}>
          <div className="w-full max-w-2xl bg-[#111111] border border-white/10 rounded-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <Plus size={18} className="text-[#FF6B35]" /> Agregar widget
              </h3>
              <button onClick={() => setPicker(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {WIDGET_CATALOG.map(w => {
                const blocked = !canAccessModule(plan, w.planRequired)
                const already = widgets.some(x => x.type === w.type)
                return (
                  <button
                    key={w.type}
                    disabled={blocked || already}
                    onClick={() => addWidget(w.type)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      blocked || already
                        ? 'bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed'
                        : 'bg-white/[0.02] border-white/8 hover:border-[#FF6B35]/40 hover:bg-[#FF6B35]/5'
                    }`}
                  >
                    <p className="text-white text-sm font-semibold">{w.label}</p>
                    <p className="text-white/40 text-xs mt-0.5">{w.description}</p>
                    {blocked && <p className="text-amber-400/80 text-[10px] mt-2">Requiere plan {w.planRequired}+</p>}
                    {already && <p className="text-emerald-400/80 text-[10px] mt-2">Ya en el dashboard</p>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({ active, icon: Icon, children, onClick, locked }: {
  active:   boolean
  icon:     React.ComponentType<{ size?: number; className?: string }>
  children: React.ReactNode
  onClick:  () => void
  locked?:  boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
        active
          ? 'border-[#FF6B35] text-white'
          : 'border-transparent text-white/40 hover:text-white/70'
      }`}
    >
      <Icon size={14} />
      {children}
      {locked && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Pro</span>}
    </button>
  )
}

function ResumenTab({ summary }: { summary: AnalyticsSummary | null }) {
  if (!summary) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <DashboardWidget type="revenue_today"        summary={summary} />
      <DashboardWidget type="avg_ticket"           summary={summary} />
      <DashboardWidget type="open_tables_now"      summary={summary} />
      <DashboardWidget type="inventory_low_stock"  summary={summary} />
      <DashboardWidget type="waste_cost"           summary={summary} />
      <DashboardWidget type="chapi_tip_of_the_day" summary={summary} />
      {/* Heatmap full-width — ocupación por fecha × hora */}
      <div className="lg:col-span-3 min-h-[380px]">
        <DashboardWidget type="occupancy_heatmap" summary={summary} />
      </div>
      {/* Recomendaciones de Chapi — insights accionables */}
      <div className="lg:col-span-3 min-h-[300px]">
        <DashboardWidget type="chapi_recommendations" summary={summary} />
      </div>
    </div>
  )
}

function MetricasTab({ summary }: { summary: AnalyticsSummary | null }) {
  if (!summary) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <DashboardWidget type="revenue_week" summary={summary} />
      <DashboardWidget type="avg_ticket"   summary={summary} />
      <div className="min-h-[420px] lg:col-span-2">
        <DashboardWidget type="occupancy_heatmap" summary={summary} />
      </div>
      <div className="h-96 lg:col-span-2">
        <DashboardWidget type="top_items_week" summary={summary} />
      </div>
      <div className="h-72 lg:col-span-2">
        <DashboardWidget type="waste_breakdown" summary={summary} />
      </div>
    </div>
  )
}

function DashboardTab({ widgets, summary, editing, onToggleEdit, onAdd, onRemove }: {
  widgets:      WidgetInstance[]
  summary:      AnalyticsSummary | null
  editing:      boolean
  onToggleEdit: () => void
  onAdd:        () => void
  onRemove:     (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-xs">
          {widgets.length === 0
            ? 'Tu dashboard está vacío. Agregá widgets para armar tu vista personalizada.'
            : `${widgets.length} widget${widgets.length === 1 ? '' : 's'} · personalizalo a tu gusto`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleEdit}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              editing
                ? 'bg-[#FF6B35] text-white'
                : 'bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/25'
            }`}
          >
            <Settings size={12} /> {editing ? 'Listo' : 'Editar'}
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF6B35]/15 border border-[#FF6B35]/30 text-[#FF6B35] text-xs font-semibold hover:bg-[#FF6B35]/25 transition-colors"
          >
            <Plus size={12} /> Agregar widget
          </button>
        </div>
      </div>

      {widgets.length === 0 ? (
        <div className="py-16 text-center">
          <LayoutDashboard size={36} className="text-white/15 mx-auto mb-3" />
          <p className="text-white/40 text-sm mb-4">Dashboard vacío</p>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors"
          >
            <Plus size={14} /> Agregar mi primer widget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 auto-rows-[80px]">
          {widgets.map(w => (
            <div
              key={w.id}
              style={{
                gridColumn: `span ${w.w} / span ${w.w}`,
                gridRow:    `span ${w.h} / span ${w.h}`,
              }}
              className="relative"
            >
              {editing && (
                <button
                  onClick={() => onRemove(w.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow-lg z-10 hover:bg-red-600"
                  title="Quitar widget"
                >
                  <X size={12} />
                </button>
              )}
              <DashboardWidget type={w.type} summary={summary} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UpgradeGate() {
  return (
    <div className="py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 mb-4">
        <LayoutDashboard size={20} className="text-[#FF6B35]" />
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">Mi dashboard está disponible en plan Pro</h3>
      <p className="text-white/50 text-sm max-w-md mx-auto mb-5">
        Configurá widgets con las métricas que te importan. Reportes, fidelización y analytics avanzados incluidos.
      </p>
      <a href="/modulos" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors">
        Ver planes
      </a>
    </div>
  )
}
