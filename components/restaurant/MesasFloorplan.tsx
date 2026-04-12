'use client'

/**
 * MesasFloorplan — draggable floorplan canvas for /mesas.
 *
 * Renders mesa cards in a positioned canvas where each card can be dragged
 * around. Positions are persisted via PATCH /api/tables (bulk shape).
 *
 * UX rules:
 *   • Default state (editLayout = false):
 *       - Mesas are rendered at their saved (pos_x, pos_y).
 *       - Mesas with NULL position fall back to an auto-arranged grid so a
 *         brand-new restaurant doesn't see an empty plane.
 *       - Click/menu/QR all work as usual — drag is disabled.
 *   • Edit mode (editLayout = true):
 *       - A drag handle overlay appears on each card.
 *       - Pointer-down on the card body OR the handle starts a drag.
 *       - Position is updated optimistically while dragging.
 *       - On pointer-up, the new position is flushed via the bulk PATCH.
 *       - Underlying card actions (menus, QR) are disabled to avoid conflicts.
 *
 * Notes:
 *   • Only renders the children — does NOT own mesa state. The parent passes
 *     the same Mesa[] it already manages and a callback to update positions
 *     locally after a drag completes.
 *   • The canvas has a fixed min-height with a subtle grid background so the
 *     "drag me around" affordance is obvious.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Move, GripVertical } from 'lucide-react'

interface MesaPosLike {
  id: string
  posX?: number | null
  posY?: number | null
}

export interface FloorplanProps<M extends MesaPosLike> {
  mesas: M[]
  /** Auto-grid fallback for cards with no saved position */
  defaultColumns?: number
  /** Card width / height in pixels (used for auto-grid + collision-aware snap) */
  cardSize?: { w: number; h: number }
  /** Renders each mesa card */
  renderCard: (mesa: M) => React.ReactNode
  /** Whether dragging is enabled */
  editing: boolean
  /** Called after a drag completes (optimistic local update + persist) */
  onPositionsChange: (next: { id: string; pos_x: number; pos_y: number }[]) => void | Promise<void>
  /** Optional empty state when there are no mesas */
  emptyState?: React.ReactNode
}

const DEFAULT_CARD = { w: 168, h: 132 }
const GRID_GAP = 12
const PADDING = 16

