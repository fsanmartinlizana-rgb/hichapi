/**
 * Script to inspect the generated DTE XML and compare with SII requirements
 * 
 * Usage:
 *   npx tsx scripts/inspect-dte-xml.ts <emission_id>
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
} catch (err) {
  console.error('⚠️  Could not load .env.local file')
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  const [emissionId] = process.argv.slice(2)

  if (!emissionId) {
    console.error('Usage: npx tsx scripts/inspect-dte-xml.ts <emission_id>')
    process.exit(1)
  }

  console.log('🔍 Inspecting emission:', emissionId)

  const { data: emission, error: fetchError } = await supabase
    .from('dte_emissions')
    .select('xml_signed, document_type, folio, status, error_detail')
    .eq('id', emissionId)
    .maybeSingle()

  if (fetchError) {
    console.error('❌ Database error:', fetchError)
    process.exit(1)
  }

  if (!emission) {
    console.error('❌ Emission not found')
    console.error('   Tried ID:', emissionId)
    process.exit(1)
  }

  console.log('\n📊 Emission info:')
  console.log('  Document type:', emission.document_type)
  console.log('  Folio:', emission.folio)
  console.log('  Status:', emission.status)
  if (emission.error_detail) {
    console.log('  Error:', emission.error_detail)
  }

  if (!emission.xml_signed) {
    console.error('\n❌ No signed XML found')
    process.exit(1)
  }

  console.log('\n📄 Signed XML length:', emission.xml_signed.length, 'bytes')
  
  // Check encoding declaration
  const encodingMatch = /encoding="([^"]+)"/.exec(emission.xml_signed)
  console.log('  Encoding:', encodingMatch?.[1] ?? 'NOT FOUND')

  // Check root element
  const rootMatch = /<(EnvioBOLETA|EnvioDTE)/.exec(emission.xml_signed)
  console.log('  Root element:', rootMatch?.[1] ?? 'NOT FOUND')

  // Check if TED exists
  const tedMatch = /<TED/.exec(emission.xml_signed)
  console.log('  TED present:', tedMatch ? 'YES' : 'NO')

  // Check if CAF exists in TED
  const cafMatch = /<CAF/.exec(emission.xml_signed)
  console.log('  CAF in TED:', cafMatch ? 'YES' : 'NO')

  // Check signatures
  const sigMatches = emission.xml_signed.match(/<Signature/g)
  console.log('  Signatures found:', sigMatches?.length ?? 0)

  // Extract and display FRMT (TED signature)
  const frmtMatch = /<FRMT[^>]*>([\s\S]*?)<\/FRMT>/.exec(emission.xml_signed)
  if (frmtMatch) {
    const frmt = frmtMatch[1].trim()
    console.log('\n🔐 TED FRMT signature:')
    console.log('  Length:', frmt.length)
    console.log('  Has newlines:', frmt.includes('\n') ? 'YES (BAD)' : 'NO (GOOD)')
    console.log('  First 50 chars:', frmt.slice(0, 50))
  }

  // Extract DD block for inspection
  const ddMatch = /<DD>([\s\S]*?)<\/DD>/.exec(emission.xml_signed)
  if (ddMatch) {
    console.log('\n📋 TED DD block:')
    console.log(ddMatch[0].slice(0, 500))
  }

  // Check SignedInfo format
  const signedInfoMatch = /<SignedInfo[^>]*>([\s\S]*?)<\/SignedInfo>/.exec(emission.xml_signed)
  if (signedInfoMatch) {
    console.log('\n🔏 First SignedInfo:')
    console.log(signedInfoMatch[0].slice(0, 400))
  }

  // Write full XML to file for inspection
  const { writeFileSync } = await import('fs')
  const outputPath = `/tmp/dte_emission_${emissionId}.xml`
  writeFileSync(outputPath, emission.xml_signed)
  console.log('\n💾 Full XML written to:', outputPath)
  console.log('\nYou can validate it at: https://www4.sii.cl/consdcvinternetui/#/validar')
}

main().catch(console.error)
