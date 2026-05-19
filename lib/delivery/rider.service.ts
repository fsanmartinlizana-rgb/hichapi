/**
 * lib/delivery/rider.service.ts
 *
 * RiderService — profile CRUD, status management, document upload.
 * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 1.10, 1.11
 */
import { createAdminClient } from '@/lib/supabase/server'
import type {
  RiderProfile,
  RiderStatus,
  DocumentStatus,
  UpdateRiderProfileInput,
} from './types'

// ── Profile ───────────────────────────────────────────────────────────────────

export interface CreateRiderProfileServiceInput {
  userId: string
  full_name: string
  phone: string
  national_id: string
  vehicle_type: 'bicycle' | 'motorcycle' | 'car' | 'cargo_bike'
  license_plate?: string
  vehicle_model?: string
}

export async function createRiderProfile(
  input: CreateRiderProfileServiceInput,
): Promise<RiderProfile> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('rider_profiles')
    .insert({
      user_id:       input.userId,
      full_name:     input.full_name,
      phone:         input.phone,
      national_id:   input.national_id,
      vehicle_type:  input.vehicle_type,
      license_plate: input.license_plate ?? null,
      vehicle_model: input.vehicle_model ?? null,
      status:           'pending_verification',
      document_status:  'pending',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as RiderProfile
}

export async function getRiderProfileByUserId(userId: string): Promise<RiderProfile | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('rider_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as RiderProfile | null
}

export async function getRiderProfileById(riderId: string): Promise<RiderProfile | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('rider_profiles')
    .select('*')
    .eq('id', riderId)
    .maybeSingle()
  return data as RiderProfile | null
}

export async function updateRiderProfile(
  riderId: string,
  input: UpdateRiderProfileInput,
): Promise<RiderProfile> {
  const supabase = createAdminClient()

  // Block profile updates while rider is busy (vehicle data only)
  if (input.vehicle_type || input.license_plate || input.vehicle_model) {
    const { data: rider } = await supabase
      .from('rider_profiles')
      .select('status')
      .eq('id', riderId)
      .maybeSingle()

    if (rider?.status === 'busy') {
      throw new Error('No se puede actualizar datos del vehículo mientras hay una entrega activa')
    }
  }

  const { data, error } = await supabase
    .from('rider_profiles')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', riderId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as RiderProfile
}

// ── Status management ─────────────────────────────────────────────────────────

export async function updateRiderStatus(
  riderId: string,
  newStatus: 'available' | 'offline',
): Promise<RiderProfile> {
  const supabase = createAdminClient()

  const { data: rider } = await supabase
    .from('rider_profiles')
    .select('status, document_status')
    .eq('id', riderId)
    .maybeSingle()

  if (!rider) throw new Error('Rider no encontrado')

  // Cannot go offline while busy
  if (newStatus === 'offline' && rider.status === 'busy') {
    throw new Error('No puedes desconectarte mientras tienes una entrega activa')
  }

  // Cannot go available while pending verification
  if (newStatus === 'available' && rider.document_status === 'pending') {
    throw new Error('Tu cuenta está pendiente de verificación. No puedes activarte aún.')
  }
  if (newStatus === 'available' && rider.document_status === 'documents_submitted') {
    throw new Error('Tus documentos están en revisión. Recibirás una notificación cuando sean aprobados.')
  }

  const { data, error } = await supabase
    .from('rider_profiles')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', riderId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as RiderProfile
}

// ── Document management ───────────────────────────────────────────────────────

export type DocType = 'national_id' | 'license' | 'insurance' | 'permit' | 'inspection' | 'driver_record'

const DOC_COLUMN: Record<DocType, keyof RiderProfile> = {
  national_id:   'doc_national_id_url',
  license:       'doc_license_url',
  insurance:     'doc_insurance_url',
  permit:        'doc_permit_url',
  inspection:    'doc_inspection_url',
  driver_record: 'doc_driver_record_url',
}

export async function setDocumentUrl(
  riderId: string,
  docType: DocType,
  url: string,
): Promise<void> {
  const supabase = createAdminClient()
  const column = DOC_COLUMN[docType]

  const { error: updateError } = await supabase
    .from('rider_profiles')
    .update({ [column]: url, updated_at: new Date().toISOString() })
    .eq('id', riderId)

  if (updateError) {
    throw new Error(`Failed to update document url: ${updateError.message}`)
  }

  // Check if all 6 docs are now uploaded → set document_status to documents_submitted
  const { data: rider } = await supabase
    .from('rider_profiles')
    .select('doc_national_id_url, doc_license_url, doc_insurance_url, doc_permit_url, doc_inspection_url, doc_driver_record_url, document_status')
    .eq('id', riderId)
    .maybeSingle()

  if (
    rider &&
    rider.doc_national_id_url &&
    rider.doc_license_url &&
    rider.doc_insurance_url &&
    rider.doc_permit_url &&
    rider.doc_inspection_url &&
    rider.doc_driver_record_url &&
    rider.document_status === 'pending'
  ) {
    const { error: statusError } = await supabase
      .from('rider_profiles')
      .update({ document_status: 'documents_submitted' as DocumentStatus, updated_at: new Date().toISOString() })
      .eq('id', riderId)

    if (statusError) {
      throw new Error(`Failed to update document status: ${statusError.message}`)
    }
  }
}

export async function setDocumentStatus(
  riderId: string,
  status: DocumentStatus,
): Promise<void> {
  const supabase = createAdminClient()
  const updates: Record<string, unknown> = {
    document_status: status,
    updated_at: new Date().toISOString(),
  }

  // When approved, activate the rider
  if (status === 'approved') {
    updates.status = 'available' as RiderStatus
  }
  // When rejected, suspend the rider
  if (status === 'rejected') {
    updates.status = 'suspended' as RiderStatus
  }

  await supabase
    .from('rider_profiles')
    .update(updates)
    .eq('id', riderId)
}
