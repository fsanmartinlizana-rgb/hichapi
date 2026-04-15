'use client'

/**
 * RolesManagerModal — manager de roles custom (in-place en /equipo).
 * Permite crear, editar y eliminar roles con permisos granulares.
 *
 * Uso:
 *   <RolesManagerModal
 *     restaurantId={restaurant.id}
 *     onClose={() => setOpen(false)}
 *   />
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Trash2, Shield, RefreshCw, X, Check, Save, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react'
import { PERMISSIONS, BASE_ROLE_PRESETS, permissionsByModule } from '@/lib/permissions'

export interface CustomRole {
  id: string
  name: string
  description: string | null
  permissions: string[]
  base_role: string | null
  color: string
}

const BASE_ROLES = ['owner','admin','supervisor','garzon','cocina','anfitrion'] as const
const SWATCHES = ['#FF6B35','#34D399','#FBBF24','#60A5FA','#A78BFA','#F472B6','#F87171','#14B8A6','#6B7280']

interface Props {
  restaurantId: string
  onClose: () => void
}

export function RolesManagerModal({ restaurantId, onClose }: Props) {
  const [roles, setRoles]       = useState<CustomRole[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<CustomRole | null>(null)
  const [creating, setCreating] = useState(false)
  const [toast, setToast]       = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const r = await fetch(`/api/restaurants/custom-roles?restaurant_id=${restaurantId}`)
      const j = await r.json()
      if (r.ok) {
        setRoles(j.roles ?? [])
      } else {
        setErrorMsg(j.error ?? 'No se pudieron cargar los roles')
      }
    } catch {
      setErrorMsg('Sin conexión')
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function deleteRole(id: string) {
    if (!confirm('¿Eliminar este rol? Los miembros asignados quedarán sin rol custom.')) return
    const r = await fetch(`/api/restaurants/custom-roles?id=${id}&restaurant_id=${restaurantId}`, { method: 'DELETE' })
    if (r.ok) { load(); showToast('Rol eliminado') }
    else { showToast('No se pudo eliminar') }
  }

  const showingEditor = creating || editing !== null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#1C1C2E] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            {showingEditor && (
              <button
                onClick={() => { setCreating(false); setEditing(null) }}
                className="w-8 h-8 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 flex items-center justify-center shrink-0"
                title="Volver a la lista"
              >
                <ArrowLeft size={13} />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Shield size={14} className="text-[#FF6B35]" />
                {showingEditor ? (editing ? 'Editar rol' : 'Nuevo rol') : 'Roles personalizados'}
              </h3>
              <p className="text-white/40 text-xs mt-0.5 truncate">
                {showingEditor
                  ? 'Asigna permisos granulares a este rol'
                  : 'Crea roles a tu medida (ej. Cajero, Sommelier, Bartender)'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/25 flex items-center justify-center shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        {!showingEditor ? (
          <div className="p-5 overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw size={18} className="text-white/40 animate-spin" />
              </div>
            ) : errorMsg ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
                <p className="text-red-300 text-sm font-semibold">No se pudieron cargar los roles</p>
                <p className="text-white/50 text-xs">{errorMsg}</p>
                <p className="text-white/40 text-[11px]">
                  Si acabas de actualizar, aplica primero la migración <code className="text-[#FF6B35]">20260414_043_custom_roles.sql</code> en Supabase.
                </p>
              </div>
            ) : roles.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
                  <Shield size={22} className="text-white/30" />
                </div>
                <p className="text-white/80 text-sm font-semibold">Aún no tienes roles personalizados</p>
                <p className="text-white/40 text-xs max-w-sm mx-auto">
                  Los roles custom te permiten dar acceso específico a cada miembro del equipo.
                </p>
                <button
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#e55a2b] transition-colors"
                >
                  <Plus size={13} /> Crear primer rol
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {roles.map(r => (
                  <div
                    key={r.id}
                    className="bg-white/3 border border-white/8 rounded-xl p-4 hover:border-white/15 transition-colors cursor-pointer"
                    onClick={() => setEditing(r)}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${r.color}22`, border: `1px solid ${r.color}55` }}
                      >
                        <Shield size={16} style={{ color: r.color }} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold text-sm truncate">{r.name}</h3>
                          {r.base_role && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 uppercase">base: {r.base_role}</span>
                          )}
                        </div>
                        {r.description && <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{r.description}</p>}
                        <p className="text-white/30 text-[11px] mt-2">
                          {r.permissions.length} permiso{r.permissions.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteRole(r.id) }}
                        className="text-white/25 hover:text-red-400 hover:bg-red-500/10 w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <RoleEditor
            restaurantId={restaurantId}
            role={editing}
            onBack={() => { setCreating(false); setEditing(null) }}
            onSaved={() => {
              load()
              setCreating(false)
              setEditing(null)
              showToast('Rol guardado')
            }}
          />
        )}

        {/* Footer action (only in list mode) */}
        {!showingEditor && !loading && !errorMsg && (
          <div className="flex items-center justify-between gap-2 p-4 border-t border-white/5 shrink-0">
            <p className="text-white/30 text-[11px]">
              {roles.length} rol{roles.length === 1 ? '' : 'es'} configurado{roles.length === 1 ? '' : 's'}
            </p>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#e55a2b] transition-colors"
            >
              <Plus size={13} /> Nuevo rol
            </button>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-sm px-4 py-2 rounded-xl z-[60]">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Editor (inline, reutiliza espacio del modal) ─────────────────────────────

function RoleEditor({
  restaurantId,
  role,
  onBack,
  onSaved,
}: {
  restaurantId: string
  role: CustomRole | null
  onBack: () => void
  onSaved: () => void
}) {
  const [name, setName]           = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? [])
  const [baseRole, setBaseRole]   = useState<string | ''>(role?.base_role ?? '')
  const [color, setColor]         = useState(role?.color ?? '#FF6B35')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [openModules, setOpenModules] = useState<Set<string>>(() => new Set(Object.keys(permissionsByModule())))

  const grouped = useMemo(() => permissionsByModule(), [])

  function togglePerm(key: string) {
    setPermissions(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }

  function applyPreset(r: string) {
    setBaseRole(r)
    setPermissions(BASE_ROLE_PRESETS[r] ?? [])
  }

  function toggleAllInModule(mod: string, allSelected: boolean) {
    const keys = grouped[mod].map(p => p.key)
    setPermissions(prev => allSelected
      ? prev.filter(p => !keys.includes(p))
      : Array.from(new Set([...prev, ...keys]))
    )
  }

  function toggleModuleOpen(mod: string) {
    setOpenModules(prev => {
      const next = new Set(prev)
      if (next.has(mod)) next.delete(mod)
      else next.add(mod)
      return next
    })
  }

  async function save() {
    if (!name.trim()) { setError('Nombra el rol'); return }
    setSaving(true); setError('')
    const body = {
      restaurant_id: restaurantId,
      name:          name.trim(),
      description:   description.trim() || undefined,
      permissions,
      base_role:     baseRole || undefined,
      color,
    }
    try {
      const res = role
        ? await fetch('/api/restaurants/custom-roles', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: role.id, ...body }) })
        : await fetch('/api/restaurants/custom-roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = j.error ?? (res.status === 500
          ? 'Error del servidor. ¿Aplicaste la migración 043_custom_roles.sql?'
          : `Error ${res.status}`)
        setError(msg)
        return
      }
      onSaved()
    } catch {
      setError('Sin conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* Name + color */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">Nombre del rol *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Cajero, Sommelier, Bartender"
              maxLength={40}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">Color</label>
            <div className="flex items-center gap-1.5 flex-wrap w-36">
              {SWATCHES.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white' : 'border-white/20'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">Descripción</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ej. Gestiona pagos y cierre de turno, sin ver reportes"
            maxLength={200}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/40"
          />
        </div>

        {/* Preset */}
        <div className="space-y-1.5">
          <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">Partir desde un rol base (opcional)</label>
          <div className="flex gap-1.5 flex-wrap">
            {BASE_ROLES.map(r => (
              <button key={r} type="button" onClick={() => applyPreset(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors
                  ${baseRole === r ? 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]' : 'bg-white/3 border-white/8 text-white/50 hover:border-white/20'}`}>
                {r}
              </button>
            ))}
            {baseRole && (
              <button type="button" onClick={() => setBaseRole('')} className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70">
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Permissions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">
              Permisos · {permissions.length}/{PERMISSIONS.length}
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPermissions(PERMISSIONS.map(p => p.key))}
                className="text-[10px] text-white/40 hover:text-white/70">Todos</button>
              <button type="button" onClick={() => setPermissions([])}
                className="text-[10px] text-white/40 hover:text-white/70">Ninguno</button>
            </div>
          </div>
          {Object.entries(grouped).map(([mod, perms]) => {
            const selectedInModule = perms.filter(p => permissions.includes(p.key))
            const allSelected = selectedInModule.length === perms.length
            const isOpen = openModules.has(mod)
            return (
              <div key={mod} className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                <button type="button" onClick={() => toggleModuleOpen(mod)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/3 transition-colors">
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={13} className="text-white/40" /> : <ChevronRight size={13} className="text-white/40" />}
                    <span className="text-white text-sm font-semibold">{mod}</span>
                    <span className="text-white/40 text-[10px]">{selectedInModule.length}/{perms.length}</span>
                  </div>
                  <span
                    onClick={e => { e.stopPropagation(); toggleAllInModule(mod, allSelected) }}
                    className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer
                      ${allSelected ? 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]' : 'bg-white/3 border-white/10 text-white/50 hover:text-white'}`}>
                    {allSelected ? 'Quitar todos' : 'Todos'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 grid grid-cols-1 gap-1">
                    {perms.map(p => {
                      const on = permissions.includes(p.key)
                      return (
                        <label key={p.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/3 cursor-pointer">
                          <span
                            className={`w-4 h-4 rounded border transition-colors flex items-center justify-center
                              ${on ? 'bg-[#FF6B35] border-[#FF6B35]' : 'bg-white/3 border-white/15'}`}>
                            {on && <Check size={10} className="text-white" strokeWidth={3} />}
                          </span>
                          <input type="checkbox" checked={on} onChange={() => togglePerm(p.key)} className="sr-only" />
                          <span className="text-white/80 text-sm flex-1">{p.label}</span>
                          <span className="text-white/20 text-[10px] font-mono">{p.key}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 p-4 border-t border-white/5 shrink-0">
        <button onClick={onBack}
          className="px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:border-white/25 hover:text-white/80 transition-colors">
          Cancelar
        </button>
        <button onClick={save} disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {saving ? <><RefreshCw size={13} className="animate-spin" /> Guardando…</> : <><Save size={13} /> Guardar rol</>}
        </button>
      </div>
    </>
  )
}
