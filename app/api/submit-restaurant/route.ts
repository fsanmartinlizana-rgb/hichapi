import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SubmissionSchema = z.object({
  name:          z.string().min(2).max(100),
  address:       z.string().min(5).max(200),
  neighborhood:  z.string().min(2).max(80),
  cuisine_type:  z.string().min(2).max(60),
  price_range:   z.enum(['economico', 'medio', 'premium']),
  owner_name:    z.string().min(2).max(100),
  owner_email:   z.string().email(),
  owner_phone:   z.string().max(20).optional(),
  description:   z.string().max(500).optional(),
  instagram_url: z.string().max(200).optional(),
})

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = SubmissionSchema.parse(body)

    // Normalise Instagram: if user typed "@handle" convert to full URL
    let instagram_url = data.instagram_url?.trim() || null
    if (instagram_url && !instagram_url.startsWith('http')) {
      instagram_url = `https://instagram.com/${instagram_url.replace(/^@/, '')}`
    }

    const { error } = await supabase.from('restaurant_submissions').insert({
      name:           data.name,
      slug_proposed:  toSlug(data.name),
      address:        data.address,
      neighborhood:   data.neighborhood,
      cuisine_type:   data.cuisine_type,
      price_range:    data.price_range,
      owner_name:     data.owner_name,
      owner_email:    data.owner_email,
      owner_phone:    data.owner_phone || null,
      description:    data.description || null,
      instagram_url,
      status:         'pending',
    })

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: 'No pudimos guardar tu solicitud. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    // TODO: send confirmation email to owner_email via Resend/SendGrid
    // TODO: notify HiChapi team via Slack webhook

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.issues.map((i: z.ZodIssue) => i.message).join(', ')
      return NextResponse.json(
        { error: 'Datos inválidos: ' + messages },
        { status: 400 }
      )
    }
    console.error('Submit restaurant error:', err)
    return NextResponse.json(
      { error: 'Error del servidor. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
