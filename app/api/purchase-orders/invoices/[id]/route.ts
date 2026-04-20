import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PatchInvoiceSchema = z.object({
  invoice_number: z.string().optional(),
  issued_at:      z.string().optional(),
  due_at:         z.string().optional(),
  notes:          z.string().optional(),
  attachment_url: z.string().url().optional(),
  payment_status: z.enum(['pendiente', 'pagada']).optional(),
  paid_amount:    z.number().int().min(0).optional(),
})

// PATCH /api/purchase-orders/invoices/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const { id } = await params

  let body: z.infer<typeof PatchInvoiceSchema>
  try {
    body = PatchInvoiceSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  const updatePayload: Record<string, unknown> = {}

  if (body.invoice_number !== undefined) updatePayload.invoice_number = body.invoice_number
  if (body.issued_at !== undefined) updatePayload.issued_at = body.issued_at
  if (body.due_at !== undefined) updatePayload.due_at = body.due_at
  if (body.notes !== undefined) updatePayload.notes = body.notes
  if (body.attachment_url !== undefined) updatePayload.attachment_url = body.attachment_url
  if (body.payment_status !== undefined) updatePayload.payment_status = body.payment_status

  // When marking as paid, record paid_at and paid_amount
  if (body.payment_status === 'pagada') {
    updatePayload.paid_at = new Date().toISOString()
    if (body.paid_amount !== undefined) updatePayload.paid_amount = body.paid_amount
  }

  const { data: invoice, error: updateErr } = await supabase
    .from('purchase_invoices')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 })
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  return NextResponse.json({ invoice })
}
