'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { RestaurantProvider, useRestaurant } from '@/lib/restaurant-context'
import {
  LayoutDashboard, ClipboardList, Grid3X3, BookOpen,
  BarChart2, TrendingUp, Sparkles, Store, SlidersHorizontal,
  Trash2, Package, CalendarDays, LogOut, ChevronDown, Check,
  ShieldCheck, Users, Banknote, HelpCircle, MessageSquare, Boxes,
  Crown, FileText, Printer, Bike, Utensils, Settings, BrainCircuit,
  Gift, MapPin, ChefHat,
} from 'lucide-react'
import { canAccessModule } from '@/lib/plans'
import SupportModal from '@/components/SupportModal'
import NpsModal from '@/components/NpsModal'
import { ChapiAssistant } from '@/components/restaurant/ChapiAssistant'
import { NotificationsProvider } from '@/lib/notifications-context'
import { NotificationsBell } from '@/components/restaurant/NotificationsBell'
import { BillRequestFloater } from '@/components/restaurant/BillRequestFloater'

// ── Nav definition ────────────────────────────────────────────────────────────
//
// Grouping principles:
//   • MI RESTAURANTE   — operación día a día (lo que se usa varias veces al día)
//   • INTELIGENCIA     — análisis y reportes
//   • CONFIGURACIÓN    — cosas que se tocan poco (DTE, impresoras, módulos, etc.)
//   • PLATAFORMA       — solo super admin

type NavSection = {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  items: {
    label: string
    href: string
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
    roles: string[]
  }[]
}

const ALL_NAV: NavSection[] = [
  {
    key: 'mi-restaurante',
    label: 'Mi Restaurante',
    icon: Utensils,
    items: [
      { label: 'Dashboard',     href: '/dashboard', icon: LayoutDashboard, roles: ['admin','owner','supervisor','garzon','waiter','anfitrion','super_admin'] },
      { label: 'Garzón',        href: '/garzon',    icon: Users,           roles: ['admin','owner','supervisor','garzon','waiter','anfitrion','super_admin'] },
      { label: 'Comandas',      href: '/comandas',  icon: ClipboardList,   roles: ['admin','owner','supervisor','garzon','waiter','cocina','anfitrion','super_admin'] },
      { label: 'Mesas',         href: '/mesas',     icon: Grid3X3,         roles: ['admin','owner','supervisor','garzon','waiter','anfitrion','super_admin'] },
      { label: 'Reservas',      href: '/reservas',  icon: CalendarDays,    roles: ['admin','owner','supervisor','anfitrion','super_admin'] },
      { label: 'Carta digital', href: '/carta',     icon: BookOpen,        roles: ['admin','owner','supervisor','garzon','waiter','super_admin'] },
      { label: 'Stock',         href: '/stock',     icon: Package,         roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Mermas',        href: '/mermas',    icon: Trash2,          roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Caja',          href: '/caja',      icon: Banknote,        roles: ['owner','admin','supervisor','super_admin'] },
      { label: 'Turnos',        href: '/turnos',    icon: CalendarDays,    roles: ['admin','owner','supervisor','super_admin'] },
    ],
  },
  {
    key: 'inteligencia',
    label: 'Inteligencia',
    icon: BrainCircuit,
    items: [
      { label: 'Reporte del día', href: '/reporte',   icon: BarChart2,  roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Analytics',       href: '/analytics', icon: TrendingUp, roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Chapi insights',  href: '/insights',  icon: Sparkles,   roles: ['admin','owner','supervisor','super_admin'] },
    ],
  },
  {
    key: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    items: [
      { label: 'Equipo',         href: '/equipo',        icon: Users,             roles: ['admin','owner','super_admin'] },
      { label: 'Mi restaurante', href: '/restaurante',   icon: Store,             roles: ['admin','owner','super_admin'] },
      { label: 'Locales',        href: '/configuracion/locations',   icon: MapPin,    roles: ['admin','owner','super_admin'] },
      { label: 'Estaciones',     href: '/configuracion/estaciones',  icon: ChefHat,   roles: ['admin','owner','super_admin'] },
      { label: 'Categorías',     href: '/configuracion/categorias',  icon: BookOpen,  roles: ['admin','owner','super_admin'] },
      { label: 'Módulos y Plan', href: '/modulos',       icon: Boxes,             roles: ['admin','owner','super_admin'] },
      { label: 'Impresoras',     href: '/impresoras',    icon: Printer,           roles: ['owner','admin','supervisor','super_admin'] },
      { label: 'DTE Chile',      href: '/dte',           icon: FileText,          roles: ['owner','admin','super_admin'] },
      { label: 'Tono de Chapi',  href: '/tono',          icon: SlidersHorizontal, roles: ['admin','owner','super_admin'] },
      { label: 'Integraciones',  href: '/integraciones', icon: Bike,              roles: ['admin','owner','super_admin'] },
      { label: 'Fidelización',   href: '/fidelizacion',  icon: Gift,              roles: ['admin','owner','super_admin'] },
    ],
  },
  {
    key: 'plataforma',
    label: 'Plataforma',
    icon: Crown,
    items: [
      { label: 'Overview',      href: '/plataforma',              icon: Crown,          roles: ['super_admin'] },
      { label: 'Restaurantes',  href: '/plataforma/restaurantes', icon: Store,          roles: ['super_admin'] },
      { label: 'Tickets',       href: '/plataforma/tickets',      icon: MessageSquare,  roles: ['super_admin'] },
    ],
  },
]

