'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Check, MapPin, Clock, Globe, Phone, Camera, Loader2, AtSign,
  ExternalLink, Sparkles, AlertCircle, CalendarDays, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload-image'
import { useRestaurant } from '@/lib/restaurant-context'
import { MODULE_LABELS, MODULE_PLAN_REQUIRED, type ModulesConfig } from '@/lib/defaults/moduleDefaults'
import { canAccessModule, PLANS } from '@/lib/plans'
import { TagPicker } from '@/components/ui/TagPicker'
import { RESTAURANT_TAG_GROUPS } from '@/lib/tags/catalog'

// ── Constants ────────────────────────────────────────────────────────────────

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
const PRICE_RANGES = [
  { value: '$',   label: '$',   sub: 'menos de $8k/plato' },
  { value: '$$',  label: '$$',  sub: '$8k–$15k/plato'      },
  { value: '$$$', label: '$$$', sub: 'más de $15k/plato'    },
] as const

const DEFAULT_HOURS: Record<string, Schedule> = {
  Lunes:     { open: '12:00', close: '22:00', closed: false },
  Martes:    { open: '12:00', close: '22:00', closed: false },
  Miércoles: { open: '12:00', close: '22:00', closed: false },
  Jueves:    { open: '12:00', close: '22:00', closed: false },
  Viernes:   { open: '12:00', close: '23:30', closed: false },
  Sábado:    { open: '12:00', close: '23:30', closed: false },
  Domingo:   { open: '12:00', close: '17:00', closed: false },
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Schedule { open: string; close: string; closed: boolean }

interface ProfileScoreField { key: string; label: string; complete: boolean; weight: number }
interface ProfileScore       { total: number; fields: ProfileScoreField[] }

interface RestaurantProfile {
  id:            string
  name:          string
  slug:          string
  description:   string | null
  address:       string | null
  neighborhood:  string | null
  phone:         string | null
  website:       string | null
  instagram:     string | null
  cuisine_type:  string | null
  price_range:   string | null
  capacity:      number | null
  tags:          string[] | null
  hours:         Record<string, Schedule> | null
  photo_url:     string | null
  gallery_urls:  string[] | null
  profile_score: number | null
}

// ── Small UI atoms ───────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-white/40 text-xs font-medium">{label}</label>
      {children}
      {hint && <p className="text-white/20 text-[10px]">{hint}</p>}
    </div>
  )
}

