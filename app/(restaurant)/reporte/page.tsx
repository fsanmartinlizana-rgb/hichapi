// ── /reporte — redirect legacy ──────────────────────────────────────────────
// Sprint 3 (2026-04-19): /reporte y /analytics se unificaron en /analytics
// con tabs "Resumen del día" / "Métricas" / "Mi dashboard". Esta ruta queda
// solo para compatibilidad con bookmarks antiguos.

import { redirect } from 'next/navigation'

export default function ReporteLegacyRedirect() {
  redirect('/analytics?tab=resumen')
}
