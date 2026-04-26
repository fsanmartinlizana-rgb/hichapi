'use client'

import { useState, useEffect } from 'react'
import HiChapiLogo from './HiChapiLogo'
import ModuleMockup from './ModuleMockup'

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
  /** Imagen ilustrativa del módulo (Unsplash) que se muestra en el panel
   * lateral al activarse. Reemplazar por screenshots reales de la UI cuando
   * estén disponibles. */
  image: string
  imageAlt: string
}

// 8 módulos distribuidos cada 45° alrededor de Chapi.
// angle 0 = derecha, 90 = abajo, 180 = izquierda, 270 = arriba.
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
    image: 'https://images.unsplash.com/photo-1528747045269-390fe33c19f2?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Cliente buscando restaurantes con chat IA en su celular',
  },
  {
    id: 'mesas',
    label: 'Mesas & QR',
    icon: '🪑',
    angle: 45,
    color: '#E8541A',
    tagline: 'Salón digital',
    desc: 'QR único por mesa, pedidos desde el celular del cliente, llegada directa a cocina. Sin papel, sin errores.',
    plan: 'Starter+',
    accent: '#FF6B35',
    image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Mesa de restaurante con código QR',
  },
  {
    id: 'comandas',
    label: 'Comandas',
    icon: '🍳',
    angle: 90,
    color: '#C93D0A',
    tagline: 'Cocina en tiempo real',
    desc: 'Panel Kanban: Recibida → En cocina → Lista → Entregada. Sincronización instantánea garzón–cocina.',
    plan: 'Starter+',
    accent: '#E8541A',
    image: 'https://images.unsplash.com/photo-1581349437898-cebbe9831942?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Cocinero usando tablet de comandas en cocina profesional',
  },
  {
    id: 'caja',
    label: 'Caja & DTE',
    icon: '💳',
    angle: 135,
    color: '#FF6B35',
    tagline: 'Cierre en 3 clicks',
    desc: 'Apertura/cierre de turno, arqueo, boletas y facturas electrónicas SII. Todo integrado.',
    plan: 'Starter+',
    accent: '#FF8C5A',
    image: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Terminal de caja registradora moderno con tablet',
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
    image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Conversación con asistente IA en pantalla',
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
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Bodega de restaurante organizada con productos',
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
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Dashboard de analytics con gráficos de ventas',
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
    image: 'https://images.unsplash.com/photo-1556742111-a301076d9d18?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Cliente feliz con tarjeta de fidelización digital',
  },
]

const PLAN_COLOR: Record<ModuleData['plan'], string> = {
  'Todos los planes': '#4ade80',
  'Starter+': '#60a5fa',
  'Pro+': '#f59e0b',
  Enterprise: '#a78bfa',
}

/**
 * Devuelve si el label de un módulo debe ir a la izquierda o derecha del nodo
 * (basado en su ángulo). Módulos en angles 90-270 quedan a la izquierda.
 */
function labelSide(angle: number): 'left' | 'right' {
  return angle > 90 && angle < 270 ? 'left' : 'right'
}

