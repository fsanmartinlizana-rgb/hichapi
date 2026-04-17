export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto/aes'

/**
 * POST /api/dte/caf/migrate
 * 
 * Migrates existing encrypted CAF XML data to plain text caf_xml column
 * for use with the PHP bridge.
 * 
 * This is a one-time migration endpoint that should be called after
 * running the schema migration.
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()

  // Get all CAFs that have encrypted XML but no plain text XML
  const { data: cafs, error: fetchErr } = await supabase
    .from('dte_cafs')
    .select('id, xml_ciphertext, xml_iv, xml_auth_tag, caf_xml')
    .is('caf_xml', null)

  if (fetchErr) {
    console.error('Failed to fetch CAFs:', fetchErr)
    return NextResponse.json({ error: 'Failed to fetch CAFs' }, { status: 500 })
  }

  if (!cafs || cafs.length === 0) {
    return NextResponse.json({ 
      ok: true, 
      message: 'No CAFs to migrate',
      migrated: 0 
    })
  }

  let migrated = 0
  let failed = 0
  const errors: string[] = []

  for (const caf of cafs) {
    try {
      // Decrypt the XML
      const xmlBuffer = decrypt({
        ciphertext: caf.xml_ciphertext,
        iv: caf.xml_iv,
        authTag: caf.xml_auth_tag,
      })

      const xmlContent = xmlBuffer.toString('utf8')

      // Update the row with plain text XML
      const { error: updateErr } = await supabase
        .from('dte_cafs')
        .update({ caf_xml: xmlContent })
        .eq('id', caf.id)

      if (updateErr) {
        console.error(`Failed to update CAF ${caf.id}:`, updateErr)
        errors.push(`CAF ${caf.id}: ${updateErr.message}`)
        failed++
      } else {
        migrated++
      }
    } catch (err) {
      console.error(`Failed to decrypt CAF ${caf.id}:`, err)
      errors.push(`CAF ${caf.id}: ${(err as Error).message}`)
      failed++
    }
  }

  return NextResponse.json({
    ok: true,
    migrated,
    failed,
    total: cafs.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
