/**
 * Script to test if certificate can be read by PHP
 * Run with: npx tsx scripts/test-cert.ts <restaurant_id>
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { spawn } from 'child_process'
import path from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testCert(restaurantId: string) {
  console.log(`🔍 Testing certificate for restaurant: ${restaurantId}\n`)

  // Load credentials
  const { data: creds, error: credsErr } = await supabase
    .from('dte_credentials')
    .select('cert_base64, cert_password, cert_subject, cert_valid_to')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (credsErr || !creds) {
    console.error('❌ Credentials not found:', credsErr)
    process.exit(1)
  }

  console.log('Certificate info:')
  console.log('  Subject:', creds.cert_subject)
  console.log('  Valid to:', creds.cert_valid_to)
  console.log('  Has cert_base64:', !!creds.cert_base64)
  console.log('  Has cert_password:', !!creds.cert_password)
  
  if (creds.cert_base64) {
    console.log('  cert_base64 length:', creds.cert_base64.length)
    console.log('  cert_base64 preview:', creds.cert_base64.substring(0, 50) + '...')
  }
  
  console.log('')

  if (!creds.cert_base64 || !creds.cert_password) {
    console.error('❌ Missing cert_base64 or cert_password')
    console.log('\n💡 You need to re-upload the certificate from the DTE interface')
    process.exit(1)
  }

  // Test with PHP
  console.log('Testing with PHP...\n')

  const scriptPath = path.join(process.cwd(), '.kiro/SII/APISII/test_cert_read.php')

  const phpProcess = spawn('php', [scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''

  phpProcess.stdout.on('data', (data) => {
    stdout += data.toString()
  })

  phpProcess.stderr.on('data', (data) => {
    stderr += data.toString()
  })

  phpProcess.on('close', (code) => {
    console.log('PHP Output:')
    console.log(stdout)
    
    if (stderr) {
      console.log('\nPHP Errors:')
      console.log(stderr)
    }

    console.log('\nExit code:', code)

    if (code === 0) {
      console.log('\n✅ Certificate can be read successfully!')
    } else {
      console.log('\n❌ Failed to read certificate')
      console.log('\n💡 Try re-uploading the certificate with the correct password')
    }
  })

  // Send credentials to PHP
  phpProcess.stdin.write(JSON.stringify({
    cert_base64: creds.cert_base64,
    cert_password: creds.cert_password,
  }))
  phpProcess.stdin.end()
}

const restaurantId = process.argv[2]

if (!restaurantId) {
  console.error('❌ Usage: npx tsx scripts/test-cert.ts <restaurant_id>')
  process.exit(1)
}

testCert(restaurantId).catch(console.error)
