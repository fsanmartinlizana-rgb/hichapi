'use client'

import { useState } from 'react'
import { Check, MapPin, Clock, Globe, Phone, Camera, Loader2, Plus, AtSign, Eye, MousePointerClick, CalendarCheck, ChevronRight, Zap } from 'lucide-react'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const PRICE_RANGES = [
  { value: '$',   label: '$',   sub: 'menos de $8k/plato' },
  { value: '$$',  label: '$$',  sub: '$8k–$15k/plato' },
  { value: '$$$', label: '$$$', sub: 'más de $15k/plato' },
]

interface Schedule { open: string; close: string; closed: boolean }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-white/40 text-xs font-medium">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                 placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
  )
}

export default function RestaurantePage() {
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  const [name, setName]           = useState('El Rincón de Don José')
  const [desc, setDesc]           = useState('Cocina chilena e italiana de autor en el corazón de Providencia. Carta de temporada con ingredientes frescos.')
  const [address, setAddress]     = useState('Av. Providencia 2124, Providencia')
  const [phone, setPhone]         = useState('+56 2 2344 5678')
  const [website, setWebsite]     = useState('elrincondedonjose.cl')
  const [instagram, setInstagram] = useState('@rincondonjose')
  const [cuisine, setCuisine]     = useState('Chilena / Italiana')
  const [priceRange, setPriceRange] = useState('$$')
  const [capacity, setCapacity]   = useState('14')
  const [tags, setTags]           = useState(['familiar', 'romántico', 'para reuniones'])
  const [newTag, setNewTag]       = useState('')

  const [schedule, setSchedule] = useState<Record<string, Schedule>>({
    Lunes:      { open: '12:00', close: '22:00', closed: false },
    Martes:     { open: '12:00', close: '22:00', closed: false },
    Miércoles:  { open: '12:00', close: '22:00', closed: false },
    Jueves:     { open: '12:00', close: '22:00', closed: false },
    Viernes:    { open: '12:00', close: '23:30', closed: false },
    Sábado:     { open: '12:00', close: '23:30', closed: false },
    Domingo:    { open: '12:00', close: '17:00', closed: false },
  })

  // HiChapi Discovery
  const [discoveryEnabled, setDiscoveryEnabled] = useState(true)
  const discoveryScore = 78
  const discoveryStats = { views: 234, clicks: 12, reservations: 3 }
  const profileFields: { label: string; complete: boolean }[] = [
    { label: 'Nombre',          complete: true  },
    { label: 'Horarios',        complete: true  },
    { label: 'Teléfono',        complete: true  },
    { label: 'Fotos del local', complete: false },
    { label: 'Menú destacado',  complete: false },
    { label: 'Tags',            complete: false },
  ]
  const completedFields = profileFields.filter(f => f.complete).length

  // Chapi en lista de espera
  const [chapiWaitlistEnabled, setChapiWaitlistEnabled] = useState(true)
  const [chapiStartMinutes, setChapiStartMinutes]       = useState('10')
  const [chapiWaitlistNumber, setChapiWaitlistNumber]   = useState('')
  const [chapiInitMessage, setChapiInitMessage]         = useState(
    'Hola! Mientras esperas tu mesa, puedes ver nuestra carta y elegir tu pedido para que lo tengamos listo al sentarte 🍽'
  )

  function updateSchedule(day: string, field: keyof Schedule, value: string | boolean) {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  function addTag() {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()])
      setNewTag('')
    }
  }

  function scrollToIncompleteFields() {
    document.getElementById('profile-fields-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function handleSave() {
    setSaving(true)
    // Mock payload
    const _payload = {
      name, desc, address, phone, website, instagram,
      cuisine, priceRange, capacity, tags, schedule,
      discoveryEnabled,
      chapiWaitlistEnabled,
      chapiStartMinutes,
      chapiWaitlistNumber,
      chapiInitMessage,
    }
    await new Promise(r => setTimeout(r, 800))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Mi restaurante</h1>
          <p className="text-white/40 text-sm mt-0.5">Esta información aparece en HiChapi para los clientes</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold
                     hover:bg-[#e85d2a] disabled:opacity-60 transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
        </button>
      </div>

      {/* Photo */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-4">Foto principal</p>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-xl bg-white/5 border border-white/8 border-dashed
                          flex flex-col items-center justify-center gap-1.5 cursor-pointer
                          hover:border-[#FF6B35]/40 hover:bg-[#FF6B35]/5 transition-colors">
            <Camera size={18} className="text-white/25" />
            <span className="text-white/20 text-[10px]">Subir foto</span>
          </div>
          <div>
            <p className="text-white/50 text-sm">JPG o PNG · Mínimo 800×600px</p>
            <p className="text-white/25 text-xs mt-0.5">Esta foto aparece en las cards de búsqueda</p>
          </div>
        </div>
      </div>

      {/* ── HiChapi Discovery ──────────────────────────────────────── */}
      <div className="rounded-2xl p-[1px]"
           style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.55) 0%, rgba(255,107,53,0.08) 50%, rgba(255,107,53,0.30) 100%)' }}>
        <div className="bg-[#161622] rounded-2xl p-5 space-y-5">

          {/* Card header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-none">📍</span>
              <div>
                <p className="text-white font-semibold text-sm">HiChapi Discovery</p>
                <p className="text-white/35 text-xs mt-0.5">Aparece en búsquedas de clientes en Santiago</p>
              </div>
            </div>
            <span className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full
                             bg-emerald-500/12 border border-emerald-500/25 text-emerald-400 text-[11px] font-medium">
              <Check size={10} strokeWidth={3} />
              Conectado
            </span>
          </div>

          {/* Toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-white/80 text-sm font-medium">Estado en discovery</p>
              <p className={`text-xs transition-colors ${discoveryEnabled ? 'text-white/35' : 'text-white/20'}`}>
                {discoveryEnabled
                  ? 'Tu restaurante aparece en HiChapi cuando clientes buscan lugares para comer en Santiago'
                  : 'Tu restaurante no aparece en búsquedas de HiChapi'}
              </p>
            </div>
            <button
              onClick={() => setDiscoveryEnabled(v => !v)}
              className={`shrink-0 px-4 py-2 rounded-xl border text-xs font-semibold transition-all
                ${discoveryEnabled
                  ? 'bg-[#FF6B35]/15 border-[#FF6B35]/35 text-[#FF6B35]'
                  : 'bg-white/3 border-white/8 text-white/30 hover:border-white/20'}`}>
              {discoveryEnabled ? 'Activo' : 'Inactivo'}
            </button>
          </div>

          {/* Visibility + stats — dimmed when disabled */}
          <div className={`space-y-4 transition-opacity ${discoveryEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>

            {/* Visibility score bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-xs font-medium">Visibilidad</p>
                <p className="text-[#FF6B35] text-xs font-bold">{discoveryScore} puntos</p>
              </div>
              <div className="h-2 rounded-full bg-white/6 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${discoveryScore}%`,
                    background: 'linear-gradient(90deg, #FF6B35 0%, #ff9a6c 100%)',
                  }} />
              </div>
            </div>

            {/* Weekly stats */}
            <div>
              <p className="text-white/40 text-xs font-medium mb-2.5">Esta semana via HiChapi</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white/4 border border-white/6">
                  <Eye size={14} className="text-white/30" />
                  <p className="text-white font-bold text-base leading-none">{discoveryStats.views}</p>
                  <p className="text-white/30 text-[10px]">vistas</p>
                </div>
                <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white/4 border border-white/6">
                  <MousePointerClick size={14} className="text-white/30" />
                  <p className="text-white font-bold text-base leading-none">{discoveryStats.clicks}</p>
                  <p className="text-white/30 text-[10px]">clicks</p>
                </div>
                <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white/4 border border-white/6">
                  <CalendarCheck size={14} className="text-white/30" />
                  <p className="text-white font-bold text-base leading-none">{discoveryStats.reservations}</p>
                  <p className="text-white/30 text-[10px]">reservas</p>
                </div>
              </div>
            </div>

            {/* Profile completeness */}
            <div id="profile-fields-section">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-white/40 text-xs font-medium">Optimización del perfil</p>
                <p className="text-white/50 text-xs">
                  <span className="text-white font-semibold">{completedFields}</span>
                  <span className="text-white/30">/{profileFields.length} campos completos</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {profileFields.map(f => (
                  <span key={f.label}
                    className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors
                      ${f.complete
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80'
                        : 'bg-white/3 border-white/8 text-white/25'}`}>
                    {f.complete
                      ? <Check size={9} strokeWidth={3} />
                      : <span className="text-white/20 text-[9px] font-bold leading-none">✗</span>}
                    {f.label}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex gap-2 pt-1">
              <a href="/"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35]/15 border border-[#FF6B35]/30
                           text-[#FF6B35] text-xs font-semibold hover:bg-[#FF6B35]/25 transition-colors">
                Ver mi perfil en HiChapi
                <ChevronRight size={12} />
              </a>
              <button onClick={scrollToIncompleteFields}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50
                           text-xs font-semibold hover:border-white/20 hover:text-white/70 transition-colors">
                Optimizar perfil
              </button>
            </div>

          </div>
        </div>
      </div>
      {/* ── /HiChapi Discovery ─────────────────────────────────────── */}

      {/* Info básica */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <p className="text-white font-semibold text-sm">Información básica</p>
        <Field label="Nombre del restaurante">
          <TextInput value={name} onChange={setName} />
        </Field>
        <Field label="Descripción (aparece en Chapi)">
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                       placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 resize-none transition-colors" />
          <p className="text-white/20 text-[10px] mt-1">{desc.length}/300 caracteres</p>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de cocina"><TextInput value={cuisine} onChange={setCuisine} /></Field>
          <Field label="Capacidad (mesas)">
            <TextInput value={capacity} onChange={setCapacity} placeholder="14" />
          </Field>
        </div>
        <Field label="Rango de precios">
          <div className="flex gap-2">
            {PRICE_RANGES.map(p => (
              <button key={p.value} onClick={() => setPriceRange(p.value)}
                className={`flex-1 py-2.5 rounded-xl border text-center transition-all
                  ${priceRange === p.value
                    ? 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]'
                    : 'bg-white/3 border-white/8 text-white/30 hover:border-white/20'}`}>
                <p className="font-bold text-sm">{p.label}</p>
                <p className="text-[9px] mt-0.5 opacity-70">{p.sub}</p>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tags / Ambiente">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(t => (
              <span key={t} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full
                                       bg-[#FF6B35]/15 border border-[#FF6B35]/25 text-[#FF6B35]/80">
                {t}
                <button onClick={() => setTags(prev => prev.filter(x => x !== t))}
                  className="text-[#FF6B35]/40 hover:text-[#FF6B35] ml-0.5">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newTag} onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Agregar tag (ej: romántico)"
              className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                         placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            <button onClick={addTag}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/8 text-white/40
                         hover:border-[#FF6B35]/40 hover:text-[#FF6B35] transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </Field>
      </div>

      {/* Contacto */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <p className="text-white font-semibold text-sm">Contacto y redes</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dirección">
            <div className="relative">
              <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input value={address} onChange={e => setAddress(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                           placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>
          </Field>
          <Field label="Teléfono">
            <div className="relative">
              <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                           placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>
          </Field>
          <Field label="Sitio web">
            <div className="relative">
              <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input value={website} onChange={e => setWebsite(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                           placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>
          </Field>
          <Field label="Instagram">
            <div className="relative">
              <AtSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input value={instagram} onChange={e => setInstagram(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                           placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>
          </Field>
        </div>
      </div>

      {/* Horarios */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[#FF6B35]" />
          <p className="text-white font-semibold text-sm">Horarios de atención</p>
        </div>
        <div className="space-y-2">
          {DIAS.map(day => {
            const s = schedule[day]
            return (
              <div key={day} className="flex items-center gap-3">
                <button onClick={() => updateSchedule(day, 'closed', !s.closed)}
                  className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold border transition-all
                    ${!s.closed ? 'bg-[#FF6B35]/20 border-[#FF6B35]/30 text-[#FF6B35]' : 'bg-white/3 border-white/8 text-white/20'}`}>
                  {day[0]}
                </button>
                <p className={`text-sm w-20 shrink-0 ${s.closed ? 'text-white/20' : 'text-white/60'}`}>{day}</p>
                {s.closed ? (
                  <span className="text-white/20 text-xs italic">Cerrado</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="time" value={s.open} onChange={e => updateSchedule(day, 'open', e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-white text-xs
                                 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
                    <span className="text-white/25 text-xs">–</span>
                    <input type="time" value={s.close} onChange={e => updateSchedule(day, 'close', e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-white text-xs
                                 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Chapi en lista de espera */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">

        {/* Section header with separator */}
        <div className="border-t border-white/5 -mx-5 px-5 pt-4 -mt-4">
          <p className="text-white font-semibold text-sm">🤖 Chapi en lista de espera</p>
        </div>

        {/* Toggle: Activar conversación previa */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-white/80 text-sm font-medium">Activar conversación previa</p>
            <p className="text-white/30 text-xs">
              Chapi inicia una conversación con el cliente por WhatsApp mientras espera
            </p>
          </div>
          <button
            onClick={() => setChapiWaitlistEnabled(v => !v)}
            className={`shrink-0 px-4 py-2 rounded-xl border text-xs font-semibold transition-all
              ${chapiWaitlistEnabled
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-white/3 border-white/8 text-white/30 hover:border-white/20'}`}>
            {chapiWaitlistEnabled ? 'Activado' : 'Desactivado'}
          </button>
        </div>

        {/* Dependent fields — dimmed when disabled */}
        <div className={`space-y-4 transition-opacity ${chapiWaitlistEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>

          {/* Iniciar a cuántos minutos */}
          <Field label="Iniciar a cuántos minutos de ser llamado">
            <input
              type="number"
              min={0}
              max={60}
              value={chapiStartMinutes}
              onChange={e => setChapiStartMinutes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                         placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            <p className="text-white/20 text-[10px] mt-1">0 = al unirse a la lista</p>
          </Field>

          {/* Número WhatsApp */}
          <Field label="Número WhatsApp del restaurante">
            <TextInput
              value={chapiWaitlistNumber}
              onChange={setChapiWaitlistNumber}
              placeholder="+56 9 XXXX XXXX" />
            <p className="text-white/20 text-[10px] mt-1">Requiere WhatsApp Business API</p>
          </Field>

          {/* Mensaje inicial */}
          <Field label="Mensaje inicial de Chapi">
            <textarea
              value={chapiInitMessage}
              onChange={e => setChapiInitMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                         placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 resize-none transition-colors" />
          </Field>

        </div>
      </div>

      {/* Save button (bottom) */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold
                     hover:bg-[#e85d2a] disabled:opacity-60 transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
        </button>
      </div>

      {/* ── Crossover activo ───────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-white/3 border border-white/6">
        <Zap size={15} className="text-[#FF6B35]/60 shrink-0 mt-0.5" />
        <p className="text-white/35 text-xs leading-relaxed">
          <span className="text-white/55 font-medium">Crossover activo —</span>{' '}
          Cuando un cliente descubre tu restaurante en HiChapi y escanea el QR de mesa,
          Chapi ya conoce sus preferencias de la búsqueda.
        </p>
      </div>

    </div>
  )
}
