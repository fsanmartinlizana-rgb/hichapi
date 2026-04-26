/**
 * Mockups visuales de cada módulo del ecosistema HiChapi.
 *
 * Render 100% en componentes (no imágenes externas) para:
 * - Brand consistency (colores, tipografía, layout fiel a la plataforma).
 * - Cero dependencia de URLs externas o Unsplash.
 * - Reemplazables más adelante por screenshots reales — solo sustituir el
 *   case del switch.
 *
 * Cada mockup va dentro de un frame (browser desktop o phone) y muestra UI
 * con datos dummy verosímiles para Santiago / Chile.
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

/* ── Frames ─────────────────────────────────────────────────────────── */

function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="w-full h-full flex flex-col rounded-lg overflow-hidden" style={{ background: '#f4f4f6' }}>
      {/* chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ background: '#e8e8ec', borderColor: '#d4d4d8' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: '#ff5f57' }} />
        <span className="w-2 h-2 rounded-full" style={{ background: '#febc2e' }} />
        <span className="w-2 h-2 rounded-full" style={{ background: '#28c840' }} />
        <div className="ml-3 flex-1 px-2 py-0.5 rounded text-[8px] font-mono truncate" style={{ background: '#fff', color: '#666' }}>
          {url}
        </div>
      </div>
      {/* body */}
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
          background: '#fff',
          width: '70%',
          height: '92%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          border: '4px solid #1A1A2E',
        }}
      >
        {/* notch */}
        <div className="flex justify-center" style={{ background: '#1A1A2E', height: 8 }}>
          <div className="rounded-full" style={{ background: '#000', width: 30, height: 4, marginTop: 2 }} />
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

/* ── Mockups por módulo ─────────────────────────────────────────────── */

