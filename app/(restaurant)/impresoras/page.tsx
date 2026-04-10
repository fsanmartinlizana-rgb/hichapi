'use client'

import { useEffect, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  Printer, Plus, Wifi, Usb, Cable, Loader2, Check, Clock, AlertCircle,
  Copy, X, Play,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface PrintServer {
  id:           string
  name:         string
  printer_kind: 'network' | 'usb' | 'serial'
  printer_addr: string | null
  paper_width:  number
  active:       boolean
  last_seen_at: string | null
  created_at:   string
}

interface PrintJob {
  id:            string
  job_type:      string
  status:        string
  created_at:    string
  printed_at:    string | null
  error_message: string | null
  print_servers: { name: string } | null
}

const KIND_ICONS = {
  network: Wifi,
  usb:     Usb,
  serial:  Cable,
}

const STATUS_TONE: Record<string, string> = {
  pending:   '#FBBF24',
  printing:  '#60A5FA',
  completed: '#34D399',
  failed:    '#F87171',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ImpresorasPage() {
  const { restaurant } = useRestaurant()
  const [servers, setServers] = useState<PrintServer[]>([])
  const [jobs,    setJobs]    = useState<PrintJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Add form
  const [showAdd,    setShowAdd]    = useState(false)
  const [newName,    setNewName]    = useState('')
  const [newKind,    setNewKind]    = useState<'network' | 'usb' | 'serial'>('network')
  const [newAddr,    setNewAddr]    = useState('')
  const [newWidth,   setNewWidth]   = useState('32')
  const [creating,   setCreating]   = useState(false)
  const [issuedToken, setIssuedToken] = useState<{ name: string; token: string } | null>(null)

  async function load() {
    if (!restaurant) return
    setLoading(true)
    try {
      const [srvRes, jobsRes] = await Promise.all([
        fetch(`/api/print/servers?restaurant_id=${restaurant.id}`).then(r => r.json()),
        fetch(`/api/print/jobs?restaurant_id=${restaurant.id}&limit=20`).then(r => r.json()),
      ])
      setServers(srvRes.servers ?? [])
      setJobs(jobsRes.jobs ?? [])
    } catch {
      setError('No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [restaurant])

  async function createServer() {
    if (!restaurant || !newName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/print/servers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          name:          newName.trim(),
          printer_kind:  newKind,
          printer_addr:  newAddr.trim() || null,
          paper_width:   parseInt(newWidth, 10) || 32,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo crear')
        return
      }
      setIssuedToken({ name: data.server.name, token: data.token })
      setShowAdd(false)
      setNewName(''); setNewAddr(''); setNewKind('network'); setNewWidth('32')
      await load()
    } finally {
      setCreating(false)
    }
  }

  async function sendTestJob(serverId: string) {
    if (!restaurant) return
    await fetch('/api/print/jobs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: restaurant.id,
        server_id:     serverId,
        job_type:      'test',
        payload: {
          header: 'HiChapi',
          footer: 'Prueba de impresion',
          copies: 1,
          lines: [
            { text: 'Test de impresora', align: 'center', bold: true,  size: 'large',  cut: false, feed: 1, divider: false },
            { text: '', align: 'left', bold: false, size: 'normal', cut: false, feed: 0, divider: true },
            { text: new Date().toLocaleString('es-CL'), align: 'center', bold: false, size: 'normal', cut: false, feed: 1, divider: false },
            { text: 'Si lees esto, todo OK!', align: 'center', bold: false, size: 'normal', cut: false, feed: 2, divider: false },
          ],
        },
      }),
    })
    void load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <Printer size={20} className="text-[#FF6B35]" />
            Impresoras
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            Servidores de impresión locales conectados via print-server
          </p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-xs font-semibold
                     hover:bg-[#e85d2a] transition-colors"
        >
          <Plus size={13} />
          Agregar impresora
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle size={14} className="text-red-300 shrink-0 mt-0.5" />
          <p className="text-red-200 text-xs">{error}</p>
        </div>
      )}

      {/* Issued token modal */}
      {issuedToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="bg-[#161622] border border-[#FF6B35]/40 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-bold text-sm">Token generado</p>
                <p className="text-white/40 text-xs mt-0.5">para “{issuedToken.name}”</p>
              </div>
              <button onClick={() => setIssuedToken(null)} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <p className="text-white/60 text-xs">
              Guarda este token en el archivo <span className="font-mono text-[#FF6B35]">.env</span> del print-server.
              No volverá a aparecer.
            </p>
            <div className="bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-[10px] text-emerald-300 break-all">
              {issuedToken.token}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(issuedToken.token)}
              className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs font-semibold
                         hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <Copy size={12} /> Copiar token
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
          <p className="text-white font-semibold text-sm">Nueva impresora</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Nombre</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Cocina, Caja, Barra…"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                           placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Tipo</label>
              <div className="flex gap-2">
                {(['network', 'usb', 'serial'] as const).map(k => {
                  const Icon = KIND_ICONS[k]
                  return (
                    <button
                      key={k}
                      onClick={() => setNewKind(k)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all
                        ${newKind === k
                          ? 'bg-[#FF6B35]/20 border-[#FF6B35]/40 text-[#FF6B35]'
                          : 'bg-white/3 border-white/8 text-white/30'}`}
                    >
                      <Icon size={11} />
                      {k}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">
                {newKind === 'network' ? 'IP:puerto (ej 192.168.1.50:9100)' : 'Device path (ej /dev/usb/lp0)'}
              </label>
              <input
                value={newAddr}
                onChange={e => setNewAddr(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                           placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Ancho de papel (caracteres)</label>
              <input
                type="number"
                value={newWidth}
                onChange={e => setNewWidth(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm
                           focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
              />
              <p className="text-white/20 text-[10px]">32 = papel 58mm · 48 = papel 80mm</p>
            </div>
          </div>
          <button
            onClick={createServer}
            disabled={creating || !newName.trim()}
            className="w-full py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold
                       hover:bg-[#e85d2a] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Crear y generar token
          </button>
        </div>
      )}

      {/* Servers list */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl">
        <div className="p-5 border-b border-white/5">
          <p className="text-white font-semibold text-sm">Servidores registrados</p>
        </div>
        {servers.length === 0 ? (
          <div className="p-10 text-center">
            <Printer size={28} className="text-white/15 mx-auto mb-2" />
            <p className="text-white/40 text-sm">Aún no tienes impresoras registradas</p>
            <p className="text-white/25 text-xs mt-1">Agrega una para empezar a imprimir</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {servers.map(srv => {
              const Icon  = KIND_ICONS[srv.printer_kind]
              const seen  = srv.last_seen_at ? new Date(srv.last_seen_at) : null
              const fresh = seen && Date.now() - seen.getTime() < 2 * 60_000
              return (
                <div key={srv.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/40">
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-semibold">{srv.name}</p>
                      <span
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          color: fresh ? '#34D399' : '#94A3B8',
                          backgroundColor: fresh ? '#10b9811a' : '#94a3b81a',
                          border: `1px solid ${fresh ? '#10b98140' : '#94a3b840'}`,
                        }}
                      >
                        {fresh ? <Check size={9} strokeWidth={3} /> : <Clock size={9} />}
                        {fresh ? 'Online' : seen ? 'Offline' : 'Sin conexión'}
                      </span>
                    </div>
                    <p className="text-white/30 text-[11px]">
                      {srv.printer_kind} · {srv.printer_addr ?? 'addr en .env'} · {srv.paper_width} cols
                    </p>
                  </div>
                  <button
                    onClick={() => sendTestJob(srv.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10
                               text-white/60 hover:text-[#FF6B35] hover:border-[#FF6B35]/40 transition-colors"
                  >
                    <Play size={11} /> Test
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent jobs */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl">
        <div className="p-5 border-b border-white/5">
          <p className="text-white font-semibold text-sm">Jobs recientes</p>
        </div>
        {jobs.length === 0 ? (
          <p className="p-10 text-center text-white/30 text-sm">Sin jobs aún</p>
        ) : (
          <div className="divide-y divide-white/5">
            {jobs.map(j => (
              <div key={j.id} className="px-5 py-3 flex items-center gap-3 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 font-medium">
                    {j.job_type}
                    {j.print_servers && <span className="text-white/30"> · {j.print_servers.name}</span>}
                  </p>
                  <p className="text-white/30 text-[10px]">
                    {new Date(j.created_at).toLocaleString('es-CL')}
                    {j.error_message && <span className="text-red-400"> — {j.error_message}</span>}
                  </p>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    color: STATUS_TONE[j.status] ?? '#94A3B8',
                    backgroundColor: `${STATUS_TONE[j.status] ?? '#94A3B8'}1a`,
                    border: `1px solid ${STATUS_TONE[j.status] ?? '#94A3B8'}40`,
                  }}
                >
                  {j.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
