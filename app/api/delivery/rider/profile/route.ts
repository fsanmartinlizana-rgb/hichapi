/**
 * GET   /api/delivery/rider/profile — get authenticated rider's profile
 * PATCH /api/delivery/rider/profile — update rider profile
 * Requirements: 1.3, 1.4, 1.9
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRider } from '@/lib/supabase/auth-guard'
import { UpdateRiderProfileSchema } from '@/lib/delivery/types'
import { updateRiderProfile } from '@/lib/delivery/rider.service'

export async function GET(_req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error) return error
  return NextResponse.json(rider)
}

export async function PATCH(req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error) return error

  const body = await req.json()
  const parsed = UpdateRiderProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const updated = await updateRiderProfile(rider.id, parsed.data)
    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 })
  }
}
