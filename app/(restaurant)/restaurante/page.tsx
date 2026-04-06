'use client'

import { useState } from 'react'
import { Check, MapPin, Clock, Globe, Phone, Camera, Loader2, Plus, AtSign } from 'lucide-react'

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

  function updateSchedule(day: string, field: keyof Schedule, value: string | boolean) {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  function addTag() {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()])
      setNewTag('')
    }
  }

  async function handleSave() {
    setSaving(true)
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
    </div>
  )
}
