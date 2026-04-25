// ─────────────────────────────────────────────────────────────────────────────
// HiChapi · sender de email transaccional
//
// Estrategia:
// 1. Si RESEND_API_KEY está configurado → envía via Resend (branded templates).
// 2. Si no → loguea el intento (y en dev muestra el body) y retorna skipped:true
//    para que la operación original no falle por falta de config.
//
// Debugging: los logs con prefijo [email] aparecen en Vercel Function Logs.
// ─────────────────────────────────────────────────────────────────────────────

import { boletaEmail, facturaEmail, stockCriticalEmail } from './templates'
import { createAdminClient } from '@/lib/supabase/server'

interface Attachment {
  filename: string
  content:  string   // base64-encoded content
  type:     string   // MIME type, e.g. 'application/xml' or 'application/pdf'
}

interface SendArgs {
  to:          string
  subject:     string
  html:        string
  text?:       string
  from?:       string
  replyTo?:    string
  attachments?: Attachment[]
}

export interface SendResult {
  ok:         boolean
  skipped?:   boolean       // true si no hay API key configurada
  error?:     string        // mensaje de error (si falló)
  id?:        string        // Resend message ID (si fue ok)
  provider?:  'resend'      // provider usado
  detail?:    unknown
}

export interface StockSendResult extends SendResult {
  reason?: 'no_critical_items' | 'no_admin' | 'already_sent_today'
}

// Deduplicación de stock crítico: clave → timestamp ISO del primer envío del día
// Requisito 5.5: evitar múltiples correos el mismo día por el mismo restaurante
const stockCriticalSentToday = new Map<string, string>()

const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL ?? 'HiChapi <no-reply@hichapi.com>'
const IS_DEV = process.env.NODE_ENV !== 'production'

