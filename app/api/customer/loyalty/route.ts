/**
 * GET /api/customer/loyalty — balance y transacciones de fidelidad
 */
import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/supabase/auth-guard'
import { getBalance, getTransactions } from '@/lib/customer/loyalty-service'

export async function GET() {
  const { customer, error } = await requireCustomer()
  if (error) return error

  try {
    const [balance, transactions] = await Promise.all([
      getBalance(customer!.id),
      getTransactions(customer!.id),
    ])
    return NextResponse.json({ balance, transactions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
