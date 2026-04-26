'use client'

/**
 * MobileBottomNav — barra de navegación inferior para mobile.
 *
 * Aparece SOLO en viewports < md (768px). Muestra los 4 ítems más usados
 * según el rol activo + un "Más" que abre el sidebar como drawer fullscreen.
 *
 * Diseño:
 * - Fixed bottom, h-16, blur background.
 * - Cada item min-h-44px (regla táctil).
 * - Item activo en naranja, resto blanco/40.
 *
 * El sidebar desktop sigue intacto — se oculta con `hidden md:flex`.
 */

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import {
  LayoutDashboard, ClipboardList, Grid3X3, Banknote, Users, ChefHat, Menu, X,
} from 'lucide-react'

interface NavItem {
  label: string
  href:  string
  icon:  React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

/**
 * Configuración de bottom nav por rol. El 5° slot (Más) se agrega
 * automáticamente y abre el drawer.
 *
 * Reglas:
 * - Mantener máximo 4 items custom + 1 "Más".
 * - Items deben ser los más usados durante un turno por ese rol.
 */
const NAV_BY_ROLE: Record<string, NavItem[]> = {
  owner: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Mesas',     href: '/mesas',     icon: Grid3X3 },
    { label: 'Comandas',  href: '/comandas',  icon: ClipboardList },
    { label: 'Caja',      href: '/caja',      icon: Banknote },
  ],
  admin: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Mesas',     href: '/mesas',     icon: Grid3X3 },
    { label: 'Comandas',  href: '/comandas',  icon: ClipboardList },
    { label: 'Caja',      href: '/caja',      icon: Banknote },
  ],
  supervisor: [
    { label: 'Mesas',     href: '/mesas',     icon: Grid3X3 },
    { label: 'Comandas',  href: '/comandas',  icon: ClipboardList },
    { label: 'Garzón',    href: '/garzon',    icon: Users },
    { label: 'Caja',      href: '/caja',      icon: Banknote },
  ],
  garzon: [
    { label: 'Garzón',    href: '/garzon',    icon: Users },
    { label: 'Mesas',     href: '/mesas',     icon: Grid3X3 },
    { label: 'Comandas',  href: '/comandas',  icon: ClipboardList },
  ],
  waiter: [
    { label: 'Garzón',    href: '/garzon',    icon: Users },
    { label: 'Mesas',     href: '/mesas',     icon: Grid3X3 },
    { label: 'Comandas',  href: '/comandas',  icon: ClipboardList },
  ],
  cocina: [
    { label: 'Comandas',  href: '/comandas',  icon: ChefHat },
  ],
  anfitrion: [
    { label: 'Mesas',     href: '/mesas',     icon: Grid3X3 },
    { label: 'Garzón',    href: '/garzon',    icon: Users },
  ],
  super_admin: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Mesas',     href: '/mesas',     icon: Grid3X3 },
    { label: 'Comandas',  href: '/comandas',  icon: ClipboardList },
    { label: 'Caja',      href: '/caja',      icon: Banknote },
  ],
}

interface MobileBottomNavProps {
  role: string
  /** Sidebar drawer content (mismo SidebarContent del layout). */
  drawerContent: ReactNode
}

export default function MobileBottomNav({ role, drawerContent }: MobileBottomNavProps) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const items = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.admin

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {/* Bottom nav (solo mobile) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t border-white/8"
        style={{ background: 'rgba(10,10,20,0.92)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegación rápida"
      >
        <div className="flex items-stretch justify-around">
          {items.map(it => {
            const Icon = it.icon
            const active = isActive(it.href)
            return (
              <Link
                key={it.href}
                href={it.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
                style={{ minHeight: 56, color: active ? '#FF6B35' : 'rgba(255,255,255,0.55)' }}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-semibold leading-none">{it.label}</span>
              </Link>
            )
          })}
          {/* "Más" → abre drawer con el sidebar completo */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-white/55 hover:text-white transition-colors"
            style={{ minHeight: 56 }}
            aria-label="Abrir menú completo"
          >
            <Menu size={20} />
            <span className="text-[10px] font-semibold leading-none">Más</span>
          </button>
        </div>
      </nav>

      {/* Drawer fullscreen (solo mobile, solo cuando abierto) */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Cerrar menú"
          />
          {/* Sidebar como panel deslizable */}
          <div className="relative flex flex-col w-[280px] max-w-[85vw] bg-[#0A0A14] border-r border-white/8">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 right-3 z-10 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/8"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
            <div className="flex-1 overflow-y-auto">
              {drawerContent}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
