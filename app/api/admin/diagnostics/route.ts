import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { aiProviderStatus } from '@/lib/ai/chat'
import { emailDiagnostics } from '@/lib/email/sender'

/**
 * GET /api/admin/diagnostics
 * Retorna el estado de las integraciones externas (AI providers, email, etc).
 * Cualquier usuario autenticado puede consultarlo.
 */
export async function GET() {
  const { user, error } = await requireUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const providers = aiProviderStatus()
  const ai = {
    providers,
    any_configured: providers.some(p => p.configured),
    fallback_chain: providers.filter(p => p.configured).map(p => p.provider),
  }

  return NextResponse.json({
    ok:     true,
    ai,
    email:  emailDiagnostics(),
    site:   {
      url: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      env: process.env.NODE_ENV ?? null,
    },
  })
}