export default function HiChapiSolar() {
  const [active, setActive] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [pulse, setPulse] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024) // breakpoint lg
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Pulse rings (cada 2s)
  useEffect(() => {
    const t = setInterval(() => setPulse(p => p + 1), 2000)
    return () => clearInterval(t)
  }, [])

  // Rotación lenta de la órbita (futurista)
  useEffect(() => {
    const t = setInterval(() => setRotation(r => (r + 0.3) % 360), 60)
    return () => clearInterval(t)
  }, [])

  // Geometría — más compacta en desktop para dejar espacio al panel lateral
  const R = isMobile ? 130 : 180
  const cx = isMobile ? 175 : 280
  const cy = isMobile ? 175 : 270
  const svgWidth = isMobile ? 350 : 560
  const svgHeight = isMobile ? 350 : 540
  const nodeR = isMobile ? 28 : 34
  const centerR = isMobile ? 50 : 72

  const activeModule = active ? MODULES.find(m => m.id === active) ?? null : null

  // ── Mobile: stack vertical (cards + detail debajo) ────────────────
  if (isMobile) {
    return (
      <section
        aria-label="Ecosistema HiChapi"
        className="py-12"
        style={{ background: '#0a0a14', color: '#fff', fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-6">
            <div
              className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[2px] mb-3"
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

          <div className="grid grid-cols-2 gap-2.5">
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
              className="mt-3 rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,107,53,0.06)', border: `1px solid ${activeModule.color}40` }}
            >
              <div style={{ height: 200 }}>
                <ModuleMockup
                  id={activeModule.id as Parameters<typeof ModuleMockup>[0]['id']}
                  color={activeModule.color}
                />
              </div>
              <div className="p-4">
                <p className="text-sm leading-relaxed text-white/80 m-0">
                  {activeModule.desc}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    )
  }

  // ── Desktop: solar + side panel en grid de 2 columnas ──────────────
  return (
    <section
      aria-label="Ecosistema HiChapi"
      className="py-16 lg:py-20 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center, #14142a 0%, #0a0a14 70%)',
        color: '#fff',
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      {/* Stars / particles background — decoración futurista */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        {[...Array(40)].map((_, i) => {
          const top = (i * 37) % 100
          const left = (i * 53) % 100
          const size = (i % 3) + 1
          const delay = (i % 5) * 0.4
          return (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: size,
                height: size,
                background: '#fff',
                opacity: 0.3 + (i % 3) * 0.2,
                animation: `hcStarTwinkle 3s ease-in-out infinite`,
                animationDelay: `${delay}s`,
              }}
            />
          )
        })}
      </div>

      <style>{`
        @keyframes hcStarTwinkle { 0%,100% { opacity: 0.2 } 50% { opacity: 0.7 } }
        @keyframes hcSolarFadeIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes hcCenterPulse {
          0%, 100% { box-shadow: 0 0 50px rgba(255,107,53,0.6), 0 0 100px rgba(255,107,53,0.25), inset 0 0 20px rgba(255,255,255,0.15) }
          50% { box-shadow: 0 0 70px rgba(255,107,53,0.8), 0 0 140px rgba(255,107,53,0.35), inset 0 0 30px rgba(255,255,255,0.2) }
        }
      `}</style>

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-8 relative z-10">
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
            Cada restaurante tiene su propio agente — toca un módulo para ver el detalle
          </p>
        </div>

        {/* Grid de 2 columnas: solar | side panel — gap amplio para evitar
            que el label de "Chapi Discovery" (a la derecha del nodo en
            angle 0) se solape con la imagen del panel. */}
        <div className="flex flex-row items-start justify-center gap-16 xl:gap-20 relative z-10">
          {/* ── Solar (columna izquierda) ──────────────────────────── */}
          <div className="relative flex-shrink-0" style={{ width: svgWidth, height: svgHeight }}>
            <svg width={svgWidth} height={svgHeight} className="absolute inset-0" aria-hidden="true">
              <defs>
                <filter id="hcSolarGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="hcOrbitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,107,53,0.05)" />
                  <stop offset="50%" stopColor="rgba(255,107,53,0.4)" />
                  <stop offset="100%" stopColor="rgba(255,107,53,0.05)" />
                </linearGradient>
              </defs>

              {/* Outer + main orbit */}
              <circle cx={cx} cy={cy} r={R + 20} fill="none" stroke="rgba(255,107,53,0.06)" strokeWidth={1} />
              <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,107,53,0.18)" strokeWidth={1.5} strokeDasharray="2 8" />

              {/* Rotating orbit accent */}
              <circle
                cx={cx}
                cy={cy}
                r={R}
                fill="none"
                stroke="url(#hcOrbitGrad)"
                strokeWidth={2}
                strokeDasharray="80 720"
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.06s linear',
                }}
              />
              {/* Pulse rings desde el centro */}
              {[0, 1, 2].map(i => (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={centerR + 8 + ((pulse * 12 + i * 40) % 100)}
                  fill="none"
                  stroke="rgba(255,107,53,0.15)"
                  strokeWidth={1}
                  style={{ opacity: 1 - ((pulse * 12 + i * 40) % 100) / 100 }}
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
                    stroke={isActive ? '#FF6B35' : 'rgba(255,107,53,0.18)'}
                    strokeWidth={isActive ? 2 : 1}
                    strokeDasharray={isActive ? 'none' : '2 6'}
                    filter={isActive ? 'url(#hcSolarGlow)' : undefined}
                    style={{ transition: 'all 0.3s' }}
                  />
                )
              })}
            </svg>

            {/* Center node — Logo HiChapi */}
            <div
              aria-hidden="true"
              className="absolute rounded-full flex flex-col items-center justify-center z-20"
              style={{
                left: cx - centerR,
                top: cy - centerR,
                width: centerR * 2,
                height: centerR * 2,
                background: 'radial-gradient(circle at 30% 30%, #FFB590, #FF6B35 50%, #C93D0A)',
                border: '2px solid rgba(255,255,255,0.25)',
                animation: 'hcCenterPulse 3s ease-in-out infinite',
              }}
            >
              {/* Logo en el centro (con override de colores para fondo naranja) */}
              <HiChapiLogo size={48} flameColor="#fff" accentColor="#1A1A2E" />
              <span
                className="font-extrabold text-white"
                style={{ fontSize: 11, letterSpacing: 1.5, marginTop: 2 }}
              >
                CHAPI
              </span>
            </div>

            {/* Module nodes + labels al lado */}
            {MODULES.map(m => {
              const rad = (m.angle * Math.PI) / 180
              const nx = cx + R * Math.cos(rad)
              const ny = cy + R * Math.sin(rad)
              const isActive = active === m.id
              const isHovered = hovered === m.id
              const side = labelSide(m.angle)
              const labelOffset = nodeR + 8

              return (
                <div key={m.id}>
                  {/* Node */}
                  <button
                    type="button"
                    onClick={() => setActive(active === m.id ? null : m.id)}
                    onMouseEnter={() => setHovered(m.id)}
                    onMouseLeave={() => setHovered(null)}
                    aria-label={`${m.label} — ${m.tagline}`}
                    aria-pressed={isActive}
                    className="absolute rounded-full flex items-center justify-center z-30 cursor-pointer"
                    style={{
                      left: nx - nodeR,
                      top: ny - nodeR,
                      width: nodeR * 2,
                      height: nodeR * 2,
                      background: isActive || isHovered
                        ? `radial-gradient(circle at 30% 30%, ${m.accent}, ${m.color})`
                        : 'rgba(20,20,40,0.9)',
                      border: `2px solid ${isActive || isHovered ? m.color : 'rgba(255,107,53,0.3)'}`,
                      boxShadow: isActive
                        ? `0 0 30px ${m.color}90, 0 0 60px ${m.color}40`
                        : isHovered
                        ? `0 0 20px ${m.color}60`
                        : `0 4px 16px rgba(0,0,0,0.3)`,
                      transition: 'all 0.3s cubic-bezier(.34,1.56,.64,1)',
                      transform: isActive ? 'scale(1.18)' : isHovered ? 'scale(1.1)' : 'scale(1)',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{m.icon}</span>
                  </button>

                  {/* Label compacto al lado del nodo */}
                  <div
                    className="absolute z-20 pointer-events-none"
                    style={{
                      left: side === 'right' ? nx + labelOffset : 'auto',
                      right: side === 'left' ? svgWidth - (nx - labelOffset) : 'auto',
                      top: ny - 18,
                      textAlign: side === 'right' ? 'left' : 'right',
                      transition: 'all 0.3s',
                      opacity: isActive || isHovered ? 1 : 0.85,
                      width: 110,
                    }}
                  >
                    <div
                      className="font-bold leading-tight"
                      style={{
                        fontSize: 12,
                        color: isActive || isHovered ? m.color : '#fff',
                        transition: 'color 0.3s',
                      }}
                    >
                      {m.label}
                    </div>
                    <div className="text-white/55 leading-tight" style={{ fontSize: 10, marginTop: 2 }}>
                      {m.tagline}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Side panel (columna derecha) ───────────────────────── */}
          <aside
            className="flex-shrink-0 self-stretch flex flex-col"
            style={{ width: 360, minHeight: svgHeight }}
            aria-live="polite"
          >
            {activeModule ? (
              <div
                key={activeModule.id}
                className="rounded-2xl overflow-hidden h-full flex flex-col"
                style={{
                  background: 'linear-gradient(155deg, rgba(255,107,53,0.08), rgba(20,20,40,0.6))',
                  border: `1px solid ${activeModule.color}40`,
                  boxShadow: `0 0 40px ${activeModule.color}20`,
                  animation: 'hcSolarFadeIn 0.4s ease',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {/* Mockup visual del módulo (UI simulada con datos dummy) */}
                <div className="relative" style={{ height: 220 }}>
                  <ModuleMockup
                    id={activeModule.id as Parameters<typeof ModuleMockup>[0]['id']}
                    color={activeModule.color}
                  />
                  {/* Badge plan flotante */}
                  <span
                    className="absolute top-3 right-3 inline-flex items-center font-bold rounded-full z-10"
                    style={{
                      background: PLAN_COLOR[activeModule.plan] + 'cc',
                      color: '#fff',
                      border: `1px solid ${PLAN_COLOR[activeModule.plan]}`,
                      backdropFilter: 'blur(8px)',
                      fontSize: 10,
                      padding: '4px 10px',
                      letterSpacing: 0.4,
                    }}
                  >
                    {activeModule.plan}
                  </span>
                </div>

                {/* Texto */}
                <div className="p-5 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span style={{ fontSize: 24 }}>{activeModule.icon}</span>
                    <div className="font-extrabold" style={{ fontSize: 20 }}>
                      {activeModule.label}
                    </div>
                  </div>
                  <div
                    className="font-semibold mb-3"
                    style={{ color: activeModule.color, fontSize: 12, letterSpacing: 0.3 }}
                  >
                    {activeModule.tagline}
                  </div>
                  <p className="m-0 text-white/75 leading-relaxed" style={{ fontSize: 14 }}>
                    {activeModule.desc}
                  </p>
                </div>
              </div>
            ) : (
              /* Placeholder cuando no hay nada seleccionado */
              <div
                className="rounded-2xl h-full flex flex-col items-center justify-center text-center px-8"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed rgba(255,107,53,0.2)',
                }}
              >
                <div
                  className="rounded-full flex items-center justify-center mb-4"
                  style={{
                    width: 56,
                    height: 56,
                    background: 'rgba(255,107,53,0.08)',
                    border: '1px solid rgba(255,107,53,0.2)',
                  }}
                >
                  <span style={{ fontSize: 24 }}>👆</span>
                </div>
                <p className="text-white/60 font-semibold m-0 mb-1" style={{ fontSize: 14 }}>
                  Selecciona un módulo
                </p>
                <p className="text-white/35 m-0" style={{ fontSize: 12, lineHeight: 1.5 }}>
                  Toca cualquier módulo del ecosistema para ver el detalle, una imagen y a qué plan pertenece.
                </p>
              </div>
            )}
          </aside>
        </div>

        {/* Legend de planes */}
        <div className="flex flex-wrap justify-center gap-4 mt-8 relative z-10">
          {(Object.entries(PLAN_COLOR) as Array<[ModuleData['plan'], string]>).map(([plan, color]) => (
            <div key={plan} className="flex items-center gap-1.5">
              <div className="rounded-full" style={{ width: 8, height: 8, background: color, boxShadow: `0 0 8px ${color}80` }} />
              <span className="text-white/55" style={{ fontSize: 12 }}>{plan}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
