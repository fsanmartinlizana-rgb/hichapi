// ─────────────────────────────────────────────────────────────────────────────
// HiChapi · sender de email transaccional
// Usa Resend HTTP API si RESEND_API_KEY está definido. Si no, devuelve
// { ok: false, skipped: true } y deja que Supabase mande su template default.
// ─────────────────────────────────────────────────────────────────────────────

interface SendArgs {
  to:       string
  subject:  string
  html:     string
  text?:    string
  from?:    string
}

interface SendResult {
  ok:       boolean
  skipped?: boolean
  error?:   string
  id?:      string
}

const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL ?? 'HiChapi <no-reply@hichapi.com>'

export async function sendBrandedEmail(args: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, skipped: true }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    args.from ?? DEFAULT_FROM,
        to:      [args.to],
        subject: args.subject,
        html:    args.html,
        text:    args.text,
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown error')
      console.error('Resend send error:', res.status, err)
      return { ok: false, error: err }
    }

    const data = await res.json().catch(() => ({}))
    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('Resend exception:', err)
    return { ok: false, error: String(err) }
  }
}
