export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

/**
 * DELETE /api/dte/emissions/cleanup?restaurant_id=...
 * 
 * Deletes all failed/pending DTE emissions for a restaurant
 * Useful for cleaning up after testing or configuration changes
 */
export async function DELETE(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Delete emissions that are not successfully sent
  const { data: deleted, error: deleteErr } = await supabase
    .from('dte_emissions')
    .delete()
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'draft', 'error'])
    .select('id')

  if (deleteErr) {
    console.error('Failed to delete emissions:', deleteErr)
    return NextResponse.json({ error: 'Failed to delete emissions' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    deleted: deleted?.length ?? 0,
    message: `Deleted ${deleted?.length ?? 0} failed/pending emission(s)`,
  })
}