// ── Plan-based route gating ──────────────────────────────────────────────────
// Rebalanceado Sprint 2 (2026-04-19). Matriz: ver lib/plans.ts.
// Rutas no listadas abajo son accesibles con el plan base ('free' o todos).

const NAV_PLAN_REQUIRED: Record<string, string> = {
  // Operación del salón → starter+
  '/mesas':     'starter',
  '/comandas':  'starter',
  '/garzon':    'starter',
  '/caja':      'starter',
  '/espera':    'starter',
  '/turnos':    'starter',
  '/reservas':  'starter',

  // Inteligencia operativa → pro+
  '/stock':        'pro',
  '/mermas':       'pro',
  '/reporte':      'pro',
  '/analytics':    'pro',
  '/insights':     'pro',
  '/fidelizacion': 'pro',

  // Locales (single o multi) → starter+
  // Enterprise desbloquea AGREGAR locales; planes inferiores solo ven/editan
  // el local único. La UI de "+ Agregar local" checkea plan por su cuenta.
  '/configuracion/locations':  'starter',
  '/configuracion/estaciones': 'starter',
  '/configuracion/categorias': 'starter',

  // Escala → enterprise
  '/agregar-sucursal':         'enterprise',
  '/configuracion/api-keys':   'enterprise',
  '/configuracion/geofencing': 'enterprise',

  // Nota: /carta, /restaurante, /modulos, /equipo, /dashboard, /perfil-publico
  // quedan abiertos a todos los planes (incluye free) porque son la presencia
  // digital base.
}

// PLAN_LABEL removido: los módulos bloqueados ya no se renderizan en el sidebar,
// sólo en /modulos y /restaurante.

function getNav(role: string): NavSection[] {
  return ALL_NAV
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(role)),
    }))
    .filter(section => section.items.length > 0)
}

