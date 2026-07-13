'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Star, Trash2, Pencil, MapPin } from 'lucide-react'
import type { CustomerProfile, SavedAddress } from '@/lib/customer/types'
export default function CuentaPerfilPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addrLabel, setAddrLabel] = useState('')
  const [addrStreet, setAddrStreet] = useState('')
  const [addrCity, setAddrCity] = useState('')
  const [addrNotes, setAddrNotes] = useState('')
  const [addrDefault, setAddrDefault] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, aRes] = await Promise.all([
        fetch('/api/customer/profile'),
        fetch('/api/customer/addresses'),
      ])
      const pData = await pRes.json()
      const aData = await aRes.json()
      if (pRes.ok && pData) {
        setProfile(pData)
        setDisplayName(pData.display_name ?? '')
        setPhone(pData.phone ?? '')
        setPhotoUrl(pData.photo_url ?? '')
      }
      setAddresses(Array.isArray(aData) ? aData : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          phone: phone.trim() || undefined,
          photo_url: photoUrl.trim() || undefined,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setProfile(updated)
        flash('Perfil actualizado')
      } else {
        const err = await res.json()
        flash(err.error ?? 'Error al guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  function resetAddressForm() {
    setShowAddressForm(false)
    setEditingId(null)
    setAddrLabel('')
    setAddrStreet('')
    setAddrCity('')
    setAddrNotes('')
    setAddrDefault(false)
  }

  function startEdit(addr: SavedAddress) {
    setEditingId(addr.id)
    setAddrLabel(addr.label)
    setAddrStreet(addr.street)
    setAddrCity(addr.city)
    setAddrNotes(addr.notes ?? '')
    setAddrDefault(addr.is_default)
    setShowAddressForm(true)
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault()
    const body = {
      label: addrLabel.trim(),
      street: addrStreet.trim(),
      city: addrCity.trim(),
      notes: addrNotes.trim() || undefined,
      is_default: addrDefault,
    }
    const url = editingId ? `/api/customer/addresses/${editingId}` : '/api/customer/addresses'
    const method = editingId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      resetAddressForm()
      await load()
      flash(editingId ? 'Dirección actualizada' : 'Dirección guardada')
    } else {
      const err = await res.json()
      flash(err.error ?? 'Error al guardar dirección')
    }
  }

  async function deleteAddress(id: string) {
    if (!confirm('¿Eliminar esta dirección?')) return
    const res = await fetch(`/api/customer/addresses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await load()
      flash('Dirección eliminada')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-[#E55A2B]" size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 px-4 py-2 rounded-xl text-sm">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Perfil</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Tu información y direcciones de entrega</p>
      </div>

      {profile && (
        <div className="flex items-center gap-3 bg-[#FF6B35]/10 border border-[#FF6B35]/25 rounded-2xl px-4 py-3">
          <Star size={18} className="text-[#E55A2B] fill-[#FF6B35]" />
          <div>
            <p className="text-[var(--text-muted)] text-xs">Puntos de fidelidad</p>
            <p className="text-[#E55A2B] font-bold text-lg">{profile.loyalty_points} pts</p>
          </div>
        </div>
      )}

      <form onSubmit={saveProfile} className="bg-white/[0.03] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-4">
        <h2 className="text-[var(--text-strong)] font-semibold text-sm">Datos personales</h2>
        <label className="block">
          <span className="text-[var(--text-muted)] text-xs mb-1 block">Nombre</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]/40"
          />
        </label>
        <label className="block">
          <span className="text-[var(--text-muted)] text-xs mb-1 block">Teléfono</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+56 9 …"
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]/40"
          />
        </label>
        <label className="block">
          <span className="text-[var(--text-muted)] text-xs mb-1 block">URL foto de perfil</span>
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            type="url"
            placeholder="https://…"
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]/40"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Guardar perfil
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[var(--text-strong)] font-semibold text-sm flex items-center gap-2">
            <MapPin size={16} className="text-[#E55A2B]" />
            Direcciones guardadas
          </h2>
          {!showAddressForm && addresses.length < 10 && (
            <button
              type="button"
              onClick={() => { resetAddressForm(); setShowAddressForm(true) }}
              className="flex items-center gap-1 text-xs text-[#E55A2B] font-medium"
            >
              <Plus size={14} /> Agregar
            </button>
          )}
        </div>

        {showAddressForm && (
          <form onSubmit={saveAddress} className="bg-white/[0.03] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
            <input
              value={addrLabel}
              onChange={(e) => setAddrLabel(e.target.value)}
              placeholder="Etiqueta (Casa, Trabajo…)"
              required
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm"
            />
            <input
              value={addrStreet}
              onChange={(e) => setAddrStreet(e.target.value)}
              placeholder="Calle y número"
              required
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm"
            />
            <input
              value={addrCity}
              onChange={(e) => setAddrCity(e.target.value)}
              placeholder="Ciudad"
              required
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm"
            />
            <input
              value={addrNotes}
              onChange={(e) => setAddrNotes(e.target.value)}
              placeholder="Notas (depto, timbre…)"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={addrDefault}
                onChange={(e) => setAddrDefault(e.target.checked)}
              />
              Dirección predeterminada
            </label>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 rounded-lg bg-[#FF6B35] text-white text-sm font-semibold">
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
              <button type="button" onClick={resetAddressForm} className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {addresses.length === 0 && !showAddressForm ? (
          <p className="text-[var(--text-muted)] text-sm italic">No tienes direcciones guardadas.</p>
        ) : (
          <ul className="space-y-2">
            {addresses.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 bg-white/[0.02] border border-[var(--border-subtle)] rounded-xl px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--text-strong)] font-medium text-sm">
                    {a.label}
                    {a.is_default && (
                      <span className="ml-2 text-[10px] text-[#E55A2B] font-semibold uppercase">Default</span>
                    )}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs mt-0.5">{a.street}, {a.city}</p>
                  {a.notes && <p className="text-[var(--text-muted)] text-xs mt-1">{a.notes}</p>}
                </div>
                <button type="button" onClick={() => startEdit(a)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => deleteAddress(a.id)} className="p-1.5 text-red-700/70 hover:text-red-700">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
