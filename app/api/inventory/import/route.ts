import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const EXTRACT_SYSTEM = `Eres un asistente de inventario de restaurantes en Chile.
Extrae cada producto de la boleta o factura con cantidad, unidad y costo.

Responde SOLO en JSON válido con este formato exacto:
[{"name": "Tomates", "quantity": 5, "unit": "kg", "category": "verduras", "cost_per_unit": 1290}]

REGLAS DE COSTO (cost_per_unit en CLP, sin decimales, sin puntos):
- Si la boleta muestra precio total y cantidad, calcula el unitario: total / cantidad.
  Ejemplo: "Tomates 5 kg $6.450" → cost_per_unit = 1290
- Si solo muestra precio unitario, úsalo directo.
- Si no hay precio visible, usa null.
- NO incluyas IVA si la boleta lo separa — usa el costo neto cuando sea claro.

Si no puedes extraer un campo, usa null.

Categorías posibles: carnes, verduras, frutas, lácteos, bebidas, granos, condimentos, limpieza, otros.

Unidades posibles: kg, g, l, ml, unidad, porcion, caja.

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
      const items: Array<{
        name:           string
        quantity:       number | null
        unit:           string | null
        category:       string | null
        cost_per_unit?: number | null
      }> = JSON.parse(itemsJson)

      // 1. Buscar nombres existentes para evitar duplicar productos del
      //    mismo restaurant. Hacemos esto en código en vez de ON CONFLICT
      //    porque la tabla stock_items no tiene un UNIQUE en
      //    (restaurant_id, name) y agregar uno romperia restaurants que
      //    legítimamente tienen dos items con mismo nombre y unidad
      //    distinta (ej: "Salmón" en kg vs "Salmón" en porción).
      const names = items.map(i => i.name).filter(Boolean)
      const { data: existing } = await supabase
        .from('stock_items')
        .select('name')
        .eq('restaurant_id', restaurant_id)
        .in('name', names)

      type ExistingRow = { name: string | null }
      const existingSet = new Set((existing ?? []).map((r: ExistingRow) => (r.name ?? '').toLowerCase().trim()))

      // 2. Filtrar solo los nuevos
      const newItems = items.filter(i => i.name && !existingSet.has(i.name.toLowerCase().trim()))

      const toInsert = newItems.map(item => ({
        restaurant_id,
        name:          item.name,
        current_qty:   item.quantity ?? 0,
        unit:          (item.unit ?? 'unidad') as 'kg' | 'g' | 'l' | 'ml' | 'unidad' | 'porcion' | 'caja',
        category:      item.category ?? 'otros',
        min_qty:       0,
        cost_per_unit: Math.round(item.cost_per_unit ?? 0),
        active:        true,
      }))

      // 3. Insert simple (sin onConflict — los duplicados ya filtrados)
      let insertedCount = 0
      if (toInsert.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from('stock_items')
          .insert(toInsert)
          .select('id, current_qty')
        if (insertErr) {
          return NextResponse.json({ error: insertErr.message }, { status: 400 })
        }
        insertedCount = inserted?.length ?? toInsert.length

        // 4. Para cada item nuevo con qty > 0, registrar movimiento de compra
        //    así el inventario tiene trazabilidad de la entrada
        type InsertedRow = { id: string; current_qty: number | null }
        const movementsToInsert = (inserted ?? [])
          .filter((r: InsertedRow) => (r.current_qty ?? 0) > 0)
          .map((r: InsertedRow) => ({
            stock_item_id: r.id,
            restaurant_id,
            delta:         r.current_qty,
            reason:        'compra',
          }))
        if (movementsToInsert.length > 0) {
          await supabase.from('stock_movements').insert(movementsToInsert)
        }
      }

      const skippedCount = items.length - newItems.length

      await supabase.from('inventory_imports').update({
        status: 'completed',
        imported_items: insertedCount,
      }).eq('restaurant_id', restaurant_id).eq('status', 'processing')

      return NextResponse.json({
        ok:       true,
        imported: insertedCount,
        skipped:  skippedCount,
      })
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
    let extractedItems: Array<{
      name:           string
      quantity:       number | null
      unit:           string | null
      category:       string | null
      cost_per_unit?: number | null
    }> = []

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
      // Parse CSV — autodetecta columnas comunes
      const text = fileBuffer.toString('utf-8')
      const lines = text.split('\n').filter(Boolean)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      extractedItems = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
        const nameIdx = headers.findIndex(h => h.includes('nombre') || h.includes('name') || h === 'item')
        const qtyIdx  = headers.findIndex(h => h.includes('cantidad') || h.includes('qty') || h.includes('quantity'))
        const unitIdx = headers.findIndex(h => h.includes('unidad') || h.includes('unit'))
        const costIdx = headers.findIndex(h => h.includes('costo') || h.includes('precio') || h.includes('cost') || h.includes('price'))
        const catIdx  = headers.findIndex(h => h.includes('categor') || h.includes('category'))
        const parsedCost = costIdx >= 0 ? parseFloat((cols[costIdx] ?? '').replace(/[^\d.]/g, '')) : NaN
        return {
          name:          cols[nameIdx >= 0 ? nameIdx : 0] ?? '',
          quantity:      qtyIdx >= 0 ? parseFloat(cols[qtyIdx]) || null : null,
          unit:          unitIdx >= 0 ? cols[unitIdx] || null : null,
          category:      catIdx >= 0 ? cols[catIdx] || null : null,
          cost_per_unit: Number.isFinite(parsedCost) ? Math.round(parsedCost) : null,
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
