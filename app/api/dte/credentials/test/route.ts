export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { spawn } from 'child_process'
import path from 'path'

/**
 * POST /api/dte/credentials/test
 * 
 * Tests if the stored certificate can be read by PHP
 */
export async function POST(req: NextRequest) {
  const { restaurant_id } = await req.json()

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Load credentials
  const { data: creds, error: credsErr } = await supabase
    .from('dte_credentials')
    .select('cert_base64, cert_password')
    .eq('restaurant_id', restaurant_id)
    .maybeSingle()

  if (credsErr || !creds) {
    return NextResponse.json({ error: 'Credentials not found' }, { status: 404 })
  }

  if (!creds.cert_base64 || !creds.cert_password) {
    return NextResponse.json({ 
      error: 'Missing cert_base64 or cert_password',
      has_cert_base64: !!creds.cert_base64,
      has_cert_password: !!creds.cert_password,
    }, { status: 400 })
  }

  // Test with PHP script
  const scriptPath = path.join(process.cwd(), '.kiro/SII/APISII/test_cert_read.php')

  return new Promise((resolve) => {
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
      try {
        // Try to parse the last line as JSON
        const lines = stdout.trim().split('\n')
        const lastLine = lines[lines.length - 1]
        const result = JSON.parse(lastLine)

        resolve(NextResponse.json({
          ok: result.ok || false,
          result,
          stdout: lines.slice(0, -1).join('\n'),
          stderr,
          exit_code: code,
        }))
      } catch (e) {
        resolve(NextResponse.json({
          ok: false,
          error: 'Failed to parse PHP output',
          stdout,
          stderr,
          exit_code: code,
        }))
      }
    })

    // Send credentials to PHP
    phpProcess.stdin.write(JSON.stringify({
      cert_base64: creds.cert_base64,
      cert_password: creds.cert_password,
    }))
    phpProcess.stdin.end()
  })
}
