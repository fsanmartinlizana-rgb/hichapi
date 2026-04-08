'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  Grid3X3,
  BookOpen,
  BarChart2,
  TrendingUp,
  Sparkles,
  Store,
  SlidersHorizontal,
  Trash2,
  Package,
  CalendarDays,
} from 'lucide-react'

const NAV = [
  {
    section: 'OPERACIÓN',
    items: [
      { label: 'Dashboard',     href: '/dashboard',  icon: LayoutDashboard, badge: null },
      { label: 'Comandas',      href: '/comandas',   icon: ClipboardList,   badge: null },
      { label: 'Mesas',         href: '/mesas',      icon: Grid3X3,         badge: null },
      { label: 'Carta digital', href: '/carta',      icon: BookOpen,        badge: null },
    ],
  },
  {
    section: 'INVENTARIO',
    items: [
      { label: 'Stock',   href: '/stock',  icon: Package,  badge: null },
      { label: 'Mermas',  href: '/mermas', icon: Trash2,   badge: null },
      { label: 'Turnos',  href: '/turnos', icon: CalendarDays, badge: null },
    ],
  },
  {
    section: 'INTELIGENCIA',
    items: [
      { label: 'Reporte del día',  href: '/reporte',   icon: BarChart2,  badge: 'new' },
      { label: 'Analytics',        href: '/analytics', icon: TrendingUp, badge: null  },
      { label: 'Chapi insights',   href: '/insights',  icon: Sparkles,   badge: null  },
    ],
  },
  {
    section: 'CONFIGURACIÓN',
    items: [
      { label: 'Mi restaurante', href: '/restaurante', icon: Store,             badge: null },
      { label: 'Tono de Chapi',  href: '/tono',        icon: SlidersHorizontal, badge: null },
    ],
  },
]

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-[#0A0A14] text-white overflow-hidden"
         style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="w-[200px] shrink-0 flex flex-col bg-[#0F0F1C] border-r border-white/5">

        {/* Logo */}
        <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center
                          text-white font-bold text-sm shrink-0">
            hi
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">HiChapi</p>
            <p className="text-white/40 text-[10px]">Panel Restaurante</p>
          </div>
        </div>

        {/* Restaurant card */}
        <div className="mx-3 mb-4 p-3 rounded-xl bg-white/5 border border-white/8">
          <p className="text-white text-sm font-semibold leading-tight truncate">El Rincón de Don José</p>
          <p className="text-white/40 text-[10px] mt-0.5">Providencia · 14 mesas</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[10px] font-medium">Abierto ahora</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-4">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <p className="text-white/25 text-[9px] font-semibold tracking-widest px-2 mb-1.5">
                {section}
              </p>
              <div className="space-y-0.5">
                {items.map(({ label, href, icon: Icon, badge }) => {
                  const active = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={[
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all',
                        active
                          ? 'bg-[#FF6B35] text-white font-medium'
                          : 'text-white/50 hover:text-white hover:bg-white/5',
                      ].join(' ')}
                    >
                      <Icon size={14} strokeWidth={active ? 2.5 : 1.8} className="shrink-0" />
                      <span className="flex-1 truncate">{label}</span>
                      {badge === 'new' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full
                                         bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          new
                        </span>
                      )}
                      {typeof badge === 'number' && (
                        <span className="text-[10px] font-bold w-4 h-4 rounded-full bg-[#FF6B35]
                                         flex items-center justify-center text-white">
                          {badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-white/5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/30
                          flex items-center justify-center text-[#FF6B35] text-[10px] font-bold shrink-0">
            MG
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[11px] font-medium truncate">Marcela García</p>
            <p className="text-white/35 text-[9px]">Administradora</p>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
