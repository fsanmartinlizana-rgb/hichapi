'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { RestaurantProvider, useRestaurant } from '@/lib/restaurant-context'
import {
  LayoutDashboard, ClipboardList, Grid3X3, BookOpen,
  BarChart2, TrendingUp, Sparkles, Store, SlidersHorizontal,
  Trash2, Package, CalendarDays, LogOut, ChevronDown, Check,
  ShieldCheck, Users, Banknote, HelpCircle, MessageSquare,
} from 'lucide-react'
import SupportModal from '@/components/SupportModal'
import NpsModal from '@/components/NpsModal'

// ── Nav definition ────────────────────────────────────────────────────────────

const ALL_NAV = [
  {
    section: 'OPERACIÓN',
    items: [
      { label: 'Dashboard',     href: '/dashboard', icon: LayoutDashboard, roles: ['admin','owner','supervisor','garzon','waiter','anfitrion','super_admin'] },
      { label: 'Garzón',        href: '/garzon',    icon: LayoutDashboard, roles: ['admin','owner','supervisor','garzon','waiter','anfitrion','super_admin'] },
      { label: 'Comandas',      href: '/comandas',  icon: ClipboardList,   roles: ['admin','owner','supervisor','garzon','waiter','cocina','anfitrion','super_admin'] },
      { label: 'Mesas',         href: '/mesas',     icon: Grid3X3,         roles: ['admin','owner','supervisor','garzon','waiter','anfitrion','super_admin'] },
      { label: 'Carta digital', href: '/carta',     icon: BookOpen,        roles: ['admin','owner','supervisor','garzon','waiter','super_admin'] },
    ],
  },
  {
    section: 'INVENTARIO',
    items: [
      { label: 'Stock',  href: '/stock',  icon: Package,      roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Mermas', href: '/mermas', icon: Trash2,        roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Turnos', href: '/turnos', icon: CalendarDays,  roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Caja',   href: '/caja',   icon: Banknote,      roles: ['owner','admin','supervisor','super_admin'] },
    ],
  },
  {
    section: 'INTELIGENCIA',
    items: [
      { label: 'Reporte del día', href: '/reporte',   icon: BarChart2,  roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Analytics',       href: '/analytics', icon: TrendingUp, roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Chapi insights',  href: '/insights',  icon: Sparkles,   roles: ['admin','owner','supervisor','super_admin'] },
    ],
  },
  {
    section: 'CONFIGURACIÓN',
    items: [
      { label: 'Equipo',         href: '/equipo',      icon: Users,             roles: ['admin','owner','super_admin'] },
      { label: 'Mi restaurante', href: '/restaurante', icon: Store,             roles: ['admin','owner','super_admin'] },
      { label: 'Tono de Chapi',  href: '/tono',        icon: SlidersHorizontal, roles: ['admin','owner','super_admin'] },
    ],
  },
]

function getNav(role: string) {
  return ALL_NAV
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(role)),
    }))
    .filter(section => section.items.length > 0)
}

// ── Role label ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  owner:      'Propietario',
  admin:      'Administrador',
  supervisor: 'Supervisor',
  garzon:     'Garzón',
  waiter:     'Garzón',
  cocina:     'Cocina',
  anfitrion:  'Anfitrión',
  super_admin: 'Super Admin',
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function SidebarContent() {
  const pathname = usePathname()
  const { restaurant, restaurants, profile, isSuperAdmin, loading, switchTo, logout } = useRestaurant()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [npsOpen, setNpsOpen] = useState(false)

  const role     = profile?.role ?? 'admin'
  const initials = profile?.initials ?? '??'
  const nav      = getNav(role)

  return (
    <aside className="w-[210px] shrink-0 flex flex-col bg-[#0F0F1C] border-r border-white/5">

      {/* Logo */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center text-white font-bold text-sm shrink-0">
          hi
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">HiChapi</p>
          <p className="text-white/40 text-[10px]">Panel Restaurante</p>
        </div>
      </div>

      {/* Restaurant card / picker */}
      <div className="mx-3 mb-3 relative">
        <button
          onClick={() => isSuperAdmin && setPickerOpen(o => !o)}
          className={`w-full p-3 rounded-xl bg-white/5 border border-white/8 text-left transition-colors
            ${isSuperAdmin ? 'hover:bg-white/8 cursor-pointer' : 'cursor-default'}`}
        >
          {loading ? (
            <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-white text-sm font-semibold leading-tight truncate flex-1 mr-1">
                  {restaurant?.name ?? 'Sin restaurante'}
                </p>
                {isSuperAdmin && <ChevronDown size={12} className={`text-white/30 shrink-0 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />}
              </div>
              {restaurant?.neighborhood && (
                <p className="text-white/40 text-[10px] mt-0.5">{restaurant.neighborhood}</p>
              )}
              {isSuperAdmin && (
                <div className="flex items-center gap-1 mt-1.5">
                  <ShieldCheck size={9} className="text-[#FF6B35]" />
                  <span className="text-[#FF6B35] text-[9px] font-medium">Super Admin</span>
                </div>
              )}
            </>
          )}
        </button>

        {/* Restaurant picker dropdown */}
        {pickerOpen && restaurants.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A2E] border border-white/12 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
            {restaurants.map(r => (
              <button
                key={r.id}
                onClick={() => { switchTo(r.id); setPickerOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
              >
                {restaurant?.id === r.id
                  ? <Check size={10} className="text-[#FF6B35] shrink-0" />
                  : <span className="w-2.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[12px] font-medium truncate">{r.name}</p>
                  {r.neighborhood && <p className="text-white/30 text-[10px]">{r.neighborhood}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-3">
        {nav.map(({ section, items }) => (
          <div key={section}>
            <p className="text-white/25 text-[9px] font-semibold tracking-widest px-2 mb-1">
              {section}
            </p>
            <div className="space-y-0.5">
              {items.map(({ label, href, icon: Icon }) => {
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
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Support + NPS buttons */}
      <div className="px-3 py-2 space-y-1">
        <button
          onClick={() => setSupportOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]
                     text-white/40 hover:text-white hover:bg-white/5 transition-all"
        >
          <HelpCircle size={14} strokeWidth={1.8} className="shrink-0" />
          <span className="flex-1 text-left truncate">Soporte</span>
        </button>
        <button
          onClick={() => setNpsOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]
                     text-white/40 hover:text-white hover:bg-white/5 transition-all"
        >
          <MessageSquare size={14} strokeWidth={1.8} className="shrink-0" />
          <span className="flex-1 text-left truncate">Feedback</span>
        </button>
      </div>

      {/* Modals */}
      <SupportModal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        restaurantId={restaurant?.id}
        userId={profile?.id}
      />
      <NpsModal
        open={npsOpen}
        onClose={() => setNpsOpen(false)}
        npsType="platform_admin"
        restaurantId={restaurant?.id}
        userId={profile?.id}
      />

      {/* User + Logout */}
      <div className="px-3 py-3 border-t border-white/5 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/30
                        flex items-center justify-center text-[#FF6B35] text-[10px] font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[11px] font-medium truncate">
            {profile?.email?.split('@')[0] ?? '—'}
          </p>
          <p className="text-white/35 text-[9px]">{ROLE_LABEL[role] ?? role}</p>
        </div>
        <button
          onClick={logout}
          title="Cerrar sesión"
          className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors shrink-0"
        >
          <LogOut size={13} />
        </button>
      </div>
    </aside>
  )
}

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  return (
    <RestaurantProvider>
      <div className="flex h-screen bg-[#0A0A14] text-white overflow-hidden"
           style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
        <SidebarContent />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </RestaurantProvider>
  )
}
