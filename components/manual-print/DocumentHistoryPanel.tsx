'use client'

import { Clock, RefreshCw } from 'lucide-react'
import {
  formatDocumentType,
  formatDocumentStatus,
  getDocumentTypeIcon,
  getTimeElapsed,
} from '@/lib/manual-print/document-history'
import type { DocumentRequest } from '@/lib/manual-print/types'

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DocumentRequest['status'] }) {
  const { label, color, icon } = formatDocumentStatus(status)

  const bgMap: Record<DocumentRequest['status'], string> = {
    pending:   'bg-yellow-500/15 border-yellow-500/30',
    completed: 'bg-emerald-500/15 border-emerald-500/30',
    failed:    'bg-red-500/15 border-red-500/30',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${bgMap[status]}`}
      style={{ color }}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  )
}

// ── DocumentHistoryItem ───────────────────────────────────────────────────────

function DocumentHistoryItem({ request }: { request: DocumentRequest }) {
  const icon = getDocumentTypeIcon(request.type)
  const label = formatDocumentType(request.type)
  const elapsed = getTimeElapsed(request.timestamp)

  const timeStr = request.timestamp.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className="flex items-start gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Document type icon */}
      <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden="true">
        {icon}
      </span>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold text-white/80">{label}</p>
          <StatusBadge status={request.status} />
        </div>

        {/* Timestamp row */}
        <div className="flex items-center gap-1 mt-1">
          <Clock size={9} className="text-white/25 shrink-0" />
          <p className="text-[10px] text-white/35">
            {timeStr} · {elapsed}
          </p>
        </div>

        {/* Email metadata */}
        {request.metadata?.email && (
          <p className="text-[10px] text-white/40 mt-0.5 truncate">
            📧 {request.metadata.email}
          </p>
        )}

        {/* Error message */}
        {request.status === 'failed' && request.error && (
          <p className="text-[10px] text-red-400/70 mt-0.5 leading-snug">
            {request.error}
          </p>
        )}
      </div>
    </div>
  )
}

// ── DocumentHistoryPanel ──────────────────────────────────────────────────────

export interface DocumentHistoryPanelProps {
  /** List of document requests to display */
  history: DocumentRequest[]
  /** Whether history is currently loading */
  loading?: boolean
  /** Optional callback to refresh history */
  onRefresh?: () => void
}

/**
 * DocumentHistoryPanel
 *
 * Shows a list of document requests for the current mesa with their types,
 * timestamps, and status badges. Satisfies Req 6.2 (method + status for boleta)
 * and Req 6.3 (history panel with all requested documents).
 *
 * Requirements: 6.2, 6.3
 */
export function DocumentHistoryPanel({
  history,
  loading = false,
  onRefresh,
}: DocumentHistoryPanelProps) {
  // Don't render if there's nothing to show and we're not loading
  if (!loading && history.length === 0) return null

  return (
    <div
      className="px-4 py-3 border-t"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
          Historial de documentos
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            aria-label="Actualizar historial"
            className={[
              // Min 44×44 touch target (Req 9.1)
              'min-h-[44px] min-w-[44px] flex items-center justify-center',
              'rounded-lg text-white/20',
              'transition-all duration-200',
              loading
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:text-white/50 active:scale-[0.90]',
            ].join(' ')}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && history.length === 0 && (
        <div className="space-y-2 py-1">
          {[1, 2].map(i => (
            <div
              key={i}
              className="h-10 rounded-lg bg-white/5 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Document list */}
      {history.length > 0 && (
        <div>
          {history.map(request => (
            <DocumentHistoryItem key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  )
}
