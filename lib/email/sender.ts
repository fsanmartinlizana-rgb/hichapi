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
