/**
 * Supabase Edge Function: purge-gps-history
 *
 * Deletes rider_locations records older than 7 days.
 * Should be scheduled to run daily via supabase/config.toml cron.
 *
 * Requirements: 10.8
 *
 * To schedule in supabase/config.toml:
 *   [functions.purge-gps-history]
 *   schedule = "0 3 * * *"   # runs at 03:00 UTC every day
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req: Request) => {
  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, serviceKey)

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error, count } = await supabase
    .from('rider_locations')
    .delete({ count: 'exact' })
    .lt('recorded_at', cutoff)

  if (error) {
    console.error('purge-gps-history error:', error.message)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  console.log(`purge-gps-history: deleted ${count ?? 0} records older than ${cutoff}`)
  return new Response(
    JSON.stringify({ ok: true, deleted: count ?? 0, cutoff }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
