/**
 * Update emission error details by querying SII
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const envFile = readFileSync(envPath, 'utf8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      process.env[key] = value
    }
  })
} catch {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  const emissionId = '0572e606-2f58-44b7-a93f-370da5830748'
  
  console.log('Updating emission with detailed error...')
  
  const { error } = await supabase
    .from('dte_emissions')
    .update({
      error_detail: 'Error 505: Firma DTE Incorrecta (Rechaza DTE)'
    })
    .eq('id', emissionId)
  
  if (error) {
    console.error('Error updating:', error)
  } else {
    console.log('✅ Updated successfully')
  }
}

main().catch(console.error)
