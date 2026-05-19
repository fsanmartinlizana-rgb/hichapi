import { NextRequest, NextResponse } from 'next/server'
import { requireRider } from '@/lib/supabase/auth-guard'
import { setDocumentUrl, type DocType } from '@/lib/delivery/rider.service'

export async function POST(req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error) return error

  const body = await req.json()
  const { doc_type, url } = body

  if (!doc_type || !['national_id', 'license', 'insurance', 'permit', 'inspection', 'driver_record'].includes(doc_type)) {
    return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
  }
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }

  try {
    await setDocumentUrl(rider.id, doc_type as DocType, url)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 })
  }
}
