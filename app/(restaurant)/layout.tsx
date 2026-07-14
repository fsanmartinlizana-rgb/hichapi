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
  Gift, MapPin, ChefHat, Tag, Lock,
} from 'lucide-react'
import { canAccessModule, getPlanLevel } from '@/lib/plans'
import { ROUTE_PLAN_REQUIRED } from '@/lib/plans-gating'
import PlanGate from '@/components/restaurant/PlanGate'
import SupportModal from '@/components/SupportModal'
import NpsModal from '@/components/NpsModal'
import { ChapiAssistant } from '@/components/restaurant/ChapiAssistant'
import { NotificationsProvider } from '@/lib/notifications-context'
import { NotificationsBell } from '@/components/restaurant/NotificationsBell'
import { BillRequestFloater } from '@/components/restaurant/BillRequestFloater'
import MobileBottomNav from '@/components/restaurant/MobileBottomNav'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import HiChapiLogo from '@/components/landing/HiChapiLogo'

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

// Grupos temáticos más chicos (antes eran 4, con "Mi Restaurante" y
// "Configuración" gigantes). Combinado con el acordeón (solo 1 grupo abierto),
// el sidebar deja de verse saturado. Los hrefs/roles/íconos de cada ítem se
// mantienen — solo cambia en qué grupo vive.
const ALL_NAV: NavSection[] = [
  {
    key: 'operacion',
    label: 'Operación',
    icon: Utensils,
    items: [
      { label: 'Dashboard',  href: '/dashboard', icon: LayoutDashboard, roles: ['admin','owner','supervisor','garzon','waiter','anfitrion','super_admin'] },
      { label: 'Garzón',     href: '/garzon',    icon: Users,           roles: ['admin','owner','supervisor','garzon','waiter','anfitrion','super_admin'] },
      { label: 'Comandas',   href: '/comandas',  icon: ClipboardList,   roles: ['admin','owner','supervisor','garzon','waiter','cocina','anfitrion','super_admin'] },
      { label: 'Mesas',      href: '/mesas',     icon: Grid3X3,         roles: ['admin','owner','supervisor','garzon','waiter','anfitrion','super_admin'] },
      { label: 'Caja',       href: '/caja',      icon: Banknote,        roles: ['owner','admin','supervisor','super_admin'] },
      { label: 'Comensales', href: '/clientes',  icon: Users,           roles: ['admin','owner','supervisor','garzon','super_admin'] },
    ],
  },
  {
    key: 'carta-stock',
    label: 'Carta y stock',
    icon: Package,
    items: [
      { label: 'Carta digital', href: '/carta',  icon: BookOpen, roles: ['admin','owner','supervisor','garzon','waiter','super_admin'] },
      { label: 'Stock',         href: '/stock',  icon: Package,  roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Mermas',        href: '/mermas', icon: Trash2,   roles: ['admin','owner','supervisor','super_admin'] },
    ],
  },
  {
    key: 'agenda',
    label: 'Agenda',
    icon: CalendarDays,
    items: [
      { label: 'Reservas',   href: '/reservas',   icon: CalendarDays, roles: ['admin','owner','supervisor','anfitrion','super_admin'] },
      { label: 'Turnos',     href: '/turnos',     icon: CalendarDays, roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Mis turnos', href: '/mis-turnos', icon: CalendarDays, roles: ['admin','owner','supervisor','garzon','waiter','cocina','anfitrion','super_admin'] },
      ...(process.env.NEXT_PUBLIC_ENABLE_DELIVERY === 'true' ? [{ label: 'Delivery', href: '/delivery', icon: Bike, roles: ['owner','admin','super_admin'] }] : []),
    ],
  },
  {
    key: 'inteligencia',
    label: 'Inteligencia',
    icon: BrainCircuit,
    items: [
      { label: 'Analytics',      href: '/analytics', icon: TrendingUp, roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Chapi insights', href: '/insights',  icon: Sparkles,   roles: ['admin','owner','supervisor','super_admin'] },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: Gift,
    items: [
      { label: 'Fidelización',   href: '/fidelizacion',              icon: Gift, roles: ['admin','owner','super_admin'] },
      { label: 'Promociones',    href: '/promociones',               icon: Tag,  roles: ['admin','owner','supervisor','super_admin'] },
      { label: 'Comensales app', href: '/configuracion/comensales',  icon: Gift, roles: ['admin','owner','super_admin'] },
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
      { label: 'API pública',    href: '/configuracion/api-keys',    icon: ShieldCheck, roles: ['admin','owner','super_admin'] },
      { label: 'Geofencing',     href: '/configuracion/geofencing',  icon: MapPin,      roles: ['admin','owner','super_admin'] },
      { label: 'Módulos y Plan', href: '/modulos',       icon: Boxes,             roles: ['admin','owner','super_admin'] },
      { label: 'Impresoras',     href: '/impresoras',    icon: Printer,           roles: ['owner','admin','supervisor','super_admin'] },
      { label: 'DTE Chile',      href: '/dte',           icon: FileText,          roles: ['owner','admin','super_admin'] },
      { label: 'Tono de Chapi',  href: '/tono',          icon: SlidersHorizontal, roles: ['admin','owner','super_admin'] },
      ...(process.env.NEXT_PUBLIC_ENABLE_DELIVERY === 'true' ? [{ label: 'Integraciones',  href: '/integraciones', icon: Bike,              roles: ['admin','owner','super_admin'] }] : []),
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
// Matriz 2026-06 vivía duplicada acá. Ahora es lib/plans-gating: ROUTE_PLAN_REQUIRED.
// Misma fuente de verdad para sidebar + URL enforcement (PlanGate).

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

function SidebarContent({ mode = 'desktop' }: { mode?: 'desktop' | 'drawer' }) {
  const pathname = usePathname()
  const { restaurant, restaurants, profile, isSuperAdmin, loading, switchTo, logout } = useRestaurant()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [npsOpen, setNpsOpen] = useState(false)
  // Confirmación de costo al agregar un local adicional ($29.990/mes).
  const [addLocationPrompt, setAddLocationPrompt] = useState<{ href: string; label: string } | null>(null)

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
          const required = ROUTE_PLAN_REQUIRED[item.href] ?? 'free'
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
  // Acordeón: un solo grupo abierto a la vez (menos saturación visual). null =
  // todos cerrados. Se recuerda por pestaña en sessionStorage.
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  // Hydrate from sessionStorage; auto-open active section
  useEffect(() => {
    let initial: string | null = null
    try {
      initial = sessionStorage.getItem('hichapi_sidebar_group')
    } catch {
      initial = null
    }
    setOpenGroup(activeSectionKey ?? initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the user navigates to a different section, open it (accordion → the
  // others close automatically).
  useEffect(() => {
    if (!activeSectionKey) return
    setOpenGroup(activeSectionKey)
  }, [activeSectionKey])

  // Persist open group
  useEffect(() => {
    try {
      if (openGroup) sessionStorage.setItem('hichapi_sidebar_group', openGroup)
      else sessionStorage.removeItem('hichapi_sidebar_group')
    } catch { /* ignore */ }
  }, [openGroup])

  function toggleGroup(key: string) {
    setOpenGroup(prev => (prev === key ? null : key))
  }

  // En desktop: aside fijo con `hidden md:flex` (oculto en mobile).
  // En drawer (mobile): aside full-flex (siempre visible — el wrapper ya
  // está dentro del drawer fullscreen).
  const asideCls = mode === 'drawer'
    ? 'w-full flex flex-col bg-surface text-[var(--text-body)]'
    : 'w-[256px] shrink-0 hidden md:flex flex-col bg-surface text-[var(--text-body)] border-r border-[var(--border-subtle)]'

  return (
    <aside className={asideCls}>

      {/* Logo + theme toggle + Notifications bell */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2.5">
        <HiChapiLogo size={26} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[var(--text-strong)] font-bold text-sm leading-tight">
            <span className="text-orange-500">Hi</span>Chapi
          </p>
          <p className="text-[var(--text-muted)] text-[10px]">Panel Restaurante</p>
        </div>
        <ThemeToggle />
        <NotificationsBell />
      </div>

      {/* Restaurant card / picker
          Mostramos picker si: super_admin OR usuario tiene >1 restaurante
          (multi-sucursal). Si tiene 1 solo, igual mostramos el botón "Agregar
          sucursal" para que pueda crear más. */}
      {(() => {
        const canPick      = isSuperAdmin || restaurants.length > 1
        // Multi-local (sucursal o restaurante extra) es capacidad Pro+: cada
        // local adicional cuesta $29.990/mes (info transparentada en la web).
        // Los planes Free/Starter no ven el CTA; deben subir a Pro primero.
        const isPro        = getPlanLevel(currentPlan) >= getPlanLevel('pro')
        const canAddSuc    = !isSuperAdmin && (role === 'owner' || role === 'admin') && isPro
        // "Agregar otro restaurante" (cuenta única, locales independientes)
        // solo para owner. Un garzón o cocinero invitado a otro local no debe
        // tener un CTA desde el panel ajeno para abrir su propio negocio.
        const canAddOther  = !isSuperAdmin && role === 'owner' && isPro
        const showDropdown = canPick || canAddSuc || canAddOther
        return (
        <div className="mx-3 mb-3 relative">
          <button
            onClick={() => showDropdown && setPickerOpen(o => !o)}
            className={`w-full p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-left transition-colors
              ${showDropdown ? 'hover:bg-[var(--surface-hover)] cursor-pointer' : 'cursor-default'}`}
          >
            {loading ? (
              <div className="h-4 w-24 bg-[var(--surface-hover)] rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[var(--text-strong)] text-sm font-semibold leading-tight truncate flex-1 mr-1">
                    {restaurant?.name ?? 'Sin restaurante'}
                  </p>
                  {showDropdown && <ChevronDown size={12} className={`text-[var(--text-muted)] shrink-0 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />}
                </div>
                {restaurant?.neighborhood && (
                  <p className="text-[var(--text-muted)] text-[10px] mt-0.5">{restaurant.neighborhood}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  {isSuperAdmin && (
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={9} className="text-orange-500" />
                      <span className="text-orange-600 text-[9px] font-medium">Super Admin</span>
                    </span>
                  )}
                  {!isSuperAdmin && restaurants.length > 1 && (
                    <span className="text-[var(--text-muted)] text-[9px]">
                      {restaurants.length} sucursales
                    </span>
                  )}
                </div>
              </>
            )}
          </button>

          {/* Restaurant picker dropdown + add sucursal */}
          {pickerOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-[var(--border-default)] rounded-xl shadow-[var(--shadow-xl)] z-50 max-h-80 overflow-y-auto sidebar-scroll">
              {restaurants.length > 0 && (
                <div className="py-1">
                  {restaurants.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { switchTo(r.id); setPickerOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors text-left"
                    >
                      {restaurant?.id === r.id
                        ? <Check size={10} className="text-orange-500 shrink-0" />
                        : <span className="w-2.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--text-strong)] text-[12px] font-medium truncate">{r.name}</p>
                        {r.neighborhood && <p className="text-[var(--text-muted)] text-[10px]">{r.neighborhood}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {/* Agregar OTRO restaurante (cuenta única, locales independientes).
                  Solo para owner — un garzón invitado en otro local no debe
                  poder usar este CTA desde un panel ajeno. */}
              {canAddOther && (
                <button
                  onClick={() => { setPickerOpen(false); setAddLocationPrompt({ href: '/agregar-restaurante', label: 'otro restaurante' }) }}
                  className="w-full text-left border-t border-[var(--border-subtle)] px-3 py-2.5 text-[11px] text-orange-600 hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2"
                >
                  <span className="w-4 h-4 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 text-[10px] font-bold">+</span>
                  Agregar otro restaurante
                </button>
              )}
              {/* Agregar SUCURSAL (mismo brand_id). Local adicional = $29.990/mes. */}
              {canAddSuc && (
                <button
                  onClick={() => { setPickerOpen(false); setAddLocationPrompt({ href: '/agregar-sucursal', label: 'una sucursal' }) }}
                  className="w-full text-left border-t border-[var(--border-subtle)] px-3 py-2.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2"
                >
                  <span className="w-4 h-4 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)] text-[10px] font-bold">+</span>
                  Agregar sucursal (mismo brand)
                </button>
              )}
            </div>
          )}
        </div>
        )
      })()}

      {/* Nav — acordeón en desktop (1 grupo abierto). En el drawer móvil se
          muestran TODOS los grupos expandidos: es full-height con scroll, así
          el usuario ve todos los módulos sin ir grupo por grupo. */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-2 sidebar-scroll">
        {nav.map(({ key, label, icon: SectionIcon, items }) => {
          const open = mode === 'drawer' ? true : openGroup === key
          const sectionHasActive = items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))
          return (
            <div key={key} className="mb-1.5">
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                aria-expanded={open}
                className={[
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-semibold tracking-wide transition-colors',
                  sectionHasActive
                    ? 'text-[var(--text-strong)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-hover)]',
                ].join(' ')}
              >
                <SectionIcon size={16} strokeWidth={2} className="shrink-0 opacity-80" />
                <span className="flex-1 text-left uppercase">{label}</span>
                {mode !== 'drawer' && (
                  <ChevronDown
                    size={14}
                    className={`shrink-0 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
                  />
                )}
              </button>

              <div
                className={[
                  'grid transition-all duration-200 ease-out',
                  open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                ].join(' ')}
              >
                <div className="overflow-hidden">
                  <div className="space-y-0.5 pt-1 pb-2 pl-1.5">
                    {items.map(({ label, href, icon: Icon }) => {
                      const active = pathname === href || pathname.startsWith(href + '/')
                      const requiredPlan = ROUTE_PLAN_REQUIRED[href] ?? 'free'
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
                            'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] transition-all',
                            active
                              ? 'bg-orange-500 text-white font-medium shadow-[var(--shadow-brand)]'
                              : 'text-[var(--text-body)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-hover)]',
                          ].join(' ')}
                        >
                          <Icon size={17} strokeWidth={active ? 2.5 : 1.8} className="shrink-0" />
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
      <div className="px-3 py-2 space-y-1 border-t border-[var(--border-subtle)]">
        <button
          onClick={() => setSupportOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-hover)] transition-all"
        >
          <HelpCircle size={14} strokeWidth={1.8} className="shrink-0" />
          <span className="flex-1 text-left truncate">Soporte</span>
        </button>
        <button
          onClick={() => setNpsOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-hover)] transition-all"
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

      {/* Confirmación de costo por local adicional ($29.990/mes) */}
      {addLocationPrompt && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A1A2E]/35 backdrop-blur-sm"
          onClick={() => setAddLocationPrompt(null)}
        >
          <div
            className="w-full max-w-sm bg-surface border border-[var(--border-subtle)] rounded-2xl shadow-[var(--shadow-xl)] p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center mb-4">
              <Store size={20} className="text-orange-600" />
            </div>
            <h3 className="text-[var(--text-strong)] font-bold text-base mb-1.5">
              Agregar {addLocationPrompt.label}
            </h3>
            <p className="text-[var(--text-muted)] text-[13px] leading-relaxed mb-4">
              Cada local adicional tiene un costo de{' '}
              <span className="font-price font-semibold text-[var(--text-strong)]">$29.990</span> al mes
              {' '}(+ 1% por transacción), según los planes publicados en la web. Se agrega a tu
              facturación cuando actives el nuevo local.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setAddLocationPrompt(null)}
                className="flex-1 h-10 rounded-xl border border-[var(--border-default)] text-[13px] font-semibold text-[var(--text-body)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Cancelar
              </button>
              <Link
                href={addLocationPrompt.href}
                onClick={() => setAddLocationPrompt(null)}
                className="flex-1 h-10 rounded-xl bg-orange-500 text-white text-[13px] font-semibold flex items-center justify-center hover:bg-orange-600 transition-colors shadow-[var(--shadow-brand)]"
              >
                Continuar
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* User + Logout */}
      <div className="px-3 py-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 text-[10px] font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[var(--text-strong)] text-[11px] font-medium truncate">
            {profile?.email?.split('@')[0] ?? '—'}
          </p>
          <p className="text-[var(--text-muted)] text-[9px]">{ROLE_LABEL[role] ?? role}</p>
        </div>
        <button
          onClick={logout}
          title="Cerrar sesión"
          className="p-1.5 rounded-lg hover:bg-[var(--danger-surface)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors shrink-0"
        >
          <LogOut size={13} />
        </button>
      </div>

      {/* Themed scrollbar — hairline sobre superficie clara, hover naranjo */}
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
          background: rgba(26,26,46,0.12);
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

/**
 * Wrapper interno que tiene acceso al RestaurantProvider para leer el rol
 * y pasárselo al MobileBottomNav. Vive dentro del RestaurantLayout default
 * export, que monta los providers.
 */
function LayoutInner({ children }: { children: React.ReactNode }) {
  const { profile, restaurant, isSuperAdmin } = useRestaurant()
  const role = profile?.role ?? 'admin'

  // Lógica de bloqueo por falta de pago / fin de piloto
  const isPastDue = useMemo(() => {
    if (isSuperAdmin) return false
    if (!restaurant) return false
    if (restaurant.subscription_status === 'past_due') return true
    
    // Si estaba en prueba y la fecha ya pasó
    if (restaurant.subscription_status === 'trialing' && restaurant.trial_ends_at) {
      const endsAt = new Date(restaurant.trial_ends_at)
      if (endsAt < new Date()) return true
    }
    
    // Si estaba activo y venció el plan
    if (restaurant.subscription_status === 'active' && restaurant.plan_next_billing) {
      const nextBilling = new Date(restaurant.plan_next_billing)
      if (nextBilling < new Date()) return true
    }

    return false
  }, [restaurant, isSuperAdmin])

  const pathname = usePathname()
  const isBillingPage = pathname.startsWith('/facturacion') || pathname.startsWith('/modulos')

  if (isPastDue && !isBillingPage) {
    return (
      <div className="flex h-screen bg-canvas text-[var(--text-strong)] flex-col items-center justify-center p-6 text-center" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
        <div className="w-20 h-20 rounded-2xl bg-[var(--danger-surface)] border border-[var(--danger-border)] flex items-center justify-center mb-6">
          <Lock size={32} className="text-[var(--danger)]" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Acceso bloqueado</h1>
        <p className="text-[var(--text-muted)] mb-8 max-w-md">
          Tu periodo de prueba ha finalizado o tienes un pago pendiente.
          Por favor, regulariza tu suscripción para continuar usando HiChapi.
        </p>
        <Link
          href="/modulos"
          className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center gap-2"
        >
          <Banknote size={18} />
          Ir a Facturación
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[var(--bg-canvas)] text-[var(--text-strong)] overflow-hidden"
         style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      {/* Sidebar desktop — el componente decide internamente con `hidden md:flex` */}
      <SidebarContent />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {/* URL enforcement: si la ruta requiere un plan superior, PlanGate
            renderea el panel de upgrade en vez del contenido. La matriz
            (ROUTE_PLAN_REQUIRED) es compartida con el sidebar. */}
        <PlanGate>{children}</PlanGate>
      </main>
      {/* Chapi flotante — disponible en todas las páginas del panel */}
      <ChapiAssistant />
      {/* Floating button "X mesas pidieron la cuenta" — visible en TODO el panel */}
      <BillRequestFloater />
      {/* Bottom nav mobile (oculto en md+) con drawer del sidebar completo */}
      <MobileBottomNav role={role} drawerContent={<SidebarContent mode="drawer" />} />
    </div>
  )
}

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  return (
    <RestaurantProvider>
      <NotificationsProvider>
        <LayoutInner>{children}</LayoutInner>
      </NotificationsProvider>
    </RestaurantProvider>
  )
}
