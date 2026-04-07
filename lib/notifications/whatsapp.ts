// lib/notifications/whatsapp.ts
// WhatsApp Cloud API (Meta) — cheapest notification method for Chilean restaurants
// Free tier: 1000 conversations/month. ~$0.013/msg after that (vs $0.05 for SMS)
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

export interface WaMessage {
  to: string          // phone with country code, no spaces: +56912345678
  type: 'text' | 'template'
  text?: string
  templateName?: string
  templateParams?: string[]
  language?: string
}

export interface WaResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send a WhatsApp message via Meta Cloud API
 * Requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars
 */
export async function sendWhatsApp(msg: WaMessage): Promise<WaResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId) {
    console.warn('[WhatsApp] Missing env vars — message not sent:', msg.to)
    return { success: false, error: 'Missing configuration' }
  }

  const body = msg.type === 'template'
    ? {
        messaging_product: 'whatsapp',
        to: normalizePhone(msg.to),
        type: 'template',
        template: {
          name: msg.templateName,
          language: { code: msg.language ?? 'es' },
          components: msg.templateParams?.length
            ? [{ type: 'body', parameters: msg.templateParams.map(p => ({ type: 'text', text: p })) }]
            : undefined,
        },
      }
    : {
        messaging_product: 'whatsapp',
        to: normalizePhone(msg.to),
        type: 'text',
        text: { body: msg.text },
      }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      console.error('[WhatsApp] API error:', err)
      return { success: false, error: err?.error?.message ?? 'API error' }
    }

    const data = await res.json()
    return { success: true, messageId: data.messages?.[0]?.id }
  } catch (e) {
    console.error('[WhatsApp] Network error:', e)
    return { success: false, error: 'Network error' }
  }
}

/** Normalize Chilean phone: +56 9 1234 5678 → +56912345678 */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '')
}

// ── Pre-built message templates ───────────────────────────────────────────────

/** Notify customer they're next in waitlist */
export function waitlistNotifyMessage(params: {
  customerName: string
  restaurantName: string
  estimatedMinutes?: number
}): string {
  const eta = params.estimatedMinutes
    ? ` Tienes aproximadamente ${params.estimatedMinutes} minutos.`
    : ''
  return `¡Hola ${params.customerName}! 🎉 Tu mesa en ${params.restaurantName} está casi lista.${eta} Por favor acércate a la entrada.`
}

/** Chapi pre-engagement: invite customer to browse menu while waiting */
export function waitlistChapiEngageMessage(params: {
  customerName: string
  restaurantName: string
  chapiUrl: string
  minutesUntilTurn: number
}): string {
  return `¡Hola ${params.customerName}! 👋 Mientras esperas tu mesa en ${params.restaurantName}, puedes ver nuestra carta y pre-elegir tu pedido con Chapi aquí: ${params.chapiUrl}\n\n¡Así te atendemos más rápido al sentarte! 🍽️`
}
