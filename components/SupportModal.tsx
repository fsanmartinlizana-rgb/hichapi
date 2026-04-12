'use client'

import { useState } from 'react'
import { X, Loader2, AlertCircle, CheckCircle, Send } from 'lucide-react'

interface SupportModalProps {
  open: boolean
  onClose: () => void
  restaurantId?: string
  userId?: string
}

const SEVERITY_OPTIONS = [
  { value: 'low',      label: 'Bajo',     desc: 'Sugerencia o mejora', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { value: 'medium',   label: 'Medio',    desc: 'Algo no funciona bien', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  { value: 'critical', label: 'Crítico',  desc: 'No puedo operar', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
]

export default function SupportModal({ open, onClose, restaurantId, userId }: SupportModalProps) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('low')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) return
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          severity,
          restaurant_id: restaurantId,
          user_id: userId,
          page_url: window.location.href,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al enviar')
        setSubmitting(false)
        return
      }

      setSubmitted(true)
      setTimeout(() => {
        onClose()
        setSubject('')
        setDescription('')
        setSeverity('low')
        setSubmitted(false)
      }, 2500)
    } catch {
      setError('Error de conexión')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#161622] rounded-2xl border border-white/10 w-full max-w-lg p-6 space-y-5 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-white/30 hover:text-white/60 transition-colors"
        >
          <X size={16} />
        </button>

        {submitted ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle size={40} className="text-emerald-400 mx-auto" />
            <p className="text-white font-semibold">Ticket creado</p>
            <p className="text-white/40 text-sm">Analizaremos tu reporte y te responderemos pronto.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-white font-bold text-lg">Reportar problema</h2>
              <p className="text-white/40 text-sm">Describe el problema y lo resolveremos lo antes posible.</p>
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <label className="text-white/50 text-xs font-medium">Severidad</label>
              <div className="grid grid-cols-3 gap-2">
                {SEVERITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSeverity(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      severity === opt.value
                        ? opt.color + ' border-current'
                        : 'bg-white/3 border-white/8 text-white/40 hover:bg-white/5'
                    }`}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-[10px] opacity-60 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5">Asunto *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Ej: No puedo crear comandas"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5">Descripción *</label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe qué pasó, en qué página, y qué esperabas que ocurriera..."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 resize-none focus:outline-none focus:border-[#FF6B35]/50"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !subject.trim() || !description.trim()}
              className="w-full py-3 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Enviar reporte
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