function DiscoveryMockup() {
  return (
    <BrowserFrame url="hichapi.cl/buscar">
      <div className="h-full flex flex-col px-3 py-2.5 text-[#1A1A2E]" style={{ background: '#FAFAF8' }}>
        <div className="text-[9px] font-bold mb-1.5" style={{ color: '#FF6B35' }}>
          hi<span style={{ color: '#1A1A2E' }}>chapi</span>
        </div>
        {/* Chat */}
        <div className="rounded p-1.5 mb-1.5" style={{ background: '#fff', border: '1px solid #ececef' }}>
          <p className="text-[8px] m-0 leading-tight">
            <strong style={{ color: '#FF6B35' }}>Chapi:</strong> ¿Qué quieres comer hoy?
          </p>
        </div>
        <div className="rounded p-1.5 mb-1.5" style={{ background: '#FF6B35', color: '#fff' }}>
          <p className="text-[8px] m-0 leading-tight">vegano en Providencia por 15 lucas</p>
        </div>
        <div className="text-[7px] font-bold mb-1" style={{ color: '#666' }}>3 OPCIONES</div>
        {/* Cards */}
        <div className="grid grid-cols-3 gap-1 flex-1">
          {[
            { name: 'Ramen Tokio', tag: 'Vegano · $11.900', emoji: '🍜' },
            { name: 'Don José', tag: 'Vegano · $12.900', emoji: '🍝' },
            { name: 'Sukho Thai', tag: 'Vegano · $12.900', emoji: '🍛' },
          ].map(r => (
            <div key={r.name} className="rounded overflow-hidden flex flex-col" style={{ background: '#fff', border: '1px solid #ececef' }}>
              <div className="flex items-center justify-center text-base" style={{ background: '#FFE4D6', height: 28 }}>
                {r.emoji}
              </div>
              <div className="p-1">
                <p className="text-[7px] font-bold m-0 truncate">{r.name}</p>
                <p className="text-[6px] m-0" style={{ color: '#888' }}>{r.tag}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  )
}

function MesasMockup() {
  const tables = [
    { id: 1, status: 'libre', label: '1' },
    { id: 2, status: 'ocupada', label: '2' },
    { id: 3, status: 'cuenta', label: '3' },
    { id: 4, status: 'libre', label: '4' },
    { id: 5, status: 'ocupada', label: '5' },
    { id: 6, status: 'libre', label: '6' },
    { id: 7, status: 'reservada', label: '7' },
    { id: 8, status: 'ocupada', label: '8' },
    { id: 9, status: 'libre', label: '9' },
  ]
  const colors: Record<string, string> = {
    libre: '#22c55e',
    ocupada: '#FF6B35',
    cuenta: '#f59e0b',
    reservada: '#a78bfa',
  }
  return (
    <BrowserFrame url="hichapi.cl/admin/mesas">
      <div className="h-full p-2 text-[#1A1A2E]" style={{ background: '#FAFAF8' }}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[9px] font-bold m-0">Salón principal</p>
          <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#FF6B35', color: '#fff' }}>
            + QR mesa
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {tables.map(t => (
            <div
              key={t.id}
              className="rounded flex flex-col items-center justify-center"
              style={{
                background: '#fff',
                border: `2px solid ${colors[t.status]}`,
                aspectRatio: '1',
              }}
            >
              <span className="text-[12px] font-extrabold">{t.label}</span>
              <span className="text-[6px] uppercase font-bold" style={{ color: colors[t.status] }}>
                {t.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  )
}

function ComandasMockup() {
  const cols = [
    { name: 'RECIBIDA', color: '#94a3b8', items: [{ t: '#1024', d: 'Mesa 5', it: 3 }] },
    { name: 'EN COCINA', color: '#FF6B35', items: [{ t: '#1023', d: 'Mesa 2', it: 4 }, { t: '#1022', d: 'Mesa 7', it: 2 }] },
    { name: 'LISTA', color: '#22c55e', items: [{ t: '#1021', d: 'Mesa 1', it: 1 }] },
  ]
  return (
    <BrowserFrame url="hichapi.cl/admin/comandas">
      <div className="h-full p-1.5 text-[#1A1A2E]" style={{ background: '#FAFAF8' }}>
        <div className="grid grid-cols-3 gap-1 h-full">
          {cols.map(c => (
            <div key={c.name} className="rounded p-1 flex flex-col" style={{ background: '#fff', border: '1px solid #ececef' }}>
              <p className="text-[7px] font-extrabold m-0 mb-1" style={{ color: c.color, letterSpacing: 0.5 }}>
                {c.name}
              </p>
              <div className="flex-1 flex flex-col gap-0.5">
                {c.items.map(it => (
                  <div key={it.t} className="rounded p-1" style={{ background: '#FAFAF8', border: `1px solid ${c.color}33` }}>
                    <p className="text-[7px] font-bold m-0">{it.t}</p>
                    <p className="text-[6px] m-0" style={{ color: '#888' }}>
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

function CajaMockup() {
  return (
    <BrowserFrame url="hichapi.cl/admin/caja">
      <div className="h-full p-2 text-[#1A1A2E]" style={{ background: '#FAFAF8' }}>
        <p className="text-[9px] font-bold m-0 mb-1.5">Cierre de turno</p>
        <div className="rounded p-1.5 mb-1.5" style={{ background: '#fff', border: '1px solid #ececef' }}>
          <div className="flex justify-between items-center">
            <span className="text-[7px]" style={{ color: '#888' }}>Total ventas</span>
            <span className="text-[12px] font-extrabold font-mono" style={{ color: '#FF6B35' }}>
              $1.247.500
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 mb-1.5">
          {[
            { l: 'Efectivo', v: '$340K' },
            { l: 'Tarjeta', v: '$680K' },
            { l: 'Digital', v: '$227K' },
          ].map(b => (
            <div key={b.l} className="rounded p-1 text-center" style={{ background: '#fff', border: '1px solid #ececef' }}>
              <p className="text-[6px] m-0" style={{ color: '#888' }}>{b.l}</p>
              <p className="text-[8px] font-bold m-0 font-mono">{b.v}</p>
            </div>
          ))}
        </div>
        <div className="rounded p-1.5" style={{ background: '#1A1A2E', color: '#fff' }}>
          <div className="flex items-center gap-1">
            <span className="text-[8px]">📄</span>
            <span className="text-[7px] font-bold">Boleta DTE 39 emitida</span>
          </div>
          <p className="text-[6px] m-0" style={{ color: '#94a3b8' }}>Folio 12389 · SII OK</p>
        </div>
      </div>
    </BrowserFrame>
  )
}

function GarzonMockup() {
  return (
    <PhoneFrame>
      <div className="h-full flex flex-col" style={{ background: '#FAFAF8' }}>
        {/* Header chat */}
        <div className="px-2 py-1.5 flex items-center gap-1.5" style={{ background: '#fff', borderBottom: '1px solid #ececef' }}>
          <div className="rounded-full flex items-center justify-center" style={{ background: '#FF6B35', width: 14, height: 14, color: '#fff', fontSize: 7, fontWeight: 800 }}>
            C
          </div>
          <div>
            <p className="text-[7px] font-bold m-0 leading-tight">Chapi · Mesa 4</p>
            <p className="text-[6px] m-0" style={{ color: '#22c55e' }}>en línea</p>
          </div>
        </div>
        {/* Mensajes */}
        <div className="flex-1 px-1.5 py-1.5 flex flex-col gap-1 overflow-hidden">
          <div className="self-start max-w-[80%] rounded-lg rounded-bl-sm px-1.5 py-1" style={{ background: '#fff', border: '1px solid #ececef' }}>
            <p className="text-[6px] m-0 leading-tight">Hola! ¿Qué se les antoja hoy?</p>
          </div>
          <div className="self-end max-w-[80%] rounded-lg rounded-br-sm px-1.5 py-1" style={{ background: '#FF6B35', color: '#fff' }}>
            <p className="text-[6px] m-0 leading-tight">2 ramen y un té matcha</p>
          </div>
          <div className="self-start max-w-[85%] rounded-lg rounded-bl-sm px-1.5 py-1" style={{ background: '#fff', border: '1px solid #ececef' }}>
            <p className="text-[6px] m-0 leading-tight">¡Listo! Pedido enviado a cocina. Tiempo estimado: 18 min ⏱</p>
          </div>
          <div className="self-end max-w-[80%] rounded-lg rounded-br-sm px-1.5 py-1" style={{ background: '#FF6B35', color: '#fff' }}>
            <p className="text-[6px] m-0 leading-tight">¿Tienen sin gluten?</p>
          </div>
          <div className="self-start max-w-[85%] rounded-lg rounded-bl-sm px-1.5 py-1" style={{ background: '#fff', border: '1px solid #ececef' }}>
            <p className="text-[6px] m-0 leading-tight">Sí. El ramen shio se puede preparar sin gluten. Lo cambio?</p>
          </div>
        </div>
        {/* Input */}
        <div className="px-1.5 py-1" style={{ background: '#fff', borderTop: '1px solid #ececef' }}>
          <div className="rounded-full px-2 py-0.5 text-[6px]" style={{ background: '#f4f4f6', color: '#888' }}>
            Escribe a Chapi...
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}

function StockMockup() {
  const items = [
    { name: 'Salmón', stock: 12, min: 5, ok: true },
    { name: 'Aceite oliva', stock: 3, min: 4, ok: false },
    { name: 'Arroz arborio', stock: 28, min: 10, ok: true },
    { name: 'Vino tinto', stock: 6, min: 8, ok: false },
  ]
  return (
    <BrowserFrame url="hichapi.cl/admin/stock">
      <div className="h-full p-2 text-[#1A1A2E]" style={{ background: '#FAFAF8' }}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[9px] font-bold m-0">Inventario</p>
          <span className="text-[6px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#fee2e2', color: '#dc2626' }}>
            2 alertas
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          {items.map(it => (
            <div key={it.name} className="rounded px-1.5 py-1 flex items-center justify-between" style={{ background: '#fff', border: '1px solid #ececef' }}>
              <div>
                <p className="text-[7px] font-bold m-0">{it.name}</p>
                <p className="text-[6px] m-0" style={{ color: '#888' }}>min {it.min} u.</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-extrabold font-mono" style={{ color: it.ok ? '#22c55e' : '#dc2626' }}>
                  {it.stock}
                </span>
                {!it.ok && <span className="text-[8px]">⚠</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  )
}

function AnalyticsMockup() {
  const bars = [40, 65, 50, 72, 88, 95, 78]
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  return (
    <BrowserFrame url="hichapi.cl/admin/analytics">
      <div className="h-full p-2 text-[#1A1A2E]" style={{ background: '#FAFAF8' }}>
        <p className="text-[9px] font-bold m-0 mb-1">Reporte semanal</p>
        <div className="grid grid-cols-2 gap-1 mb-1.5">
          <div className="rounded p-1" style={{ background: '#fff', border: '1px solid #ececef' }}>
            <p className="text-[6px] m-0" style={{ color: '#888' }}>Ventas</p>
            <p className="text-[10px] font-extrabold m-0 font-mono" style={{ color: '#FF6B35' }}>$8.4M</p>
            <p className="text-[6px] m-0" style={{ color: '#22c55e' }}>↑ +12%</p>
          </div>
          <div className="rounded p-1" style={{ background: '#fff', border: '1px solid #ececef' }}>
            <p className="text-[6px] m-0" style={{ color: '#888' }}>Ticket promedio</p>
            <p className="text-[10px] font-extrabold m-0 font-mono">$24.5K</p>
            <p className="text-[6px] m-0" style={{ color: '#22c55e' }}>↑ +5%</p>
          </div>
        </div>
        {/* Bar chart */}
        <div className="rounded p-1.5" style={{ background: '#fff', border: '1px solid #ececef' }}>
          <p className="text-[6px] m-0 mb-1" style={{ color: '#888' }}>Ventas por día (CLP)</p>
          <div className="flex items-end justify-between gap-0.5" style={{ height: 32 }}>
            {bars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full rounded-t" style={{ background: '#FF6B35', height: `${h}%` }} />
                <span className="text-[5px]" style={{ color: '#888' }}>{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}

function LoyaltyMockup() {
  return (
    <PhoneFrame>
      <div className="h-full flex flex-col p-2" style={{ background: 'linear-gradient(180deg, #FFF4EF 0%, #fff 60%)' }}>
        <p className="text-[7px] font-bold m-0 mb-1" style={{ color: '#FF6B35', letterSpacing: 0.5 }}>
          MI WALLET
        </p>
        {/* Points card */}
        <div
          className="rounded-lg p-1.5 mb-1.5"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #C93D0A)', color: '#fff' }}
        >
          <p className="text-[6px] m-0 opacity-80">Puntos acumulados</p>
          <p className="text-[14px] font-extrabold font-mono m-0 leading-tight">2.480</p>
          <p className="text-[5px] m-0 opacity-80">Próximo nivel: GOLD a 3.000 pts</p>
        </div>
        {/* Coupons */}
        <p className="text-[6px] font-bold m-0 mb-0.5" style={{ color: '#888' }}>CUPONES ACTIVOS</p>
        <div className="flex flex-col gap-1 flex-1">
          {[
            { t: 'BIENVENIDA20', v: '20% OFF', d: 'Vence 30 abr' },
            { t: 'CAFEDOBLE', v: '2x1 cafés', d: 'Vence 15 may' },
          ].map(c => (
            <div key={c.t} className="rounded p-1" style={{ background: '#fff', border: '1px dashed #FF6B35' }}>
              <div className="flex items-center justify-between">
                <p className="text-[7px] font-extrabold m-0 font-mono" style={{ color: '#FF6B35' }}>{c.v}</p>
                <span className="text-[5px] px-1 rounded" style={{ background: '#FFE4D6', color: '#FF6B35' }}>{c.t}</span>
              </div>
              <p className="text-[5px] m-0" style={{ color: '#888' }}>{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
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
      {(() => {
        switch (id) {
          case 'discovery': return <DiscoveryMockup />
          case 'mesas': return <MesasMockup />
          case 'comandas': return <ComandasMockup />
          case 'caja': return <CajaMockup />
          case 'garzon24': return <GarzonMockup />
          case 'stock': return <StockMockup />
          case 'analytics': return <AnalyticsMockup />
          case 'loyalty': return <LoyaltyMockup />
        }
      })()}
    </div>
  )
}
