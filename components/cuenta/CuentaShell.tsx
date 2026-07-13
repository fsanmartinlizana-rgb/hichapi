'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  User,
  Package,
  Star,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/cuenta/perfil', label: 'Perfil', icon: User },
  { href: '/cuenta/pedidos', label: 'Mis pedidos', icon: Package },
  { href: '/cuenta/fidelidad', label: 'Fidelidad', icon: Star },
  { href: '/cuenta/configuracion', label: 'Configuración', icon: Settings },
] as const

export function CuentaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navContent = (
    <>
      <div className="px-4 py-5 border-b border-[var(--border-subtle)]">
        <Link href="/buscar" className="text-[var(--text-strong)] font-bold text-lg tracking-tight">
          Hi<span className="text-[#E55A2B]">Chapi</span>
        </Link>
        <p className="text-[var(--text-muted)] text-xs mt-1">Mi cuenta</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#FF6B35]/15 text-[#E55A2B] border border-[#FF6B35]/25'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-sunken)]'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-sunken)] transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <div
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-strong)] flex"
      style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
    >
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-[var(--bg-canvas)] border-r border-[var(--border-subtle)]">
            <button
              type="button"
              className="absolute top-3 right-3 p-2 text-[var(--text-muted)]"
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg bg-[var(--surface-sunken)] text-[var(--text-body)]"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm">Mi cuenta</span>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-3xl w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
