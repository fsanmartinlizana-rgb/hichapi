import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const EXTRACT_SYSTEM = `Eres un asistente de inventario de restaurantes.
Extrae una lista de productos con cantidad y unidad de medida.
Responde SOLO en JSON válido con este formato exacto:
[{"name": "Tomates", "quantity": 5, "unit": "kg", "category": "verduras"}]
Si no puedes extraer un campo, usa null.
Categorías posibles: carnes, verduras, frutas, lácteos, bebidas, granos, condimentos, limpieza, otros.
Solo JSON, sin texto adicional, sin markdown.`

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file         = formData.get('file') as File | null
    const restaurant_id = formData.get('restaurant_id') as string | null
    const confirmStr   = formData.get('confirm') as string | null

    if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'archivo requerido' }, { status: 400 })

    const supabase = createAdminClient()

    // If confirm=true, items are already extracted and we just insert them
    if (confirmStr === 'true') {
      const itemsJson = formData.get('items') as string
      const items: Array<{ name: string; quantity: number | null; unit: string | null; category: string | null }> = JSON.parse(itemsJson)

      const toInsert = items.map(item => ({
        restaurant_id,
        name:         item.name,
        current_qty:  item.quantity ?? 0,
        unit:         (item.unit ?? 'unidad') as 'kg' | 'g' | 'l' | 'ml' | 'unidad' | 'porcion' | 'caja',
        category:     item.category ?? 'otros',
        min_qty:      0,
        cost_per_unit: 0,
        active:       true,
      }))

      // Upsert by name+restaurant to avoid dupes
      const { error: insertErr } = await supabase
        .from('stock_items')
        .upsert(toInsert, { onConflict: 'restaurant_id,name', ignoreDuplicates: true })

      await supabase.from('inventory_imports').update({
        status: 'completed',
        imported_items: toInsert.length,
      }).eq('restaurant_id', restaurant_id).eq('status', 'processing')

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 })
      return NextResponse.json({ ok: true, imported: toInsert.length })
    }

    // Step 1: Upload file to Supabase Storage
    const fileExt  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
    const filePath = `inventory-imports/${restaurant_id}/${fileName}`
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer  = Buffer.from(arrayBuffer)

    await supabase.storage.from('imports').upload(filePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
    })

    // Create import record
    const { data: importRecord } = await supabase.from('inventory_imports').insert({
      restaurant_id,
      import_type: (['image/jpeg','image/png','image/webp'].includes(file.type)) ? 'photo'
                 : (['application/pdf'].includes(file.type)) ? 'pdf'
                 : (['text/csv'].includes(file.type)) ? 'csv'
                 : 'excel',
      source_url:  filePath,
      status:      'processing',
      created_by:  user.id,
    }).select().single()

    // Step 2: Extract items
    let extractedItems: Array<{ name: string; quantity: number | null; unit: string | null; category: string | null }> = []

    const isImage = ['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)
    const isCsv   = file.type === 'text/csv' || file.name.endsWith('.csv')

    if (isImage) {
      // Claude Vision extraction
      try {
        const anthropic = getAnthropic()
        const base64 = fileBuffer.toString('base64')
        const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 2000,
          system: EXTRACT_SYSTEM,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              { type: 'text', text: 'Extrae todos los ítems de inventario de esta imagen.' },
            ],
          }],
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        extractedItems = JSON.parse(cleaned)
      } catch (e) {
        console.error('Claude vision extraction failed:', e)
        extractedItems = []
      }
    } else if (isCsv) {
      // Parse CSV
      const text = fileBuffer.toString('utf-8')
      const lines = text.split('\n').filter(Boolean)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      extractedItems = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
        const nameIdx = headers.findIndex(h => h.includes('nombre') || h.includes('name') || h === 'item')
        const qtyIdx  = headers.findIndex(h => h.includes('cantidad') || h.includes('qty') || h.includes('quantity'))
        const unitIdx = headers.findIndex(h => h.includes('unidad') || h.includes('unit'))
        return {
          name:     cols[nameIdx >= 0 ? nameIdx : 0] ?? '',
          quantity: qtyIdx >= 0 ? parseFloat(cols[qtyIdx]) || null : null,
          unit:     unitIdx >= 0 ? cols[unitIdx] || null : null,
          category: null,
        }
      }).filter(i => i.name)
    }

    // Update import record with extraction
    await supabase.from('inventory_imports').update({
      raw_extraction: extractedItems,
    }).eq('id', importRecord?.id ?? '')

    return NextResponse.json({
      import_id: importRecord?.id,
      items: extractedItems,
      count: extractedItems.length,
    })
  } catch (err) {
    console.error('inventory/import error:', err)
    return NextResponse.json({ error: 'Error procesando archivo' }, { status: 500 })
  }
}
