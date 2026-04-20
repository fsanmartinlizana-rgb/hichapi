'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  Users, Plus, Mail, RefreshCw, X, Check, Trash2,
  ShieldCheck, ChefHat, UtensilsCrossed, UserCheck, Crown, Shield, AlertCircle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { RolesManagerModal, type CustomRole } from '@/components/restaurant/RolesManagerModal'

// ── Merged role type used by all three render points ────────────────────────
interface UnifiedRole {
  value:       string                          // slug / id usado en team_members.role
  label:       string
  desc:        string
  icon:        React.ComponentType<{ size?: number; className?: string }>
  colorClass:  string                          // Tailwind classes "bg-X/15 text-Y border-Z/30"
  isCustom:    boolean
  customColor?: string                         // hex (para custom)
}

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  user_id: string | null
  invited_email: string | null
  role: string
  roles: string[] | null
  status: string
  active?: boolean | null
  joined_at: string
  full_name?: string | null
  phone?: string | null
}

// ── Role config ───────────────────────────────────────────────────────────────

const BASE_ROLES: UnifiedRole[] = [
  { value: 'admin',      label: 'Admin',      desc: 'Acceso completo al panel',                        icon: Crown,         colorClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',   isCustom: false },
  { value: 'supervisor', label: 'Supervisor', desc: 'Panel completo excepto configuración',            icon: ShieldCheck,   colorClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',         isCustom: false },
  { value: 'garzon',     label: 'Garzón',     desc: 'Pedidos, mesas y comandas',                       icon: UserCheck,     colorClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', isCustom: false },
  { value: 'cocina',     label: 'Cocina',     desc: 'Solo panel de comandas (kitchen display)',        icon: ChefHat,       colorClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',      isCustom: false },
  { value: 'anfitrion',  label: 'Anfitrión',  desc: 'Mesas, pedidos y tiempos de espera',              icon: UtensilsCrossed, colorClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',          isCustom: false },
]

// Build a UnifiedRole from a CustomRole fetched from /api/restaurants/custom-roles
function customToUnified(c: CustomRole): UnifiedRole {
  return {
    value:       c.id,
    label:       c.name,
    desc:        c.description ?? `${c.permissions.length} permisos · basado en ${c.base_role ?? 'rol libre'}`,
    icon:        Shield,
    colorClass:  'bg-white/8 text-white/80 border-white/20',
    isCustom:    true,
    customColor: c.color,
  }
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propietario', admin: 'Admin', supervisor: 'Supervisor',
  garzon: 'Garzón', waiter: 'Garzón', cocina: 'Cocina',
  anfitrion: 'Anfitrión', super_admin: 'Super Admin',
}

const ROLE_COLOR: Record<string, string> = {
  owner:      'bg-[#FF6B35]/15 text-[#FF6B35] border-[#FF6B35]/30',
  admin:      'bg-purple-500/15 text-purple-300 border-purple-500/30',
  supervisor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  garzon:     'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  waiter:     'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cocina:     'bg-amber-500/15 text-amber-300 border-amber-500/30',
  anfitrion:  'bg-sky-500/15 text-sky-300 border-sky-500/30',
}

function initials(text: string | null | undefined) {
  if (!text) return '?'
  const parts = text.split(/[@.\s]+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '')
}

function displayName(m: TeamMember) {
  if (m.full_name) return m.full_name
  if (!m.invited_email) return 'Usuario'
  return m.invited_email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getMemberRoles(m: TeamMember): string[] {
  if (m.roles && m.roles.length > 0) return m.roles
  return [m.role]
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EquipoPage() {
  const supabase               = createClient()
  const { restaurant, profile } = useRestaurant()

  const [members,    setMembers]    = useState<TeamMember[]>([])
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [sending,    setSending]    = useState(false)
  const [feedback,   setFeedback]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  // Link manual cuando el email no pudo enviarse (Resend no configurado).
  // El admin copia y lo manda por WhatsApp/Telegram al invitado.
  const [manualLink, setManualLink] = useState<{ url: string; email: string } | null>(null)
  const [editingRoles, setEditingRoles] = useState<string | null>(null)
  const [editRolesValue, setEditRolesValue] = useState<string[]>([])
  const [showRolesModal, setShowRolesModal] = useState(false)

  // Merged base + custom roles, used by all 3 render points (grid, editor, invite)
  const ALL_ROLES: UnifiedRole[] = [...BASE_ROLES, ...customRoles.map(customToUnified)]
  const ROLE_MAP = new Map(ALL_ROLES.map(r => [r.value, r]))

  // Form state
  const [email,    setEmail]    = useState('')
  const [fullName, setFullName] = useState('')
  const [phone,    setPhone]    = useState('')
  const [formRoles, setFormRoles] = useState<string[]>(['garzon'])

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!restaurant?.id) return
    setLoading(true)

    // Attempt to load with roles[] + full_name + phone (may not exist in older schemas)
    let data: TeamMember[] | null = null
    const withExtended = await supabase
      .from('team_members')
      .select('id, user_id, invited_email, role, roles, status, active, joined_at, full_name, phone')
      .eq('restaurant_id', restaurant.id)
      .neq('status', 'revoked')
      .order('joined_at', { ascending: false })

    if (!withExtended.error) {
      data = withExtended.data as TeamMember[]
    } else {
      const midway = await supabase
        .from('team_members')
        .select('id, user_id, invited_email, role, roles, status, active, joined_at')
        .eq('restaurant_id', restaurant.id)
        .neq('status', 'revoked')
        .order('joined_at', { ascending: false })
      if (!midway.error) {
        data = midway.data as TeamMember[]
      } else {
        const fallback = await supabase
          .from('team_members')
          .select('id, user_id, invited_email, role, status, joined_at')
          .eq('restaurant_id', restaurant.id)
          .neq('status', 'revoked')
          .order('joined_at', { ascending: false })
        data = (fallback.data ?? []) as TeamMember[]
      }
    }

    // Fetch custom roles in parallel (silent if endpoint missing / DB doesn't have table yet)
    try {
      const r = await fetch(`/api/restaurants/custom-roles?restaurant_id=${restaurant.id}`)
      if (r.ok) {
        const j = await r.json()
        setCustomRoles(j.roles ?? [])
      } else {
        setCustomRoles([])
      }
    } catch {
      setCustomRoles([])
    }

    setMembers(data ?? [])
    setLoading(false)
  }, [supabase, restaurant?.id])

  useEffect(() => { load() }, [load])

  // ── Invite ────────────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant?.id || !email || formRoles.length === 0) return

    setSending(true)
    setFeedback(null)

    const res  = await fetch('/api/team/invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        email,
        full_name:     fullName.trim() || undefined,
        phone:         phone.trim() || undefined,
        role:          formRoles[0],
        roles:         formRoles,
        restaurant_id: restaurant.id,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setFeedback({ type: 'err', msg: data.error ?? 'Error al enviar invitación' })
    } else {
      // Si el backend nos devuelve needs_manual_share=true (el email no pudo
      // enviarse por Resend), guardamos el action_link para que el admin lo
      // copie y lo comparta por otro canal (WhatsApp, etc.). Si el email sí
      // salió, mensaje normal.
      if (data.needs_manual_share && data.action_link && !data.existing_user) {
        setManualLink({ url: data.action_link as string, email })
        setFeedback(null)
      } else {
        setFeedback({
          type: 'ok',
          msg: data.existing_user
            ? `${email} ya tenía cuenta y fue agregado al equipo.`
            : `Invitación enviada a ${email}. Recibirá un correo para acceder.`,
        })
      }
      setEmail('')
      setFullName('')
      setPhone('')
      setFormRoles(['garzon'])
      setShowForm(false)
      await load()
    }
    setSending(false)
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  async function handleRevoke(id: string) {
    await supabase.from('team_members').update({ status: 'revoked', active: false }).eq('id', id)
    await load()
  }

  // ── Update roles inline ───────────────────────────────────────────────────

  async function saveRolesForMember(id: string) {
    if (editRolesValue.length === 0) return
    await supabase
      .from('team_members')
      .update({
        role: editRolesValue[0],
        roles: editRolesValue,
      })
      .eq('id', id)
    setEditingRoles(null)
    setEditRolesValue([])
    await load()
  }

  function toggleFormRole(role: string) {
    setFormRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
  }

  function toggleEditRole(role: string) {
    setEditRolesValue(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const active  = members.filter(m => m.status === 'active')
  const pending = members.filter(m => m.status === 'pending')

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Equipo</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Invita a tu equipo y asigna accesos según su rol
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowRolesModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/12 hover:bg-white/5 text-white/80 hover:text-white text-sm font-medium transition-colors"
            title="Crear y administrar roles personalizados"
          >
            <Plus size={14} /> Rol
          </button>
          <button
            onClick={() => { setShowForm(true); setFeedback(null) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold transition-colors"
          >
            <Plus size={14} /> Invitar persona
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-start gap-3 p-4 rounded-2xl border text-sm ${
          feedback.type === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {feedback.type === 'ok' ? <Check size={16} className="shrink-0 mt-0.5" /> : <X size={16} className="shrink-0 mt-0.5" />}
          <p>{feedback.msg}</p>
        </div>
      )}

      {/* Manual share link: cuando Resend no esta configurado, el admin
          debe copiar este link y mandarlo por WhatsApp al invitado. */}
      {manualLink && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-amber-200 text-sm font-semibold">
                Servicio de email no configurado
              </p>
              <p className="text-amber-100/70 text-xs mt-0.5">
                No pudimos mandar automáticamente el email a <strong>{manualLink.email}</strong>.
                Copiá el link y enviáselo por WhatsApp, Telegram o el canal que uses. El link es válido por 7 días.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/40 rounded-xl px-3 py-2 font-mono text-xs">
            <span className="flex-1 text-white/90 break-all">{manualLink.url}</span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(manualLink.url)
                setFeedback({ type: 'ok', msg: 'Link copiado al portapapeles' })
                setTimeout(() => setFeedback(null), 2500)
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#e55a2b] transition-colors"
            >
              Copiar
            </button>
          </div>
          <button
            onClick={() => setManualLink(null)}
            className="text-amber-200/50 text-xs hover:text-amber-200 underline"
          >
            Ya lo mandé, cerrar
          </button>
        </div>
      )}

      {/* Roles disponibles */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <ShieldCheck size={14} className="text-white/40" />
          <span className="text-white text-sm font-medium">Roles disponibles</span>
          <span className="text-white/20 text-[10px]">— Asigna estos roles a cada miembro del equipo</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ALL_ROLES.map(({ value, label, desc, icon: Icon, colorClass, isCustom, customColor }) => {
            const bg   = colorClass.split(' ')[0]   // bg-*/15
            const text = colorClass.split(' ')[1]   // text-*
            const brdr = colorClass.split(' ')[2]   // border-*/30
            return (
              <div key={value} className="bg-white/3 border border-white/8 rounded-xl p-3 flex gap-2.5 relative">
                {isCustom && (
                  <span className="absolute top-1.5 right-2 text-[8px] uppercase tracking-wide text-white/30">custom</span>
                )}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isCustom ? '' : `${bg} border ${brdr}`}`}
                  style={isCustom && customColor ? { backgroundColor: `${customColor}26`, border: `1px solid ${customColor}66` } : undefined}
                >
                  <Icon size={13} className={isCustom ? '' : text} />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{label}</p>
                  <p className="text-white/35 text-[10px] leading-tight mt-0.5">{desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active members */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Users size={14} className="text-white/40" />
          <span className="text-white text-sm font-medium">Miembros activos</span>
          <span className="ml-auto text-white/30 text-xs">{active.length}</span>
        </div>
        {loading ? (
          <div className="py-10 text-center text-white/30 text-sm bg-white/3 rounded-2xl border border-white/8">
            <RefreshCw size={16} className="animate-spin mx-auto mb-2" />Cargando...
          </div>
        ) : active.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin miembros aún"
            description="Invita a tu equipo por correo y aparecerán acá una vez activados"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {active.map(m => {
              const isSelf = m.user_id === profile?.id
              const isActive = m.active !== false
              const memberRoles = getMemberRoles(m)
              const editing = editingRoles === m.id
              return (
                <div
                  key={m.id}
                  className="relative bg-white/4 border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-colors"
                >
                  {/* Status dot */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-white/30'}`} />
                    <span className={`text-[9px] font-semibold uppercase tracking-wide ${isActive ? 'text-emerald-400/80' : 'text-white/30'}`}>
                      {isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* Header row: avatar + name + email */}
                  <div className="flex items-start gap-3 pr-16">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B35]/30 to-purple-500/20 border border-white/10 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initials(displayName(m))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{displayName(m)}</p>
                      <p className="text-white/40 text-[11px] truncate flex items-center gap-1">
                        <Mail size={9} /> {m.invited_email ?? '—'}
                      </p>
                      {isSelf && (
                        <span className="text-[9px] text-[#FF6B35] font-semibold uppercase tracking-wide">Tú</span>
                      )}
                    </div>
                  </div>

                  {/* Roles */}
                  <div className="mt-3 pt-3 border-t border-white/5">
                    {editing ? (
                      <div className="space-y-2">
                        <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wide">Editar roles</p>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_ROLES.map(r => {
                            const on = editRolesValue.includes(r.value)
                            const style = on && r.isCustom && r.customColor
                              ? { backgroundColor: `${r.customColor}26`, borderColor: `${r.customColor}80`, color: r.customColor }
                              : undefined
                            return (
                              <button
                                key={r.value}
                                onClick={() => toggleEditRole(r.value)}
                                style={style}
                                className={`text-[10px] px-2 py-1 rounded-full border transition-colors
                                  ${on && !r.isCustom ? r.colorClass : 'bg-white/3 border-white/10 text-white/40 hover:border-white/25'}`}
                              >
                                {r.label}{r.isCustom ? ' ✦' : ''}
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => saveRolesForMember(m.id)}
                            disabled={editRolesValue.length === 0}
                            className="flex-1 py-1.5 rounded-lg bg-[#FF6B35]/90 text-white text-[10px] font-semibold hover:bg-[#FF6B35] disabled:opacity-40 transition-colors"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => { setEditingRoles(null); setEditRolesValue([]) }}
                            className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-[10px] hover:border-white/25 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {memberRoles.map(r => {
                          const u = ROLE_MAP.get(r)
                          const style = u?.isCustom && u.customColor
                            ? { backgroundColor: `${u.customColor}26`, borderColor: `${u.customColor}80`, color: u.customColor }
                            : undefined
                          return (
                            <span
                              key={r}
                              style={style}
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                u?.isCustom
                                  ? ''
                                  : (ROLE_COLOR[r] ?? 'bg-white/10 text-white/50 border-white/10')
                              }`}
                            >
                              {u?.label ?? ROLE_LABEL[r] ?? r}
                            </span>
                          )
                        })}
                        {!isSelf && (
                          <button
                            onClick={() => {
                              setEditingRoles(m.id)
                              setEditRolesValue(memberRoles)
                            }}
                            className="text-white/30 hover:text-white/70 text-[10px] underline underline-offset-2 ml-auto"
                          >
                            editar
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Delete button */}
                  {!isSelf && !editing && (
                    <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
                      <button
                        onClick={() => handleRevoke(m.id)}
                        className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border border-white/10 text-white/40 hover:border-red-500/40 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={10} /> Eliminar del equipo
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {pending.length > 0 && (
        <div className="bg-white/5 rounded-2xl border border-amber-500/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
            <Mail size={14} className="text-amber-400" />
            <span className="text-white text-sm font-medium">Invitaciones pendientes</span>
            <span className="ml-auto text-amber-400 text-xs">{pending.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {pending.map(m => {
              const memberRoles = getMemberRoles(m)
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Mail size={13} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{m.invited_email}</p>
                    <p className="text-amber-400/60 text-[11px]">Esperando que acepte la invitación</p>
                  </div>
                  <div className="flex gap-1">
                    {memberRoles.map(r => {
                      const u = ROLE_MAP.get(r)
                      const style = u?.isCustom && u.customColor
                        ? { backgroundColor: `${u.customColor}26`, borderColor: `${u.customColor}80`, color: u.customColor }
                        : undefined
                      return (
                        <span
                          key={r}
                          style={style}
                          className={`text-[11px] px-2 py-0.5 rounded-full border ${
                            u?.isCustom
                              ? ''
                              : (ROLE_COLOR[r] ?? 'bg-white/10 text-white/50 border-white/10')
                          }`}
                        >
                          {u?.label ?? ROLE_LABEL[r] ?? r}
                        </span>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => handleRevoke(m.id)}
                    title="Cancelar invitación"
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/25 hover:text-red-400 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A2E] rounded-2xl border border-white/12 p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">Invitar al equipo</h3>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">Nombre y apellido</label>
                <input
                  type="text" value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="María González"
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50"
                />
                <p className="text-white/25 text-[10px] mt-1">Se mostrará en turnos y equipo (recomendado)</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Email</label>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nombre@email.com"
                    className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50"
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Teléfono (opcional)</label>
                  <input
                    type="tel" value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+569 1234 5678"
                    className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-white/50 text-xs">Roles (puedes elegir varios)</label>
                  <span className="text-white/30 text-[10px]">{formRoles.length} seleccionado{formRoles.length === 1 ? '' : 's'}</span>
                </div>
                <div className="space-y-2">
                  {ALL_ROLES.map(({ value, label, desc, icon: Icon, colorClass, isCustom, customColor }) => {
                    const checked = formRoles.includes(value)
                    const bg   = colorClass.split(' ')[0]
                    const text = colorClass.split(' ')[1]
                    const brdr = colorClass.split(' ')[2]
                    return (
                      <label key={value}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'border-[#FF6B35]/50 bg-[#FF6B35]/10'
                            : 'border-white/8 hover:border-white/20 bg-white/3'
                        }`}>
                        <input
                          type="checkbox" name="roles" value={value} checked={checked}
                          onChange={() => toggleFormRole(value)}
                          className="hidden"
                        />
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isCustom ? '' : `${bg} border ${brdr}`}`}
                          style={isCustom && customColor ? { backgroundColor: `${customColor}26`, border: `1px solid ${customColor}66` } : undefined}
                        >
                          <Icon size={13} className={isCustom ? '' : text} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium">
                            {label}{isCustom ? ' ✦' : ''}
                          </p>
                          <p className="text-white/35 text-[10px]">{desc}</p>
                        </div>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                          ${checked ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-white/20'}`}>
                          {checked && <Check size={10} className="text-white" />}
                        </div>
                      </label>
                    )
                  })}
                </div>
                <p className="text-white/25 text-[10px] mt-2 leading-relaxed">
                  💡 Ejemplos comunes: <strong>Garzón + Anfitrión</strong>, <strong>Admin + Cocina</strong>.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/12 text-white/60 text-sm hover:bg-white/5 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={sending || !email || formRoles.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  {sending ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                  {sending ? 'Enviando...' : 'Enviar invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roles manager modal */}
      {showRolesModal && restaurant?.id && (
        <RolesManagerModal
          restaurantId={restaurant.id}
          onClose={() => {
            setShowRolesModal(false)
            // Refresh custom roles so they appear in all 3 places immediately
            void load()
          }}
        />
      )}
    </div>
  )
}