// Find which section contains the current route
function findActiveSection(pathname: string, sections: NavSection[]): string | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        return section.key
      }
    }
  }
  return null
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

  const role        = profile?.role ?? 'admin'
  const initials    = profile?.initials ?? '??'
  const currentPlan = (restaurant?.plan as string) ?? 'free'
  // Filtrar items por rol y por plan: los módulos inactivos en el plan no
  // aparecen en el sidebar. Secciones vacías tampoco.
  const nav = useMemo(() => {
    return getNav(role)
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          const required = NAV_PLAN_REQUIRED[item.href] ?? 'free'
          return canAccessModule(currentPlan, required)
        }),
      }))
      .filter(section => section.items.length > 0)
  }, [role, currentPlan])

  // Collapsible groups: open the group that matches the current route by default.
  // User toggles are remembered in sessionStorage per browser tab.
  const activeSectionKey = useMemo(
    () => findActiveSection(pathname, nav) ?? nav[0]?.key ?? null,
    [pathname, nav]
  )
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())

  // Hydrate from sessionStorage; auto-open active section
  useEffect(() => {
    let initial: Set<string>
    try {
      const raw = sessionStorage.getItem('hichapi_sidebar_groups')
      initial = raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      initial = new Set()
    }
    if (activeSectionKey) initial.add(activeSectionKey)
    setOpenGroups(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the user navigates to a different section, auto-open it (without
  // closing other manually-opened groups).
  useEffect(() => {
    if (!activeSectionKey) return
    setOpenGroups(prev => {
      if (prev.has(activeSectionKey)) return prev
      const next = new Set(prev)
      next.add(activeSectionKey)
      return next
    })
  }, [activeSectionKey])

  // Persist open groups
  useEffect(() => {
    try {
      sessionStorage.setItem('hichapi_sidebar_groups', JSON.stringify(Array.from(openGroups)))
    } catch { /* ignore */ }
  }, [openGroups])

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <aside className="w-[230px] shrink-0 flex flex-col bg-[#0F0F1C] border-r border-white/5">

      {/* Logo + Notifications bell */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center text-white font-bold text-sm shrink-0">
          hi
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight">HiChapi</p>
          <p className="text-white/40 text-[10px]">Panel Restaurante</p>
        </div>
        <NotificationsBell />
      </div>

      {/* Restaurant card / picker
          Mostramos picker si: super_admin OR usuario tiene >1 restaurante
          (multi-sucursal). Si tiene 1 solo, igual mostramos el botón "Agregar
          sucursal" para que pueda crear más. */}
      {(() => {
        const canPick      = isSuperAdmin || restaurants.length > 1
        const canAddSuc    = !isSuperAdmin && (role === 'owner' || role === 'admin')
        const showDropdown = canPick || canAddSuc
        return (
        <div className="mx-3 mb-3 relative">
          <button
            onClick={() => showDropdown && setPickerOpen(o => !o)}
            className={`w-full p-3 rounded-xl bg-white/5 border border-white/8 text-left transition-colors
              ${showDropdown ? 'hover:bg-white/8 cursor-pointer' : 'cursor-default'}`}
          >
            {loading ? (
              <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-semibold leading-tight truncate flex-1 mr-1">
                    {restaurant?.name ?? 'Sin restaurante'}
                  </p>
                  {showDropdown && <ChevronDown size={12} className={`text-white/30 shrink-0 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />}
                </div>
                {restaurant?.neighborhood && (
                  <p className="text-white/40 text-[10px] mt-0.5">{restaurant.neighborhood}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  {isSuperAdmin && (
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={9} className="text-[#FF6B35]" />
                      <span className="text-[#FF6B35] text-[9px] font-medium">Super Admin</span>
                    </span>
                  )}
                  {!isSuperAdmin && restaurants.length > 1 && (
                    <span className="text-white/35 text-[9px]">
                      {restaurants.length} sucursales
                    </span>
                  )}
                </div>
              </>
            )}
          </button>

          {/* Restaurant picker dropdown + add sucursal */}
          {pickerOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A2E] border border-white/12 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto sidebar-scroll">
              {restaurants.length > 0 && (
                <div className="py-1">
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
              {canAddSuc && (
                <Link
                  href="/agregar-sucursal"
                  onClick={() => setPickerOpen(false)}
                  className="block border-t border-white/10 px-3 py-2.5 text-[11px] text-[#FF6B35] hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <span className="w-4 h-4 rounded-full bg-[#FF6B35]/15 border border-[#FF6B35]/40 flex items-center justify-center text-[#FF6B35] text-[10px] font-bold">+</span>
                  Agregar sucursal
                </Link>
              )}
            </div>
          )}
        </div>
        )
      })()}

      {/* Nav — collapsible groups */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 sidebar-scroll">
        {nav.map(({ key, label, icon: SectionIcon, items }) => {
          const open = openGroups.has(key)
          const sectionHasActive = items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))
          return (
            <div key={key} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                aria-expanded={open}
                className={[
                  'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-semibold tracking-wider transition-colors',
                  sectionHasActive
                    ? 'text-white/85'
                    : 'text-white/40 hover:text-white/70',
                ].join(' ')}
              >
                <SectionIcon size={13} strokeWidth={2} className="shrink-0 opacity-70" />
                <span className="flex-1 text-left uppercase">{label}</span>
                <ChevronDown
                  size={12}
                  className={`shrink-0 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
                />
              </button>

              <div
                className={[
                  'grid transition-all duration-200 ease-out',
                  open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                ].join(' ')}
              >
                <div className="overflow-hidden">
                  <div className="space-y-0.5 pt-1 pb-1.5 pl-1">
                    {items.map(({ label, href, icon: Icon }) => {
                      const active = pathname === href || pathname.startsWith(href + '/')
                      const requiredPlan = NAV_PLAN_REQUIRED[href] ?? 'free'
                      const locked = !canAccessModule(currentPlan, requiredPlan)

                      // Módulos inactivos no se muestran en el sidebar:
                      // sólo aparecen en /modulos y /restaurante como parte
                      // del listado de módulos del plan.
                      if (locked) return null

                      return (
                        <Link
                          key={href}
                          href={href}
                          className={[
                            'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all',
                            active
                              ? 'bg-[#FF6B35] text-white font-medium shadow-sm shadow-[#FF6B35]/20'
                              : 'text-white/55 hover:text-white hover:bg-white/5',
                          ].join(' ')}
                        >
                          <Icon size={14} strokeWidth={active ? 2.5 : 1.8} className="shrink-0" />
                          <span className="flex-1 truncate">{label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Support + NPS buttons */}
      <div className="px-3 py-2 space-y-1 border-t border-white/5">
        <button
          onClick={() => setSupportOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-white/40 hover:text-white hover:bg-white/5 transition-all"
        >
          <HelpCircle size={14} strokeWidth={1.8} className="shrink-0" />
          <span className="flex-1 text-left truncate">Soporte</span>
        </button>
        <button
          onClick={() => setNpsOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-white/40 hover:text-white hover:bg-white/5 transition-all"
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
        <div className="w-7 h-7 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/30 flex items-center justify-center text-[#FF6B35] text-[10px] font-bold shrink-0">
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

      {/* Themed scrollbar — matches the dark sidebar tone */}
      <style jsx global>{`
        .sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,107,53,0.35) transparent;
        }
        .sidebar-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
          transition: background 0.2s;
        }
        .sidebar-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(255,107,53,0.35);
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,107,53,0.55);
        }
      `}</style>
    </aside>
  )
}

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  return (
    <RestaurantProvider>
      <NotificationsProvider>
        <div className="flex h-screen bg-[#0A0A14] text-white overflow-hidden"
             style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
          <SidebarContent />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
          {/* Chapi flotante — disponible en todas las páginas del panel */}
          <ChapiAssistant />
          {/* Floating button "X mesas pidieron la cuenta" — visible en TODO el panel */}
          <BillRequestFloater />
        </div>
      </NotificationsProvider>
    </RestaurantProvider>
  )
}