export function MesasFloorplan<M extends MesaPosLike>({
  mesas,
  defaultColumns = 4,
  cardSize = DEFAULT_CARD,
  renderCard,
  editing,
  onPositionsChange,
  emptyState,
}: FloorplanProps<M>) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<null | {
    id: string
    startX: number
    startY: number
    originX: number
    originY: number
  }>(null)
  /**
   * Live overrides during a drag — keeps render fast without bouncing through
   * a parent setState on every pointer move.
   */
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>({})

  // ── Resolve coordinates for every mesa ────────────────────────────────────
  // Mesas with no saved position get an auto-arranged grid spot so the canvas
  // never looks empty for new restaurants.
  const resolved = useMemo(() => {
    let autoIndex = 0
    return mesas.map(m => {
      const override = overrides[m.id]
      if (override) return { mesa: m, x: override.x, y: override.y, isAuto: false }
      if (m.posX != null && m.posY != null) {
        return { mesa: m, x: m.posX, y: m.posY, isAuto: false }
      }
      // Auto grid
      const col = autoIndex % defaultColumns
      const row = Math.floor(autoIndex / defaultColumns)
      autoIndex++
      return {
        mesa: m,
        x: PADDING + col * (cardSize.w + GRID_GAP),
        y: PADDING + row * (cardSize.h + GRID_GAP),
        isAuto: true,
      }
    })
  }, [mesas, overrides, defaultColumns, cardSize.w, cardSize.h])

  // Canvas height = bottom-most card + padding
  const canvasHeight = useMemo(() => {
    if (resolved.length === 0) return 320
    const maxY = Math.max(...resolved.map(r => r.y + cardSize.h))
    return Math.max(420, maxY + PADDING * 2)
  }, [resolved, cardSize.h])

  // ── Drag handlers (pointer events: works for mouse + touch) ───────────────
  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (!editing) return
    e.preventDefault()
    e.stopPropagation()
    const current = resolved.find(r => r.mesa.id === id)
    if (!current) return
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    setDrag({
      id,
      startX: e.clientX,
      startY: e.clientY,
      originX: current.x,
      originY: current.y,
    })
  }, [editing, resolved])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    const canvas = canvasRef.current
    let nextX = drag.originX + dx
    let nextY = drag.originY + dy
    // Clamp inside canvas (avoid losing cards off-screen)
    if (canvas) {
      const maxX = canvas.clientWidth - cardSize.w - PADDING
      nextX = Math.max(PADDING, Math.min(maxX, nextX))
      nextY = Math.max(PADDING, nextY)
    }
    setOverrides(prev => ({ ...prev, [drag.id]: { x: nextX, y: nextY } }))
  }, [drag, cardSize.w])

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!drag) return
    const target = e.currentTarget as HTMLElement
    try { target.releasePointerCapture(e.pointerId) } catch { /* */ }
    const final = overrides[drag.id]
    setDrag(null)
    if (final) {
      // Persist this single move (parent can batch later if needed)
      await onPositionsChange([{ id: drag.id, pos_x: final.x, pos_y: final.y }])
      // Clear the override after a microtask so the parent has a chance to
      // re-emit `mesas` with the new posX/posY and the card doesn't snap back.
      setTimeout(() => {
        setOverrides(prev => {
          const next = { ...prev }
          delete next[drag.id]
          return next
        })
      }, 50)
    }
  }, [drag, overrides, onPositionsChange])

  // Cancel drag if the user navigates away
  useEffect(() => {
    if (!drag) return
    const onCancel = () => setDrag(null)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('blur', onCancel)
    return () => {
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('blur', onCancel)
    }
  }, [drag])

  if (mesas.length === 0 && emptyState) return <>{emptyState}</>

  return (
    <div
      ref={canvasRef}
      className={[
        'relative w-full rounded-2xl border transition-colors',
        editing
          ? 'border-[#FF6B35]/30 bg-[#FF6B35]/[0.02]'
          : 'border-white/5 bg-white/[0.015]',
      ].join(' ')}
      style={{
        height: canvasHeight,
        backgroundImage: editing
          ? 'radial-gradient(circle, rgba(255,107,53,0.08) 1px, transparent 1px)'
          : 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Edit-mode hint banner */}
      {editing && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF6B35]/15 border border-[#FF6B35]/30 text-[#FF6B35] text-[11px] font-semibold backdrop-blur-sm">
          <Move size={11} />
          Arrastra las mesas para reorganizarlas
        </div>
      )}

      {resolved.map(({ mesa, x, y, isAuto }) => {
        const isDragging = drag?.id === mesa.id
        return (
          <div
            key={mesa.id}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: cardSize.w,
              transition: isDragging ? 'none' : 'left 0.18s ease, top 0.18s ease, transform 0.15s',
              transform: isDragging ? 'scale(1.03)' : 'scale(1)',
              zIndex: isDragging ? 30 : (editing ? 10 : 1),
              touchAction: editing ? 'none' : 'auto',
              cursor: editing ? (isDragging ? 'grabbing' : 'grab') : 'default',
              boxShadow: isDragging ? '0 12px 32px rgba(0,0,0,0.45)' : undefined,
              opacity: isAuto && editing ? 0.92 : 1,
            }}
            onPointerDown={(e) => handlePointerDown(e, mesa.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Drag handle (visible only in edit mode) */}
            {editing && (
              <div
                className="absolute -top-2 -left-2 z-10 w-6 h-6 rounded-full bg-[#FF6B35] text-white flex items-center justify-center shadow-lg shadow-[#FF6B35]/40 pointer-events-none"
                aria-hidden="true"
              >
                <GripVertical size={11} />
              </div>
            )}

            {/* Block pointer events on the actual card while editing so the
                drag captures cleanly without firing card buttons. */}
            <div style={{ pointerEvents: editing ? 'none' : 'auto' }}>
              {renderCard(mesa)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
