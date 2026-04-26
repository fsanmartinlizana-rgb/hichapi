/**
 * Mockups de cada módulo del ecosistema HiChapi.
 *
 * Estrategia:
 * - 7 módulos usan screenshots REALES tomados del panel HiChapi
 *   (servidos desde /public/landing-modules/).
 * - "comandas" todavía no tiene screenshot real → fallback a mockup simulado.
 *
 * Cada screenshot real se muestra dentro de un frame (browser desktop o
 * phone) que da contexto visual de "esto vive en la plataforma".
 */

type MockupId =
  | 'discovery'
  | 'mesas'
  | 'comandas'
  | 'caja'
  | 'garzon24'
  | 'stock'
  | 'analytics'
  | 'loyalty'

interface ModuleMockupProps {
  id: MockupId
  /** Color del módulo, usado en accents del mockup. */
  color: string
}

/* ── Screenshots reales ──────────────────────────────────────────────────
 *
 * El path es relativo a /public, lo sirve Next.js automáticamente.
 * Para reemplazar un screenshot, sobrescribí el archivo manteniendo el
 * mismo nombre.
 */
const REAL_SCREENSHOTS: Partial<Record<MockupId, { src: string; type: 'browser' | 'phone'; url?: string; alt: string }>> = {
  discovery: {
    src: '/landing-modules/discovery.png',
    type: 'browser',
    url: 'hichapi.cl/buscar',
    alt: 'Búsqueda Chapi Discovery con conversación natural',
  },
  mesas: {
    src: '/landing-modules/mesas.png',
    type: 'browser',
    url: 'hichapi.cl/mesas',
    alt: 'Plano de mesas con estados en tiempo real',
  },
  caja: {
    src: '/landing-modules/caja.png',
    type: 'browser',
    url: 'hichapi.cl/caja',
    alt: 'Caja del día con totales por medio de pago',
  },
  garzon24: {
    src: '/landing-modules/garzon24.jpg',
    type: 'phone',
    alt: 'Chat del agente Chapi atendiendo cliente desde QR',
  },
  stock: {
    src: '/landing-modules/stock.png',
    type: 'browser',
    url: 'hichapi.cl/stock',
    alt: 'Inventario con alertas de stock mínimo',
  },
  analytics: {
    src: '/landing-modules/analytics.png',
    type: 'browser',
    url: 'hichapi.cl/analytics',
    alt: 'Reporte IA con ventas, top platos e insights',
  },
  loyalty: {
    src: '/landing-modules/loyalty.png',
    type: 'browser',
    url: 'hichapi.cl/fidelizacion',
    alt: 'Programa de fidelización con sellos y cupones',
  },
}

/* ── Frames ─────────────────────────────────────────────────────────── */

function BrowserFrame({ url, children }: { url?: string; children: React.ReactNode }) {
  return (
    <div className="w-full h-full flex flex-col rounded-lg overflow-hidden" style={{ background: '#1A1A2E' }}>
      {/* Chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ background: '#0E0E1A', borderColor: '#2A2A3A' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: '#ff5f57' }} />
        <span className="w-2 h-2 rounded-full" style={{ background: '#febc2e' }} />
        <span className="w-2 h-2 rounded-full" style={{ background: '#28c840' }} />
        {url && (
          <div className="ml-3 flex-1 px-2 py-0.5 rounded text-[8px] font-mono truncate" style={{ background: '#2A2A3A', color: '#aaa' }}>
            {url}
          </div>
        )}
      </div>
      {/* Body */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="rounded-[18px] overflow-hidden flex flex-col"
        style={{
          background: '#000',
          width: '70%',
          height: '94%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          border: '4px solid #1A1A2E',
        }}
      >
        {/* Notch */}
        <div className="flex justify-center" style={{ background: '#1A1A2E', height: 8 }}>
          <div className="rounded-full" style={{ background: '#000', width: 30, height: 4, marginTop: 2 }} />
        </div>
        <div className="flex-1 overflow-hidden bg-black">{children}</div>
      </div>
    </div>
  )
}

/* ── Real screenshot wrapper ────────────────────────────────────────── */

function RealScreenshot({ id }: { id: MockupId }) {
  const data = REAL_SCREENSHOTS[id]
  if (!data) return null

  const ImgEl = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={data.src}
      alt={data.alt}
      loading="lazy"
      className="w-full h-full object-cover object-top"
    />
  )

  return data.type === 'browser' ? (
    <BrowserFrame url={data.url}>{ImgEl}</BrowserFrame>
  ) : (
    <PhoneFrame>{ImgEl}</PhoneFrame>
  )
}

/* ── Garzón 24/7: composición especial — phone + value props ─────────
 *
 * El screenshot del chat solo no comunica bien el valor del agente.
 * Le agregamos contexto visual: badge 24/7 con pulse, status "en línea",
 * y bullets de superpoderes (entrenado con tu carta, detecta alergias,
 * sin esperas, etc.). Siempre cuesta menos vender un agente que
 * "se ve" autónomo. */

