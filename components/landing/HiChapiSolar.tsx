'use client'

import { useState, useEffect } from 'react'

type ModuleData = {
  id: string
  label: string
  icon: string
  angle: number
  color: string
  tagline: string
  desc: string
  plan: 'Todos los planes' | 'Starter+' | 'Pro+' | 'Enterprise'
  accent: string
}

// 8 modulos distribuidos cada 45 grados alrededor de Chapi (centro).
// Orden visual horario empezando en angle=0 (3 oclock).
const MODULES: ModuleData[] = [
  {
    id: 'discovery',
    label: 'Chapi Discovery',
    icon: '🔍',
    angle: 0,
    color: '#FF6B35',
    tagline: 'Búsqueda conversacional',
    desc: "Los clientes encuentran tu restaurante con lenguaje natural. 'Algo japonés sin gluten en Providencia por 20 lucas' → tú apareces.",
    plan: 'Todos los planes',
    accent: '#FF8C5A',
  },
  {
    id: 'mesas',
    label: 'Mesas & QR',
    icon: '🪑',
    angle: 45,
    color: '#E8541A',
    tagline: 'Salón digital',
    desc: 'QR por mesa, pedidos desde el celular del cliente, llegada directa a cocina. Sin papel, sin errores.',
    plan: 'Starter+',
    accent: '#FF6B35',
  },
  {
    id: 'comandas',
    label: 'Comandas',
    icon: '🍳',
    angle: 90,
    color: '#C93D0A',
    tagline: 'Cocina en tiempo real',
    desc: 'Panel Kanban: Recibida → En cocina → Lista → Entregada. Sincronización instantánea garzón-cocina.',
    plan: 'Starter+',
    accent: '#E8541A',
  },
  {
    id: 'caja',
    label: 'Caja & DTE',
    icon: '💳',
    angle: 135,
    color: '#FF6B35',
    tagline: 'Cierre en 3 clicks',
    desc: 'Apertura y cierre de turno, arqueo, boletas y facturas electrónicas SII. Todo integrado.',
    plan: 'Starter+',
    accent: '#FF8C5A',
  },
  {
    id: 'garzon24',
    label: 'Garzón 24/7',
    icon: '🤝',
    angle: 180,
    color: '#E8541A',
    tagline: 'Tu agente IA personal',
    desc: 'Cada restaurante tiene su propio agente Chapi entrenado con tu carta, tono y política de servicio. Atiende clientes en el QR las 24 horas.',
    plan: 'Starter+',
    accent: '#FF6B35',
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: '📦',
    angle: 225,
    color: '#C93D0A',
    tagline: 'Inventario inteligente',
    desc: 'Descuento automático por venta, alertas de mínimo, control de mermas y órdenes de compra.',
    plan: 'Pro+',
    accent: '#E8541A',
  },
  {
    id: 'analytics',
    label: 'Reporte IA',
    icon: '📊',
    angle: 270,
    color: '#FF6B35',
    tagline: 'Insights a las 23:59',
    desc: 'Reporte diario automático: ventas, platos top, horario peak y análisis narrativo generado por Chapi.',
    plan: 'Pro+',
    accent: '#FF8C5A',
  },
  {
    id: 'loyalty',
    label: 'Fidelización',
    icon: '⭐',
    angle: 315,
    color: '#E8541A',
    tagline: 'Clientes que vuelven',
    desc: 'Programa de puntos, cupones, wallet del cliente. Sin app adicional — funciona desde el QR de tu mesa.',
    plan: 'Pro+',
    accent: '#FF6B35',
  },
]

const PLAN_COLOR: Record<ModuleData['plan'], string> = {
  'Todos los planes': '#4ade80',
  'Starter+': '#60a5fa',
  'Pro+': '#f59e0b',
  Enterprise: '#a78bfa',
}

