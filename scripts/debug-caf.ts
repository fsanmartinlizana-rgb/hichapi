#!/usr/bin/env tsx
/**
 * Debug script to check CAF XML format
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createAdminClient } from '../lib/supabase/server'
import { decrypt } from '../lib/crypto/aes'
import { writeFileSync } from 'fs'

config({ path: resolve(process.cwd(), '.env.local') })

async function debugCaf() {
  const supabase = createAdminClient()
  const restaurantId = '2c8864cd-84a8-4517-b4c1-920b5f6c25f1'

  const { data: caf } = await supabase
    .from('dte_cafs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('document_type', 39)
    .eq('status', 'active')
    .single()

  if (!caf) {
    console.error('No CAF found')
    process.exit(1)
  }

  console.log('CAF record:')
  console.log(`  - ID: ${caf.id}`)
  console.log(`  - Document type: ${caf.document_type}`)
  console.log(`  - Folio desde: ${caf.folio_desde}`)
  console.log(`  - Folio hasta: ${caf.folio_hasta}`)
  console.log(`  - Folio actual: ${caf.folio_actual}`)
  console.log(`  - Status: ${caf.status}`)

  const cafXml = decrypt({
    ciphertext: caf.xml_ciphertext,
    iv: caf.xml_iv,
    authTag: caf.xml_auth_tag,
  }).toString('utf8')

  console.log('\nCAF XML (first 500 chars):')
  console.log(cafXml.substring(0, 500))

  writeFileSync('/tmp/caf_debug.xml', cafXml)
  console.log('\nFull CAF XML written to: /tmp/caf_debug.xml')
}

debugCaf().catch(console.error)
