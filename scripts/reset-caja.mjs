/**
 * Reset de caja: cierra todas las sesiones abiertas (con $0 actual_cash) y
 * verifica que no quede saldo "fantasma".
 *
 * Uso:
 *   set -a; source .env.local; set +a
 *   node scripts/reset-caja.mjs [restaurant_id]
 *
 * Si no pasás restaurant_id, lista todos los restaurants con sesiones abiertas.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const restId = process.argv[2]

if (!restId) {
  console.log('🔍 Buscando sesiones abiertas...\n')
  const { data: sessions } = await sb
    .from('cash_register_sessions')
    .select('id, restaurant_id, opened_at, opening_amount, restaurants(name, slug)')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })

  if (!sessions || sessions.length === 0) {
    console.log('✅ No hay sesiones abiertas')
    process.exit(0)
  }

  console.log(`📋 ${sessions.length} sesión(es) abierta(s):\n`)
  for (const s of sessions) {
    const r = Array.isArray(s.restaurants) ? s.restaurants[0] : s.restaurants
    console.log(`  • ${r?.name ?? '(?)'} (${s.restaurant_id})`)
    console.log(`    sesión: ${s.id}`)
    console.log(`    abierta: ${new Date(s.opened_at).toLocaleString('es-CL')}`)
    console.log(`    apertura: $${s.opening_amount.toLocaleString('es-CL')}\n`)
  }
  console.log('Para cerrar todas las sesiones de un restaurant:')
  console.log('  node scripts/reset-caja.mjs <restaurant_id>')
  process.exit(0)
}

console.log(`🔧 Reset caja del restaurant: ${restId}\n`)

// 1. Cerrar todas las sesiones abiertas con actual_cash=0
const { data: openSessions } = await sb
  .from('cash_register_sessions')
  .select('id, opened_at, opening_amount')
  .eq('restaurant_id', restId)
  .eq('status', 'open')

if (!openSessions || openSessions.length === 0) {
  console.log('✅ No hay sesiones abiertas para este restaurant')
} else {
  console.log(`🔒 Cerrando ${openSessions.length} sesión(es)...`)
  for (const s of openSessions) {
    const fullPayload = {
      status: 'closed',
      closed_at: new Date().toISOString(),
      actual_cash: 0,
      total_cash: 0,
      total_digital: 0,
      total_orders: 0,
      total_expenses: 0,
      difference: -s.opening_amount,
      notes: '[RESET ADMIN] Sesión cerrada por reseteo de caja.',
    }
    let { error } = await sb.from('cash_register_sessions').update(fullPayload).eq('id', s.id)
    if (error && /column.*does not exist|schema cache/i.test(error.message)) {
      const { total_expenses: _te, ...legacyPayload } = fullPayload
      void _te
      const legacy = await sb.from('cash_register_sessions').update(legacyPayload).eq('id', s.id)
      error = legacy.error
    }
    if (error) console.error(`  ❌ ${s.id}: ${error.message}`)
    else console.log(`  ✅ Cerrada: ${s.id} (apertura: $${s.opening_amount.toLocaleString('es-CL')})`)
  }
}

// 2. Verificar pedidos pagados pero "huérfanos" (sin sesión asociada)
console.log('\n🔍 Verificando pedidos del día...')
const today = new Date()
today.setHours(0, 0, 0, 0)
const { data: paidToday } = await sb
  .from('orders')
  .select('id, total, cash_amount, digital_amount')
  .eq('restaurant_id', restId)
  .eq('status', 'paid')
  .gte('updated_at', today.toISOString())

const totalCash = (paidToday ?? []).reduce((s, o) => s + (o.cash_amount ?? 0), 0)
const totalDig  = (paidToday ?? []).reduce((s, o) => s + (o.digital_amount ?? 0), 0)
console.log(`  Pedidos pagados HOY: ${(paidToday ?? []).length}`)
console.log(`  Efectivo: $${totalCash.toLocaleString('es-CL')}`)
console.log(`  Digital:  $${totalDig.toLocaleString('es-CL')}`)

console.log('\n=================================================')
console.log('✅ Caja reseteada')
console.log('   Próximo "Abrir caja" arrancará en $0')
console.log('   Indicadores se calculan desde orders.cash_amount')
console.log('=================================================')