function TextInput({
  value, onChange, placeholder, type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
    />
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RestaurantePage() {
  const { restaurant } = useRestaurant()

  // Loading + persistence state
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Modules
  const [modules, setModules]               = useState<ModulesConfig | null>(null)
  const [modulesSaving, setModulesSaving]   = useState(false)

  // Profile fields
  const [name, setName]               = useState('')
  const [slug, setSlug]               = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress]         = useState('')
  const [phone, setPhone]             = useState('')
  const [website, setWebsite]         = useState('')
  const [instagram, setInstagram]     = useState('')
  const [cuisine, setCuisine]         = useState('')
  const [priceRange, setPriceRange]   = useState('$$')
  const [capacity, setCapacity]       = useState('')
  const [tags, setTags]               = useState<string[]>([])
  const [photoUrl, setPhotoUrl]       = useState<string | null>(null)
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [schedule, setSchedule]       = useState<Record<string, Schedule>>(DEFAULT_HOURS)

  // Photo upload
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reservation settings
  const [reservationsEnabled, setReservationsEnabled] = useState(false)
  const [reservationTimeout, setReservationTimeout]   = useState('15')
  const [reservationSlotDuration, setReservationSlotDuration] = useState('90')
  const [reservationMaxParty, setReservationMaxParty] = useState('10')
  const [reservationAdvanceDays, setReservationAdvanceDays] = useState('30')

  // DTE / SII fields
  const [rut, setRut]               = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [giro, setGiro]             = useState('')
  const [direccion, setDireccion]   = useState('')
  const [comuna, setComuna]         = useState('')

  // Score (from API)
  const [score, setScore] = useState<ProfileScore | null>(null)

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurant) return
    setLoading(true)
    ;(async () => {
      try {
        const [profileRes, modsRes] = await Promise.all([
          fetch(`/api/restaurants/profile?restaurant_id=${restaurant.id}`),
          (async () => {
            const supabase = createClient()
            return supabase.from('restaurants').select('modules_config').eq('id', restaurant.id).single()
          })(),
        ])

        const profileJson = await profileRes.json()
        if (profileRes.ok && profileJson.restaurant) {
          const r: RestaurantProfile = profileJson.restaurant
          setName(r.name ?? '')
          setSlug(r.slug ?? '')
          setDescription(r.description ?? '')
          setAddress(r.address ?? '')
          setPhone(r.phone ?? '')
          setWebsite(r.website ?? '')
          setInstagram(r.instagram ?? '')
          setCuisine(r.cuisine_type ?? '')
          setPriceRange(r.price_range ?? '$$')
          setCapacity(r.capacity?.toString() ?? '')
          setTags(r.tags ?? [])
          setPhotoUrl(r.photo_url)
          setGalleryUrls(r.gallery_urls ?? [])
          setSchedule(
            r.hours && Object.keys(r.hours).length > 0
              ? { ...DEFAULT_HOURS, ...r.hours }
              : DEFAULT_HOURS
          )
          setScore(profileJson.score)

          // Reservation settings (from extended profile)
          if (profileJson.restaurant.reservations_enabled !== undefined) {
            setReservationsEnabled(profileJson.restaurant.reservations_enabled ?? false)
            setReservationTimeout(String(profileJson.restaurant.reservation_timeout_min ?? 15))
            setReservationSlotDuration(String(profileJson.restaurant.reservation_slot_duration ?? 90))
            setReservationMaxParty(String(profileJson.restaurant.reservation_max_party ?? 10))
            setReservationAdvanceDays(String(profileJson.restaurant.reservation_advance_days ?? 30))
          }
          // DTE fields
          setRut(profileJson.restaurant.rut ?? '')
          setRazonSocial(profileJson.restaurant.razon_social ?? '')
          setGiro(profileJson.restaurant.giro ?? '')
          setDireccion(profileJson.restaurant.direccion ?? '')
          setComuna(profileJson.restaurant.comuna ?? '')
        }

        if (modsRes.data?.modules_config) {
          setModules(modsRes.data.modules_config as ModulesConfig)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [restaurant])

  // ── Modules toggle ────────────────────────────────────────────────────────
  async function toggleModule(key: keyof ModulesConfig) {
    if (!modules || !restaurant) return
    const updated = { ...modules, [key]: !modules[key] }
    setModules(updated)
    setModulesSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('restaurants').update({ modules_config: updated }).eq('id', restaurant.id)
    } finally {
      setModulesSaving(false)
    }
  }

  function updateSchedule(day: string, field: keyof Schedule, value: string | boolean) {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!restaurant) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/restaurants/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          name,
          description: description || null,
          address:     address || null,
          phone:       phone || null,
          website:     website || null,
          instagram:   instagram || null,
          cuisine_type: cuisine || null,
          price_range:  priceRange || null,
          capacity:    capacity ? parseInt(capacity, 10) : null,
          tags,
          hours:       schedule,
          photo_url:   photoUrl,
          gallery_urls: galleryUrls,
          reservations_enabled:     reservationsEnabled,
          reservation_timeout_min:  parseInt(reservationTimeout, 10) || 15,
          reservation_slot_duration: parseInt(reservationSlotDuration, 10) || 90,
          reservation_max_party:    parseInt(reservationMaxParty, 10) || 10,
          reservation_advance_days: parseInt(reservationAdvanceDays, 10) || 30,
          // DTE fields
          rut:          rut || null,
          razon_social: razonSocial || null,
          giro:         giro || null,
          direccion:    direccion || null,
          comuna:       comuna || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar')
        return
      }
      setScore(data.score)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Sin conexión')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 p-6">

      {/* ═════════════════════════════════════════════════════════════════════
          LEFT — Editable form
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6 max-w-3xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-white text-xl font-bold">Mi restaurante</h1>
            <p className="text-white/40 text-sm mt-0.5">
              Esta información aparece en HiChapi para los clientes
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar cambios'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertCircle size={14} className="text-red-300 shrink-0 mt-0.5" />
            <p className="text-red-200 text-xs">{error}</p>
          </div>
        )}

        {/* Profile completion score */}
        <ProfileScoreCard score={score} slug={slug} />

        {/* Photo */}
        <Section title="Foto principal">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl bg-white/5 border border-white/8 border-dashed flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#FF6B35]/40 transition-colors" onClick={() => fileInputRef.current?.click()}>
              {photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <Camera size={18} className="text-white/25" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-white/50 text-sm">JPG, PNG o WebP · Máx 5 MB</p>
              <p className="text-white/25 text-xs mt-0.5">Esta foto aparece en las cards de búsqueda</p>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file || !restaurant) return
                setUploading(true)
                try {
                  const url = await uploadImage({
                    file,
                    folder: `restaurants/${restaurant.id}`,
                  })
                  setPhotoUrl(url)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Error al subir foto')
                }
                finally { setUploading(false) }
              }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/30 text-[#FF6B35] text-xs font-medium hover:bg-[#FF6B35]/20 disabled:opacity-40 transition-colors">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                {uploading ? 'Subiendo...' : 'Subir foto'}
              </button>
            </div>
          </div>
        </Section>

        {/* Gallery */}
        <Section title="Galería de fotos">
          <p className="text-white/40 text-xs mb-3">
            Hasta 12 fotos de platos y del local para tu página pública. Arrastra para reordenar, clic en la X para quitar.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {galleryUrls.map((url, idx) => (
              <div key={url + idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setGalleryUrls(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/90 transition-all"
                  title="Quitar foto"
                >
                  <X size={12} />
                </button>
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-[#FF6B35] text-white text-[9px] font-semibold">
                    Portada
                  </span>
                )}
              </div>
            ))}
            {galleryUrls.length < 12 && (
              <label
                className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors
                  ${galleryUploading ? 'border-white/20 text-white/30' : 'border-white/15 text-white/40 hover:border-[#FF6B35]/50 hover:text-[#FF6B35]'}`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  disabled={galleryUploading}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? [])
                    if (files.length === 0 || !restaurant) return
                    const remaining = 12 - galleryUrls.length
                    const batch = files.slice(0, remaining)
                    setGalleryUploading(true)
                    try {
                      const uploaded: string[] = []
                      for (const f of batch) {
                        const url = await uploadImage({
                          file: f,
                          folder: `restaurants/${restaurant.id}/gallery`,
                        })
                        uploaded.push(url)
                      }
                      setGalleryUrls(prev => [...prev, ...uploaded])
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Error al subir galería')
                    } finally {
                      setGalleryUploading(false)
                      e.target.value = ''
                    }
                  }}
                />
                {galleryUploading
                  ? <Loader2 size={16} className="animate-spin" />
                  : <><Camera size={16} /><span className="text-[10px]">Añadir</span></>}
              </label>
            )}
          </div>
        </Section>

        {/* Basic info */}
        <Section title="Información básica">
          <Field label="Nombre del restaurante">
            <TextInput value={name} onChange={setName} />
          </Field>
          <Field label="Descripción (aparece en Chapi)" hint={`${description.length}/300 caracteres`}>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="Cuenta a los clientes qué hace especial tu restaurante…"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 resize-none transition-colors"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de cocina">
              <TextInput value={cuisine} onChange={setCuisine} placeholder="Chilena / Italiana" />
            </Field>
            <Field label="Capacidad (mesas)">
              <TextInput value={capacity} onChange={setCapacity} type="number" placeholder="14" />
            </Field>
          </div>
          <Field label="Rango de precios">
            <div className="flex gap-2">
              {PRICE_RANGES.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPriceRange(p.value)}
                  className={`flex-1 py-2.5 rounded-xl border text-center transition-all
                    ${priceRange === p.value
                      ? 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]'
                      : 'bg-white/3 border-white/8 text-white/30 hover:border-white/20'}`}
                >
                  <p className="font-bold text-sm">{p.label}</p>
                  <p className="text-[9px] mt-0.5 opacity-70">{p.sub}</p>
                </button>
              ))}
            </div>
          </Field>
          <Field
            label="Servicios y ambiente"
            hint="Elige los que aplican. Más tags = mejor ranking en Chapi y en buscadores de IA (ChatGPT, Perplexity, etc.)."
          >
            <TagPicker
              groups={RESTAURANT_TAG_GROUPS}
              selected={tags}
              onChange={setTags}
              max={30}
              allowCustom
            />
          </Field>
        </Section>

        {/* Contact */}
        <Section title="Contacto y redes">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dirección">
              <IconInput icon={<MapPin size={13} />} value={address} onChange={setAddress} />
            </Field>
            <Field label="Teléfono">
              <IconInput icon={<Phone size={13} />} value={phone} onChange={setPhone} placeholder="+56 2 ..." />
            </Field>
            <Field label="Sitio web">
              <IconInput icon={<Globe size={13} />} value={website} onChange={setWebsite} placeholder="ejemplo.cl" />
            </Field>
            <Field label="Instagram">
              <IconInput icon={<AtSign size={13} />} value={instagram} onChange={setInstagram} placeholder="@usuario" />
            </Field>
          </div>
        </Section>

        {/* DTE / SII */}
        <Section title="Datos tributarios (DTE)">
          <p className="text-white/30 text-xs -mt-1">
            Requeridos para emitir boletas electrónicas al SII. Deben coincidir exactamente con tu resolución SII.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="RUT emisor" hint="Ej: 77042148-9">
              <TextInput value={rut} onChange={setRut} placeholder="12345678-9" />
            </Field>
            <Field label="Razón social">
              <TextInput value={razonSocial} onChange={setRazonSocial} placeholder="MI EMPRESA SPA" />
            </Field>
          </div>
          <Field label="Giro" hint="Giro comercial tal como aparece en el SII">
            <TextInput value={giro} onChange={setGiro} placeholder="RESTAURANTES Y SIMILARES" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dirección (SII)">
              <TextInput value={direccion} onChange={setDireccion} placeholder="Av. Ejemplo 123" />
            </Field>
            <Field label="Comuna">
              <TextInput value={comuna} onChange={setComuna} placeholder="Santiago" />
            </Field>
          </div>
        </Section>

        {/* Hours */}
        <Section title="Horarios de atención" icon={<Clock size={14} className="text-[#FF6B35]" />}>          <div className="space-y-2">
            {DIAS.map(day => {
              const s = schedule[day] ?? DEFAULT_HOURS[day]
              return (
                <div key={day} className="flex items-center gap-3">
                  <button
                    onClick={() => updateSchedule(day, 'closed', !s.closed)}
                    className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold border transition-all
                      ${!s.closed
                        ? 'bg-[#FF6B35]/20 border-[#FF6B35]/30 text-[#FF6B35]'
                        : 'bg-white/3 border-white/8 text-white/20'}`}
                  >
                    {day[0]}
                  </button>
                  <p className={`text-sm w-20 shrink-0 ${s.closed ? 'text-white/20' : 'text-white/60'}`}>{day}</p>
                  {s.closed ? (
                    <span className="text-white/20 text-xs italic">Cerrado</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={s.open}
                        onChange={e => updateSchedule(day, 'open', e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-white text-xs focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
                      />
                      <span className="text-white/25 text-xs">–</span>
                      <input
                        type="time"
                        value={s.close}
                        onChange={e => updateSchedule(day, 'close', e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-white text-xs focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        {/* Reservations config */}
        <Section title="Reservas online" icon={<CalendarDays size={14} className="text-[#FF6B35]" />}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm">Activar reservas online</p>
                <p className="text-white/20 text-[10px]">Los clientes podrán reservar mesa desde HiChapi</p>
              </div>
              <button onClick={() => setReservationsEnabled(!reservationsEnabled)} className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${reservationsEnabled ? 'bg-[#FF6B35]/15 border-[#FF6B35]/35 text-[#FF6B35]' : 'bg-white/3 border-white/8 text-white/25 hover:border-white/20'}`}>
                {reservationsEnabled ? 'Activo' : 'Inactivo'}
              </button>
            </div>
            {reservationsEnabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tiempo de gracia (min)" hint="Si llegan tarde, la mesa se libera">
                    <TextInput value={reservationTimeout} onChange={setReservationTimeout} type="number" placeholder="15" />
                  </Field>
                  <Field label="Duración reserva (min)" hint="Tiempo estimado por mesa">
                    <TextInput value={reservationSlotDuration} onChange={setReservationSlotDuration} type="number" placeholder="90" />
                  </Field>
                  <Field label="Máx. personas online" hint="Grupos más grandes llaman por teléfono">
                    <TextInput value={reservationMaxParty} onChange={setReservationMaxParty} type="number" placeholder="10" />
                  </Field>
                  <Field label="Días de anticipación" hint="Cuántos días hacia adelante se puede reservar">
                    <TextInput value={reservationAdvanceDays} onChange={setReservationAdvanceDays} type="number" placeholder="30" />
                  </Field>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Modules */}
        {modules && (
          <Section title="Módulos activos" extra={modulesSaving ? <span className="text-[#FF6B35] text-xs">Guardando…</span> : null}>
            <div className="space-y-3">
              {(Object.keys(MODULE_LABELS) as Array<keyof ModulesConfig>).map(key => {
                const isActive = modules[key]
                const planReq  = MODULE_PLAN_REQUIRED[key]
                const currentPlan = restaurant?.plan || 'free'
                const hasAccess = canAccessModule(currentPlan, planReq)
                const planInfo = PLANS[planReq]
                return (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!hasAccess ? 'text-white/20' : isActive ? 'text-white/80' : 'text-white/30'}`}>{MODULE_LABELS[key]}</p>
                      <p className="text-white/20 text-[10px]">{hasAccess ? `Plan: ${planInfo?.name || planReq}` : `Requiere plan ${planInfo?.name || planReq}`}</p>
                    </div>
                    {hasAccess ? (
                      <button
                        onClick={() => toggleModule(key)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${isActive ? 'bg-[#FF6B35]/15 border-[#FF6B35]/35 text-[#FF6B35]' : 'bg-white/3 border-white/8 text-white/25 hover:border-white/20'}`}
                      >
                        {isActive ? 'Activo' : 'Inactivo'}
                      </button>
                    ) : (
                      <a href="/modulos" className="shrink-0 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold hover:bg-purple-500/20 transition-colors">
                        Upgrade
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          RIGHT — Live preview (sticky)
          ═════════════════════════════════════════════════════════════════════ */}
      <LivePreview
        name={name}
        description={description}
        photoUrl={photoUrl}
        address={address}
        cuisine={cuisine}
        priceRange={priceRange}
        tags={tags}
        schedule={schedule}
        slug={slug}
      />
    </div>
  )
}

// ── Helper components ───────────────────────────────────────────────────────

function Section({
  title, icon, extra, children,
}: {
  title: string
  icon?: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-white font-semibold text-sm">{title}</p>
        </div>
        {extra}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function IconInput({
  icon, value, onChange, placeholder,
}: {
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25">{icon}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
      />
    </div>
  )
}

function ProfileScoreCard({ score, slug }: { score: ProfileScore | null; slug: string }) {
  if (!score) return null

  const tone =
    score.total >= 80 ? { color: '#34D399', label: 'Excelente' }    :
    score.total >= 50 ? { color: '#FBBF24', label: 'Casi listo' }   :
                        { color: '#F87171', label: 'Necesita info' }

  return (
    <div
      className="rounded-2xl p-[1px]"
      style={{ background: `linear-gradient(135deg, ${tone.color}80 0%, ${tone.color}10 60%, ${tone.color}40 100%)` }}
    >
      <div className="bg-[#161622] rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} style={{ color: tone.color }} />
            <div>
              <p className="text-white font-semibold text-sm">Perfil en HiChapi</p>
              <p className="text-white/35 text-xs mt-0.5">
                Mientras más completo, más visible eres en discovery
              </p>
            </div>
          </div>
          <span
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={{ backgroundColor: `${tone.color}1a`, border: `1px solid ${tone.color}40`, color: tone.color }}
          >
            {score.total} / 100
          </span>
        </div>

        <div className="h-2 rounded-full bg-white/6 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score.total}%`, background: `linear-gradient(90deg, ${tone.color} 0%, ${tone.color}cc 100%)` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-white/40 text-[11px]">{tone.label}</p>
          {slug && (
            <a
              href={`/r/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-[#FF6B35] hover:text-[#FF8A5B] transition-colors"
            >
              Ver landing pública
              <ExternalLink size={11} />
            </a>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {score.fields.map(f => (
            <span
              key={f.key}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors
                ${f.complete
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80'
                  : 'bg-white/3 border-white/8 text-white/30'}`}
            >
              {f.complete
                ? <Check size={9} strokeWidth={3} />
                : <span className="text-white/20 text-[9px] font-bold leading-none">✗</span>}
              {f.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function LivePreview({
  name, description, photoUrl, address, cuisine, priceRange, tags, schedule, slug,
}: {
  name:        string
  description: string
  photoUrl:    string | null
  address:     string
  cuisine:     string
  priceRange:  string
  tags:        string[]
  schedule:    Record<string, Schedule>
  slug:        string
}) {
  // Compute open status (very rough — based on local time)
  const today = useMemo(() => {
    const d = new Date().getDay() // 0 = Sunday
    const map = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    return map[d]
  }, [])
  const todaySchedule = schedule[today]

  return (
    <div className="lg:sticky lg:top-6 self-start space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wide">Vista previa</p>
        <span className="text-white/25 text-[10px]">Como te ven en HiChapi</span>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-white/10">
        {/* Hero */}
        <div className="relative aspect-video bg-neutral-200">
          {photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photoUrl} alt={name || 'Restaurante'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300">
              <span className="text-5xl">🍽️</span>
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 60%)' }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-white text-lg font-bold leading-tight">
              {name || 'Tu restaurante'}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-white/85 text-[11px]">
              {cuisine && <span>{cuisine}</span>}
              {cuisine && priceRange && <span className="text-white/50">·</span>}
              {priceRange && <span>{priceRange}</span>}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 text-[#1A1A2E]">
          {description ? (
            <p className="text-[12px] text-neutral-500 leading-relaxed line-clamp-3">{description}</p>
          ) : (
            <p className="text-[11px] text-neutral-300 italic">Agrega una descripción para llamar la atención…</p>
          )}

          {address && (
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <MapPin size={11} className="text-[#FF6B35]" />
              <span className="truncate">{address}</span>
            </div>
          )}

          {todaySchedule && (
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Clock size={11} className="text-[#FF6B35]" />
              {todaySchedule.closed
                ? <span className="text-neutral-400">Hoy cerrado</span>
                : <span>Hoy {todaySchedule.open} – {todaySchedule.close}</span>}
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tags.slice(0, 6).map(t => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B35]/10 text-[#FF6B35] font-medium capitalize"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-neutral-100">
            <button
              type="button"
              className="w-full py-2 rounded-xl bg-[#FF6B35] text-white text-xs font-semibold opacity-90"
            >
              Unirme a lista de espera
            </button>
          </div>
        </div>
      </div>

      {slug && (
        <a
          href={`/r/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors"
        >
          Abrir vista pública en pestaña nueva
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  )
}