function Garzon24Mockup() {
  const data = REAL_SCREENSHOTS.garzon24!
  return (
    <div className="w-full h-full flex gap-2.5">
      {/* Phone con el chat real (lado izquierdo, ~45%) */}
      <div className="flex-shrink-0" style={{ width: '42%' }}>
        <PhoneFrame>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.src}
            alt={data.alt}
            loading="lazy"
            className="w-full h-full object-cover object-top"
          />
        </PhoneFrame>
      </div>

      {/* Tarjeta de valor del agente (lado derecho, ~55%) */}
      <div
        className="flex-1 rounded-lg p-3 flex flex-col"
        style={{
          background: 'linear-gradient(155deg, rgba(255,107,53,0.18), rgba(20,20,40,0.6))',
          border: '1px solid rgba(255,107,53,0.3)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Header: badge 24/7 con pulse */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: '#22c55e', animation: 'hcAgentPulse 2s ease-in-out infinite' }}
            />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#22c55e' }} />
          </span>
          <span className="font-bold uppercase" style={{ fontSize: 8, color: '#22c55e', letterSpacing: 1 }}>
            En línea · 24/7
          </span>
        </div>

        {/* Avatar + nombre del agente */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="rounded-full flex items-center justify-center font-extrabold"
            style={{
              width: 28,
              height: 28,
              background: 'radial-gradient(circle at 30% 30%, #FFB590, #FF6B35)',
              color: '#fff',
              fontSize: 14,
              boxShadow: '0 0 12px rgba(255,107,53,0.4)',
            }}
          >
            🤖
          </div>
          <div>
            <div className="font-extrabold text-white leading-tight" style={{ fontSize: 11 }}>
              Chapi
            </div>
            <div className="text-white/60 leading-tight" style={{ fontSize: 9 }}>
              Tu garzón virtual
            </div>
          </div>
        </div>

        {/* Value props */}
        <div className="flex flex-col gap-1 flex-1">
          {[
            'Entrenado con TU carta',
            'Detecta alergias y dietas',
            'Toma pedidos desde el QR',
            'Atiende sin que esperes',
          ].map(prop => (
            <div key={prop} className="flex items-center gap-1.5">
              <span style={{ fontSize: 8, color: '#FF6B35' }}>✓</span>
              <span className="text-white/85" style={{ fontSize: 9, lineHeight: 1.3 }}>
                {prop}
              </span>
            </div>
          ))}
        </div>

        {/* Footer mini-stat */}
        <div
          className="mt-2 rounded text-center py-1 px-1.5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="font-extrabold font-mono" style={{ fontSize: 13, color: '#FF6B35' }}>
            0s
          </div>
          <div className="text-white/55" style={{ fontSize: 7, letterSpacing: 0.5 }}>
            TIEMPO DE ESPERA
          </div>
        </div>

        <style>{`
          @keyframes hcAgentPulse {
            0%, 100% { transform: scale(1); opacity: 0.75 }
            50% { transform: scale(2.2); opacity: 0 }
          }
        `}</style>
      </div>
    </div>
  )
}

/* ── Fallback simulado: solo Comandas (no tenemos screenshot aún) ─── */

function ComandasMockup() {
  const cols = [
    { name: 'RECIBIDA', color: '#94a3b8', items: [{ t: '#1024', d: 'Mesa 5', it: 3 }] },
    { name: 'EN COCINA', color: '#FF6B35', items: [{ t: '#1023', d: 'Mesa 2', it: 4 }, { t: '#1022', d: 'Mesa 7', it: 2 }] },
    { name: 'LISTA', color: '#22c55e', items: [{ t: '#1021', d: 'Mesa 1', it: 1 }] },
  ]
  return (
    <BrowserFrame url="hichapi.cl/comandas">
      <div className="h-full p-1.5 text-[#fff]" style={{ background: '#0a0a14' }}>
        <div className="grid grid-cols-3 gap-1 h-full">
          {cols.map(c => (
            <div key={c.name} className="rounded p-1 flex flex-col" style={{ background: '#14142a', border: '1px solid #2A2A3A' }}>
              <p className="text-[7px] font-extrabold m-0 mb-1" style={{ color: c.color, letterSpacing: 0.5 }}>
                {c.name}
              </p>
              <div className="flex-1 flex flex-col gap-0.5">
                {c.items.map(it => (
                  <div key={it.t} className="rounded p-1" style={{ background: '#0a0a14', border: `1px solid ${c.color}55` }}>
                    <p className="text-[7px] font-bold m-0">{it.t}</p>
                    <p className="text-[6px] m-0" style={{ color: '#aaa' }}>
                      {it.d} · {it.it} items
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  )
}

/* ── Dispatcher ─────────────────────────────────────────────────────── */

export default function ModuleMockup({ id, color }: ModuleMockupProps) {
  return (
    <div
      className="w-full h-full"
      style={{
        background: `radial-gradient(ellipse at top, ${color}25 0%, #1A1A2E 80%)`,
        padding: 14,
      }}
    >
      {id === 'comandas'
        ? <ComandasMockup />
        : id === 'garzon24'
        ? <Garzon24Mockup />
        : <RealScreenshot id={id} />}
    </div>
  )
}
