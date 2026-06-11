/**
 * Helpers para el aviso por WhatsApp de la lista de espera (anfitrión).
 *
 * No hay integración de API de WhatsApp: usamos el deep-link oficial wa.me,
 * que abre WhatsApp del anfitrión con el mensaje pre-escrito hacia el cliente.
 * Por eso solo necesitamos normalizar el teléfono al formato internacional.
 */

/**
 * Normaliza un teléfono chileno a dígitos en formato internacional para wa.me.
 *
 * Reglas:
 *  - Quita todo lo que no sea dígito (espacios, +, guiones, paréntesis).
 *  - Si ya empieza con 56 (código país Chile), lo deja.
 *  - Si no, antepone 56.
 *
 * Devuelve null si no quedan dígitos (teléfono inválido / vacío) — el caller
 * debe degradar a "marcar como avisado" sin abrir WhatsApp.
 *
 * Ejemplos:
 *   "+56 9 1234 5678" → "56912345678"
 *   "9 1234 5678"     → "56912345678"
 *   "912345678"       → "56912345678"
 *   "56912345678"     → "56912345678"
 *   ""                → null
 */
export function normalizeWhatsappPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 0) return null
  return digits.startsWith('56') ? digits : `56${digits}`
}

/**
 * Construye la URL wa.me con mensaje pre-escrito. Devuelve null si el teléfono
 * no es válido (para que el caller no abra una pestaña rota).
 */
export function buildWhatsappWaitlistUrl(
  phone: string | null | undefined,
  customerName: string,
  restaurantName: string,
): string | null {
  const digits = normalizeWhatsappPhone(phone)
  if (!digits) return null
  const msg = encodeURIComponent(
    `Hola ${customerName}, te escribimos de ${restaurantName}: ¡tu mesa ya está lista! Te esperamos 😊`,
  )
  return `https://wa.me/${digits}?text=${msg}`
}
