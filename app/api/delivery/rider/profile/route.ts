/**
 * GET   /api/delivery/rider/profile — get authenticated rider's profile
 * PATCH /api/delivery/rider/profile — update rider profile
 * Requirements: 1.3, 1.4, 1.9
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRider, requireUser } from '@/lib/supabase/auth-guard'
import { UpdateRiderProfileSchema, CreateRiderProfileSchema } from '@/lib/delivery/types'
import { updateRiderProfile, createRiderProfile } from '@/lib/delivery/rider.service'

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
export async function POST(req: NextRequest) {
  // Use requireUser to get the authenticated user without requiring a pre-existing profile
  const { user, error } = await requireUser()
  if (error) return error
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateRiderProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const newProfile = await createRiderProfile({
      ...parsed.data,
      userId: user.id,
    })
    return NextResponse.json(newProfile, { status: 201 })
  } catch (err: any) {
    // If the profile already exists, return 409 Conflict
    if (err.message.includes('duplicate key value violates unique constraint')) {
      return NextResponse.json({ error: 'El perfil ya existe para este usuario' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message }, { status: 422 })
  }
}