export async function sendBrandedEmail(args: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY

  // ── Caso 1: sin config — loguear y retornar skipped ──────────────────────
  if (!apiKey) {
    console.warn(
      `[email] SKIPPED send to=${args.to} subject="${args.subject}" — ` +
      `RESEND_API_KEY no está configurada. Configurala en Vercel → Settings → Environment Variables.`
    )
    if (IS_DEV) {
      // En dev: mostrar el texto plano del email en consola para facilitar pruebas
      console.info(`[email][DEV] ${args.subject}\n──────\n${args.text ?? '(sin text plano)'}\n──────`)
    }
    return { ok: false, skipped: true }
  }

  // ── Caso 2: envío real via Resend ────────────────────────────────────────
  try {
    const payload: Record<string, unknown> = {
      from:    args.from ?? DEFAULT_FROM,
      to:      [args.to],
      subject: args.subject,
      html:    args.html,
      text:    args.text,
    }
    if (args.replyTo) payload.reply_to = args.replyTo
    if (args.attachments && args.attachments.length > 0) {
      payload.attachments = args.attachments.map(a => ({
        filename: a.filename,
        content:  a.content,
        type:     a.type,
      }))
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    })

    const raw = await res.text().catch(() => '')
    let body: unknown = {}
    try { body = JSON.parse(raw) } catch { body = raw }

    if (!res.ok) {
      const errMsg = (body as { message?: string })?.message ?? raw ?? `HTTP ${res.status}`
      console.error(
        `[email] FAILED send to=${args.to} subject="${args.subject}" ` +
        `status=${res.status} error="${errMsg}"`
      )
      return { ok: false, provider: 'resend', error: errMsg, detail: body }
    }

    const id = (body as { id?: string })?.id
    console.info(`[email] SENT to=${args.to} subject="${args.subject}" id=${id ?? '(no-id)'}`)
    return { ok: true, provider: 'resend', id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[email] EXCEPTION to=${args.to} subject="${args.subject}" err="${msg}"`)
    return { ok: false, provider: 'resend', error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnóstico rápido — usado por /api/admin/email-test
// ─────────────────────────────────────────────────────────────────────────────

export function emailDiagnostics(): {
  configured:  boolean
  provider:    string | null
  from:        string
  message:     string
} {
  const apiKey = process.env.RESEND_API_KEY
  return {
    configured: !!apiKey,
    provider:   apiKey ? 'resend' : null,
    from:       DEFAULT_FROM,
    message:    apiKey
      ? 'Resend configurado. Los correos se envían con plantillas branded.'
      : 'Sin proveedor de email. Configurá RESEND_API_KEY en las variables de entorno.',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// sendBoletaEmail — envío de boleta electrónica al cliente
// Requisitos: 1.4, 1.5, 1.6, 1.7, 4.4
// ─────────────────────────────────────────────────────────────────────────────

export interface SendBoletaArgs {
  to:             string
  orderId:        string
  folio:          number
  restaurantName: string
  totalAmount:    number
  emittedAt:      string
  items:          Array<{ name: string; quantity: number; unit_price: number }>
  xmlBase64?:     string   // contenido XML en base64 (opcional)
  pdfBase64?:     string   // contenido PDF en base64 (opcional)
}

export async function sendBoletaEmail(args: SendBoletaArgs): Promise<SendResult> {
  // Requisito 1.7: si el email del receptor no está disponible, omitir el envío
  if (!args.to || args.to.trim() === '') {
    console.warn(
      `[email] SKIPPED sendBoletaEmail — no email for orderId=${args.orderId} folio=${args.folio}`
    )
    return { ok: false, skipped: true, reason: 'no_email' } as SendResult & { reason: string }
  }

  // Generar la plantilla
  const template = boletaEmail({
    restaurantName: args.restaurantName,
    folio:          args.folio,
    totalAmount:    args.totalAmount,
    emittedAt:      args.emittedAt,
    items:          args.items,
    hasXml:         !!args.xmlBase64,
    hasPdf:         !!args.pdfBase64,
  })

  // Construir adjuntos (Requisitos 1.4, 1.5)
  const attachments: Attachment[] = []
  if (args.xmlBase64) {
    attachments.push({
      filename: `boleta-${args.folio}.xml`,
      content:  args.xmlBase64,
      type:     'application/xml',
    })
  }
  if (args.pdfBase64) {
    attachments.push({
      filename: `boleta-${args.folio}.pdf`,
      content:  args.pdfBase64,
      type:     'application/pdf',
    })
  }

  // Enviar el correo
  const result = await sendBrandedEmail({
    to:          args.to,
    subject:     template.subject,
    html:        template.html,
    text:        template.text,
    attachments: attachments.length > 0 ? attachments : undefined,
  })

  // Requisito 4.4: registrar log info cuando el envío es exitoso
  if (result.ok) {
    console.info(
      `[email] sendBoletaEmail OK to=${args.to} subject="${template.subject}" id=${result.id ?? '(no-id)'}`
    )
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// sendFacturaEmail — envío de factura electrónica al receptor tributario
// Requisitos: 2.4, 2.5, 2.6, 2.7
// ─────────────────────────────────────────────────────────────────────────────

export interface SendFacturaArgs {
  to:             string
  orderId:        string
  folio:          number
  restaurantName: string
  razonReceptor:  string
  totalAmount:    number
  emittedAt:      string
  items?:         Array<{ name: string; quantity: number; unit_price: number }>
  xmlBase64?:     string   // contenido XML en base64 (opcional)
  pdfBase64?:     string   // contenido PDF en base64 (opcional)
}

export async function sendFacturaEmail(args: SendFacturaArgs): Promise<SendResult> {
  // Requisito 2.7: si razonReceptor no está disponible, omitir el envío
  if (!args.razonReceptor || args.razonReceptor.trim() === '') {
    console.warn(
      `[email] SKIPPED sendFacturaEmail — no razonReceptor for orderId=${args.orderId} folio=${args.folio}`
    )
    return { ok: false, skipped: true, reason: 'no_receptor_data' } as SendResult & { reason: string }
  }

  // Generar la plantilla (con ítems si están disponibles)
  const template = facturaEmail({
    restaurantName: args.restaurantName,
    razonReceptor:  args.razonReceptor,
    folio:          args.folio,
    totalAmount:    args.totalAmount,
    emittedAt:      args.emittedAt,
    hasXml:         !!args.xmlBase64,
    hasPdf:         !!args.pdfBase64,
    items:          args.items,
  })

  // Construir adjuntos (Requisitos 2.4, 2.5)
  const attachments: Attachment[] = []
  if (args.xmlBase64) {
    attachments.push({
      filename: `factura-${args.folio}.xml`,
      content:  args.xmlBase64,
      type:     'application/xml',
    })
  }
  if (args.pdfBase64) {
    attachments.push({
      filename: `factura-${args.folio}.pdf`,
      content:  args.pdfBase64,
      type:     'application/pdf',
    })
  }

  // Enviar el correo
  const result = await sendBrandedEmail({
    to:          args.to,
    subject:     template.subject,
    html:        template.html,
    text:        template.text,
    attachments: attachments.length > 0 ? attachments : undefined,
  })

  // Requisito 4.4: registrar log info cuando el envío es exitoso
  if (result.ok) {
    console.info(
      `[email] sendFacturaEmail OK to=${args.to} subject="${template.subject}" id=${result.id ?? '(no-id)'}`
    )
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// sendStockCriticalReport — reporte de stock crítico al admin del restaurante
// Requisitos: 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.5
// ─────────────────────────────────────────────────────────────────────────────

export async function sendStockCriticalReport(restaurantId: string): Promise<StockSendResult> {
  const supabase = createAdminClient()

  // ── 1. Consultar ítems con stock crítico (current_qty <= min_qty, active = true) ──
  // Supabase JS no soporta comparación columna-vs-columna directamente,
  // así que traemos todos los activos y filtramos en memoria.
  const { data: allActiveItems, error: stockErr } = await supabase
    .from('stock_items')
    .select('name, current_qty, min_qty, unit, supplier')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  if (stockErr) {
    console.error(`[email] sendStockCriticalReport — error querying stock_items for restaurantId=${restaurantId}:`, stockErr.message)
    return { ok: false, error: stockErr.message }
  }

  const items = (allActiveItems ?? []).filter(
    (item: { current_qty: number; min_qty: number }) => item.current_qty <= item.min_qty
  )

  // ── 2. Si no hay ítems críticos, retornar skipped ──────────────────────────
  if (items.length === 0) {
    return { ok: false, skipped: true, reason: 'no_critical_items' }
  }

  // ── 3. Verificar deduplicación ─────────────────────────────────────────────
  // Construir la fecha en zona horaria America/Santiago con formato YYYY-MM-DD
  const todayParts = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
  }).formatToParts(new Date())

  const year  = todayParts.find(p => p.type === 'year')?.value  ?? ''
  const month = todayParts.find(p => p.type === 'month')?.value ?? ''
  const day   = todayParts.find(p => p.type === 'day')?.value   ?? ''
  const today = `${year}-${month}-${day}`

  const dedupKey = `stock_critical:${restaurantId}:${today}`

  if (stockCriticalSentToday.has(dedupKey)) {
    return { ok: false, skipped: true, reason: 'already_sent_today' }
  }

  // ── 4. Obtener el email del admin/owner ────────────────────────────────────
  const { data: teamMember, error: teamError } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('restaurant_id', restaurantId)
    .in('role', ['owner', 'admin'])
    .eq('active', true)
    .limit(1)
    .single()

  if (teamError || !teamMember) {
    console.warn(`[email] sendStockCriticalReport — no active admin/owner for restaurantId=${restaurantId}`)
    return { ok: false, skipped: true, reason: 'no_admin' }
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(teamMember.user_id)

  if (authError || !authUser?.user?.email) {
    console.warn(`[email] sendStockCriticalReport — could not get email for userId=${teamMember.user_id} restaurantId=${restaurantId}`)
    return { ok: false, skipped: true, reason: 'no_admin' }
  }

  const adminEmail = authUser.user.email

  // ── 5. Obtener el nombre del restaurante ───────────────────────────────────
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name')
    .eq('id', restaurantId)
    .single()

  const restaurantName = restaurant?.name ?? restaurantId

  // ── 6. Generar la plantilla y enviar ──────────────────────────────────────
  const template = stockCriticalEmail({
    restaurantName,
    items: items.map((item: { name: string; current_qty: number; min_qty: number; unit: string; supplier?: string | null }) => ({
      name:        item.name,
      current_qty: item.current_qty,
      min_qty:     item.min_qty,
      unit:        item.unit,
      supplier:    item.supplier ?? null,
    })),
  })

  const result = await sendBrandedEmail({
    to:      adminEmail,
    subject: template.subject,
    html:    template.html,
    text:    template.text,
  })

  // ── 7. Si el envío fue exitoso, registrar la clave de deduplicación ────────
  if (result.ok) {
    stockCriticalSentToday.set(dedupKey, new Date().toISOString())
    console.info(
      `[email] sendStockCriticalReport OK to=${adminEmail} subject="${template.subject}" id=${result.id ?? '(no-id)'} restaurantId=${restaurantId}`
    )
  }

  return result
}