export default function HiChapiSolar() {
  const [active, setActive] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [pulse, setPulse] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setPulse(p => p + 1), 2000)
    return () => clearInterval(t)
  }, [])

  const R = isMobile ? 120 : 200
  const cx = isMobile ? 160 : 280
  const cy = isMobile ? 160 : 280
  const svgSize = isMobile ? 320 : 560
  const nodeR = isMobile ? 28 : 42
  const centerR = isMobile ? 44 : 70

  const activeModule = active ? MODULES.find(m => m.id === active) ?? null : null

  // Mobile fallback: grid de cards en vez del diagrama solar (mejor UX en pantallas chicas).
  if (isMobile) {
    return (
      <section
        aria-label="Ecosistema HiChapi"
        className="py-16"
        style={{ background: '#0d0d1a', color: '#fff', fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8">
            <div
              className="inline-block px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[2px] mb-3"
              style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35' }}
            >
              Ecosistema HiChapi
            </div>
            <h2
              className="text-2xl font-extrabold leading-tight mb-2"
              style={{
                background: 'linear-gradient(135deg, #fff 60%, #FF6B35)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Todo orbita alrededor de Chapi
            </h2>
            <p className="text-white/50 text-sm m-0">
              Cada restaurante tiene su propio agente
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {MODULES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActive(active === m.id ? null : m.id)}
                aria-expanded={active === m.id}
                className="text-left p-3 rounded-2xl transition-all"
                style={{
                  background: active === m.id ? `linear-gradient(135deg, ${m.accent}, ${m.color})` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active === m.id ? m.color : 'rgba(255,107,53,0.2)'}`,
                }}
              >
                <div className="text-2xl mb-1">{m.icon}</div>
                <div className="font-bold text-sm leading-tight">{m.label}</div>
                <div className="text-[11px] opacity-70 mt-0.5">{m.tagline}</div>
                <div className="mt-2">
                  <span
                    className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: PLAN_COLOR[m.plan] + '22',
                      color: PLAN_COLOR[m.plan],
                      border: `1px solid ${PLAN_COLOR[m.plan]}44`,
                    }}
                  >
                    {m.plan}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {activeModule && (
            <div
              className="mt-4 p-5 rounded-2xl"
              style={{ background: 'rgba(255,107,53,0.06)', border: `1px solid ${activeModule.color}40` }}
            >
              <p className="text-sm leading-relaxed text-white/80 m-0">
                {activeModule.desc}
              </p>
            </div>
          )}
        </div>
      </section>
    )
  }

  // Desktop: diagrama solar SVG interactivo
  return (
    <section
      aria-label="Ecosistema HiChapi"
      className="py-16 lg:py-20"
      style={{ background: '#0d0d1a', color: '#fff', fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
    >
      <div className="max-w-6xl mx-auto px-6 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-2">
          <div
            className="inline-block px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[2px] mb-3"
            style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35' }}
          >
            Ecosistema HiChapi
          </div>
          <h2
            className="font-extrabold m-0 mb-2"
            style={{
              fontSize: 36,
              lineHeight: 1.1,
              background: 'linear-gradient(135deg, #fff 60%, #FF6B35)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Todo orbita alrededor de Chapi
          </h2>
          <p className="text-white/45 m-0" style={{ fontSize: 15 }}>
            Cada restaurante tiene su propio agente — toca un módulo para conocerlo
          </p>
        </div>

        {/* Solar diagram */}
        <div className="relative" style={{ width: svgSize, height: svgSize }}>
          <svg width={svgSize} height={svgSize} className="absolute inset-0" aria-hidden="true">
            {/* Orbit ring */}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,107,53,0.12)" strokeWidth={1.5} strokeDasharray="4 6" />
            {/* Pulse rings */}
            {[0, 1].map(i => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={centerR + 8 + ((pulse + i * 30) % 60)}
                fill="none"
                stroke="rgba(255,107,53,0.08)"
                strokeWidth={1}
                style={{ opacity: 1 - ((pulse + i * 30) % 60) / 60 }}
              />
            ))}
            {/* Lines to nodes */}
            {MODULES.map(m => {
              const rad = (m.angle * Math.PI) / 180
              const nx = cx + R * Math.cos(rad)
              const ny = cy + R * Math.sin(rad)
              const isActive = active === m.id || hovered === m.id
              return (
                <line
                  key={m.id}
                  x1={cx}
                  y1={cy}
                  x2={nx}
                  y2={ny}
                  stroke={isActive ? '#FF6B35' : 'rgba(255,107,53,0.2)'}
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={isActive ? 'none' : '3 5'}
                  style={{ transition: 'all 0.3s' }}
                />
              )
            })}
          </svg>

          {/* Center node — Chapi */}
          <div
            aria-hidden="true"
            className="absolute rounded-full flex flex-col items-center justify-center z-10"
            style={{
              left: cx - centerR,
              top: cy - centerR,
              width: centerR * 2,
              height: centerR * 2,
              background: 'radial-gradient(circle at 35% 35%, #FF8C5A, #FF6B35 60%, #C93D0A)',
              boxShadow: '0 0 40px rgba(255,107,53,0.5), 0 0 80px rgba(255,107,53,0.2)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
          >
            <span style={{ fontSize: 28 }}>🤖</span>
            <span className="font-extrabold text-white mt-0.5" style={{ fontSize: 11, letterSpacing: 1 }}>
              CHAPI
            </span>
          </div>

          {/* Module nodes */}
          {MODULES.map(m => {
            const rad = (m.angle * Math.PI) / 180
            const nx = cx + R * Math.cos(rad)
            const ny = cy + R * Math.sin(rad)
            const isActive = active === m.id
            const isHovered = hovered === m.id

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActive(active === m.id ? null : m.id)}
                onMouseEnter={() => setHovered(m.id)}
                onMouseLeave={() => setHovered(null)}
                aria-label={`${m.label} — ${m.tagline}`}
                aria-pressed={isActive}
                className="absolute rounded-full flex flex-col items-center justify-center z-20 cursor-pointer"
                style={{
                  left: nx - nodeR,
                  top: ny - nodeR,
                  width: nodeR * 2,
                  height: nodeR * 2,
                  background: isActive
                    ? `radial-gradient(circle at 35% 35%, ${m.accent}, ${m.color})`
                    : 'rgba(26,26,46,0.95)',
                  border: `2px solid ${isActive || isHovered ? m.color : 'rgba(255,107,53,0.25)'}`,
                  boxShadow: isActive
                    ? `0 0 24px ${m.color}60, 0 0 48px ${m.color}20`
                    : isHovered
                    ? `0 0 16px ${m.color}40`
                    : 'none',
                  transition: 'all 0.25s cubic-bezier(.34,1.56,.64,1)',
                  transform: isActive ? 'scale(1.15)' : isHovered ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                <span style={{ fontSize: 20 }}>{m.icon}</span>
                <span
                  className="font-bold text-center mt-0.5"
                  style={{
                    fontSize: 9,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                    lineHeight: 1.2,
                    maxWidth: nodeR * 1.6,
                  }}
                >
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Detail card */}
        <div className="w-full mt-4" style={{ maxWidth: 520, minHeight: 120, transition: 'all 0.3s' }}>
          {activeModule ? (
            <div
              key={activeModule.id}
              className="rounded-2xl px-6 py-5"
              style={{
                background: 'rgba(255,107,53,0.06)',
                border: `1px solid ${activeModule.color}40`,
                animation: 'hcSolarFadeIn 0.25s ease',
              }}
            >
              <style>{`@keyframes hcSolarFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>
              <div className="flex items-center gap-3 mb-2.5">
                <span style={{ fontSize: 28 }}>{activeModule.icon}</span>
                <div>
                  <div className="font-extrabold" style={{ fontSize: 18 }}>{activeModule.label}</div>
                  <div className="font-semibold" style={{ color: activeModule.color, fontSize: 12 }}>
                    {activeModule.tagline}
                  </div>
                </div>
                <div className="ml-auto">
                  <span
                    className="inline-block font-bold px-2.5 py-0.5 rounded-full"
                    style={{
                      background: PLAN_COLOR[activeModule.plan] + '22',
                      color: PLAN_COLOR[activeModule.plan],
                      border: `1px solid ${PLAN_COLOR[activeModule.plan]}44`,
                      fontSize: 11,
                    }}
                  >
                    {activeModule.plan}
                  </span>
                </div>
              </div>
              <p className="m-0 text-white/70 leading-relaxed" style={{ fontSize: 14 }}>
                {activeModule.desc}
              </p>
            </div>
          ) : (
            <div className="text-center text-white/20 pt-4" style={{ fontSize: 13 }}>
              ← Selecciona un módulo para ver detalles
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-5">
          {(Object.entries(PLAN_COLOR) as Array<[ModuleData['plan'], string]>).map(([plan, color]) => (
            <div key={plan} className="flex items-center gap-1.5">
              <div className="rounded-full" style={{ width: 8, height: 8, background: color }} />
              <span className="text-white/50" style={{ fontSize: 12 }}>{plan}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
