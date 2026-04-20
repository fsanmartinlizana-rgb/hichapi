// ── Helpers de promociones ──────────────────────────────────────────────
// Sprint 2026-04-20. Lógica compartida entre chat Chapi, página pública
// del restaurant y landing de búsqueda.
//
// Una promoción "activa ahora" es la que cumple:
//   • active = true
//   • fecha actual entre valid_from y valid_until (si valid_until != null)
//   • day_of_week actual está en days_of_week (si days_of_week != null)
//   • hora actual entre time_start y time_end (si ambos != null)

export interface PromotionRow {
  id:             string
  name:           string
  description:    string | null
  kind:           'discount_pct' | 'discount_amount' | '2x1' | 'combo' | 'happy_hour'
  value:          number | null
  time_start:     string | null
  time_end:       string | null
  days_of_week:   number[] | null
  valid_from:     string
  valid_until:    string | null
  channel_mesa:   boolean
  channel_espera: boolean
  channel_chapi:  boolean
  menu_item_ids:  string[] | null
  active:         boolean
}

/** True si la promo está vigente en el momento actual (server time). */
export function isPromoActiveNow(p: PromotionRow, now: Date = new Date()): boolean {
  if (!p.active) return false

  // Ventana calendaria
  const todayISO = now.toISOString().slice(0, 10)
  if (p.valid_from && todayISO < p.valid_from) return false
  if (p.valid_until && todayISO > p.valid_until) return false

  // Día de la semana (0=Dom..6=Sab)
  if (p.days_of_week && p.days_of_week.length > 0) {
    if (!p.days_of_week.includes(now.getDay())) return false
  }

  // Ventana horaria "HH:MM"-"HH:MM"
  if (p.time_start && p.time_end) {
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (hhmm < p.time_start || hhmm > p.time_end) return false
  }

  return true
}

/** Label corto para UI (ej "20% off", "- $2.000", "2×1"). */
export function promoValueLabel(p: PromotionRow): string {
  if (p.kind === 'discount_pct' && p.value != null)    return `${p.value}% OFF`
  if (p.kind === 'discount_amount' && p.value != null) return `- $${p.value.toLocaleString('es-CL')}`
  if (p.kind === '2x1')                                return '2 × 1'
  if (p.kind === 'combo')                              return 'Combo'
  if (p.kind === 'happy_hour')                         return 'Happy Hour'
  return 'Promo'
}

/** Texto corto de la ventana horaria (ej "15:00-17:00 · Lun-Vie"). */
export function promoScheduleLabel(p: PromotionRow): string {
  const timeText = p.time_start && p.time_end
    ? `${p.time_start}–${p.time_end}`
    : 'Todo el día'
  const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const dayText = p.days_of_week && p.days_of_week.length > 0 && p.days_of_week.length < 7
    ? p.days_of_week.sort().map(d => dayNames[d]).join(', ')
    : ''
  return dayText ? `${timeText} · ${dayText}` : timeText
}
