import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

// ── Schemas ──────────────────────────────────────────────────────────────────

const PostOrderReviewSchema = z.object({
  order_id:        z.string().uuid(),
  restaurant_slug: z.string().min(1),
  rating:          z.number().int().min(1).max(5),
  comment:         z.string().max(1000).optional().default(''),
})

// ── Sentiment analysis via Claude Haiku ──────────────────────────────────────
// Returns { sentiment, score, topics, summary } — falls back to neutral on any
// error so the review still saves even if the model is unreachable.

type SentimentResult = {
  sentiment: 'positive' | 'neutral' | 'negative'
  score:     number
  topics:    string[]
  summary:   string
}

async function analyzeSentiment(rating: number, comment: string): Promise<SentimentResult> {
  // If there's no comment, derive sentiment from the rating alone (no LLM call)
  if (!comment.trim()) {
    return {
      sentiment: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
      score:     rating >= 4 ? 0.7 : rating === 3 ? 0 : -0.7,
      topics:    [],
      summary:   `Calificación ${rating}/5 sin comentario`,
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      sentiment: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
      score:     rating >= 4 ? 0.5 : rating === 3 ? 0 : -0.5,
      topics:    [],
      summary:   comment.slice(0, 120),
    }
  }

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `Analizas reseñas de restaurantes en español. Devuelves JSON estricto con esta forma exacta:
{"sentiment":"positive|neutral|negative","score":-1..1,"topics":["service"|"food"|"ambiance"|"price"|"speed"],"summary":"una frase breve"}
- sentiment: basado en el texto Y la calificación de estrellas.
- score: -1 muy negativo, 0 neutro, 1 muy positivo.
- topics: array de los aspectos mencionados. Usa sólo estos valores exactos.
- summary: una sola frase en español, máximo 120 caracteres.
No incluyas texto fuera del JSON.`,
      messages: [
        {
          role: 'user',
          content: `Calificación: ${rating}/5 estrellas\nComentario: "${comment}"\n\nAnaliza.`,
        },
      ],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    // Extract JSON from the response — tolerate markdown fences
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in Haiku response')

    const parsed = JSON.parse(jsonMatch[0]) as Partial<SentimentResult>
    const sentiment: SentimentResult['sentiment'] =
      parsed.sentiment === 'positive' || parsed.sentiment === 'neutral' || parsed.sentiment === 'negative'
        ? parsed.sentiment
        : 'neutral'
    const score = typeof parsed.score === 'number' ? Math.max(-1, Math.min(1, parsed.score)) : 0
    const validTopics = ['service', 'food', 'ambiance', 'price', 'speed']
    const topics = Array.isArray(parsed.topics)
      ? parsed.topics.filter((t: unknown): t is string => typeof t === 'string' && validTopics.includes(t))
      : []
    const summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 200) : comment.slice(0, 120)

    return { sentiment, score, topics, summary }
  } catch (err) {
    console.error('Haiku sentiment analysis failed:', err)
    // Graceful degradation — use rating as fallback
    return {
      sentiment: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
      score:     rating >= 4 ? 0.5 : rating === 3 ? 0 : -0.5,
      topics:    [],
      summary:   comment.slice(0, 120),
    }
  }
}

// ── POST /api/reviews/post-order ─────────────────────────────────────────────
// Anonymous endpoint — customer submits from the QR flow without auth.

export async function POST(req: NextRequest) {
  try {
    const body = PostOrderReviewSchema.parse(await req.json())
    const supabase = createAdminClient()

    // Resolve restaurant from slug and verify the order belongs to it + is paid
    const { data: restaurant, error: restErr } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', body.restaurant_slug)
      .single()

    if (restErr || !restaurant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, status, restaurant_id')
      .eq('id', body.order_id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }
    if (order.restaurant_id !== restaurant.id) {
      return NextResponse.json({ error: 'Pedido no pertenece al restaurante' }, { status: 403 })
    }
    // Accept reviews once the order reached paying or paid — customer may
    // review while waiting for final confirmation.
    if (order.status !== 'paying' && order.status !== 'paid') {
      return NextResponse.json(
        { error: 'Sólo se pueden reseñar pedidos pagados' },
        { status: 400 }
      )
    }

    // Check if a review already exists for this order
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('order_id', body.order_id)
      .eq('source', 'post_order')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Ya existe una reseña para este pedido' }, { status: 409 })
    }

    // Run sentiment analysis (Haiku) — best effort
    const analysis = await analyzeSentiment(body.rating, body.comment)

    // Insert review — try with sentiment fields first, fallback to basic insert
    let review = null
    let insertErr = null

    const fullPayload = {
      restaurant_id:   restaurant.id,
      order_id:        body.order_id,
      rating:          body.rating,
      comment:         body.comment || null,
      source:          'post_order',
      sentiment:       analysis.sentiment,
      sentiment_score: analysis.score,
      topics:          analysis.topics,
      ai_summary:      analysis.summary,
    }

    const basicPayload = {
      restaurant_id:   restaurant.id,
      order_id:        body.order_id,
      rating:          body.rating,
      comment:         body.comment || null,
      source:          'post_order',
    }

    const res1 = await supabase.from('reviews').insert(fullPayload).select().single()
    if (res1.error) {
      console.warn('Review full insert failed, trying basic:', res1.error.message)
      const res2 = await supabase.from('reviews').insert(basicPayload).select().single()
      review = res2.data
      insertErr = res2.error
    } else {
      review = res1.data
    }

    if (insertErr) {
      console.error('Review insert error:', insertErr)
      return NextResponse.json({ error: `No se pudo guardar la reseña: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      review,
      sentiment: analysis.sentiment,
      summary:   analysis.summary,
    }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('post-order review route error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
