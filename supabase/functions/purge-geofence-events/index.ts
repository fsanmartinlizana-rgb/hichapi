/**
 * Supabase Edge Function: purge-geofence-events
 *
 * Purges old geofence audit data:
 * - geofence_events (enterprise QR/check-in): created_at > 90 days
 * - customer_geofence_events (comensal autenticado): entered_at > 90 days
 *
 * Schedule daily via supabase/config.toml (see [functions.purge-geofence-events]).
 * Requirements: 8.10, 10.8
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RETENTION_DAYS = 90

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, serviceKey)
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [enterprise, customer] = await Promise.all([
    supabase
      .from('geofence_events')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff),
    supabase
      .from('customer_geofence_events')
      .delete({ count: 'exact' })
      .lt('entered_at', cutoff),
  ])

  if (enterprise.error || customer.error) {
    const msg = [enterprise.error?.message, customer.error?.message].filter(Boolean).join('; ')
    console.error('purge-geofence-events error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const deleted = {
    geofence_events: enterprise.count ?? 0,
    customer_geofence_events: customer.count ?? 0,
  }

  console.log(`purge-geofence-events: cutoff=${cutoff}`, deleted)

  return new Response(
    JSON.stringify({ ok: true, cutoff, deleted }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
