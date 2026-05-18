/**
 * GET   /api/delivery/rider/status — get rider's current status
 * PATCH /api/delivery/rider/status — toggle available ↔ offline
 * Requirements: 1.10, 1.11
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRider } from '@/lib/supabase/auth-guard'
import { UpdateRiderStatusSchema } from '@/lib/delivery/types'
import { updateRiderStatus } from '@/lib/delivery/rider.service'

export async function GET(_req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error) return error
  return NextResponse.json({ status: rider.status })
}

export async function PATCH(req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error) return error

  const body = await req.json()
  const parsed = UpdateRiderStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const updated = await updateRiderStatus(rider.id, parsed.data.status)
    return NextResponse.json({ status: updated.status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 })
  }
}
