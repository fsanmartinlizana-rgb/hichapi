import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Handle CORS preflight for mobile app
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// GET /api/orders/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // NEXT.js 15+ requiere await en params
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json(
      { error: 'id requerido' }, 
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }

  const supabase = createAdminClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .single()

  if (error || !order) {
    return NextResponse.json(
      { error: 'Orden no encontrada' }, 
      { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }

  return NextResponse.json(order, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  })
}
