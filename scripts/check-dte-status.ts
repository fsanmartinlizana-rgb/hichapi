#!/usr/bin/env tsx
/**
 * Script to check DTE status in SII
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createAdminClient } from '../lib/supabase/server'
import { decrypt } from '../lib/crypto/aes'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

config({ path: resolve(process.cwd(), '.env.local') })

async function checkDteStatus() {
  const trackId = process.argv[2] || '21621065397' // Use the track ID from last emission
  const restaurantId = '2c8864cd-84a8-4517-b4c1-920b5f6c25f1'

  console.log(`🔍 Checking DTE status for Track ID: ${trackId}\n`)

  const supabase = createAdminClient()

  // Get certificate for authentication
  const { data: cred } = await supabase
    .from('dte_credentials')
    .select('cert_ciphertext, cert_iv, cert_auth_tag, pass_ciphertext, pass_iv, pass_auth_tag')
    .eq('restaurant_id', restaurantId)
    .single()

  if (!cred) {
    console.error('❌ Certificate not found')
    process.exit(1)
  }

  const pfxBuffer = decrypt({
    ciphertext: cred.cert_ciphertext,
    iv: cred.cert_iv,
    authTag: cred.cert_auth_tag,
  })
  const pfxPassword = decrypt({
    ciphertext: cred.pass_ciphertext,
    iv: cred.pass_iv,
    authTag: cred.pass_auth_tag,
  }).toString('utf8')

  const certBase64 = pfxBuffer.toString('base64')

  // Create PHP script call
  const phpInput = {
    rut_emisor: '77042148-9',
    rut_envia: '10089092-5',
    track_id: trackId,
    cert_base64: certBase64,
    cert_password: pfxPassword,
  }

  const { writeFile, unlink } = await import('fs/promises')
  const { tmpdir } = await import('os')
  const { join } = await import('path')
  
  const tempJsonFile = join(tmpdir(), `dte_status_${Date.now()}.json`)
  await writeFile(tempJsonFile, JSON.stringify(phpInput), 'utf8')

  const phpScript = join(process.cwd(), '.kiro/SII/APISII/check_status_api.php')
  const opensslConf = join(process.cwd(), '.kiro/SII/APISII/openssl-legacy.cnf')

  try {
    const { stdout, stderr } = await execAsync(
      `OPENSSL_CONF=${opensslConf} php -d error_reporting=E_ERROR ${phpScript} < ${tempJsonFile}`,
      {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      }
    )

    await unlink(tempJsonFile).catch(() => {})

    if (stderr && !stderr.includes('Deprecated')) {
      console.error('PHP stderr:', stderr)
    }

    console.log('📥 SII Response:\n')
    const result = JSON.parse(stdout)
    console.log(JSON.stringify(result, null, 2))

    if (result.estado) {
      console.log('\n📊 Status Summary:')
      console.log(`   Estado: ${result.estado}`)
      console.log(`   Fecha recepción: ${result.fecha_recepcion || 'N/A'}`)
      
      if (result.detalle_rep_rech && result.detalle_rep_rech.length > 0) {
        console.log('\n⚠️  Detalles:')
        result.detalle_rep_rech.forEach((detalle: any) => {
          console.log(`   - ${detalle.descripcion}`)
          if (detalle.error && detalle.error.length > 0) {
            detalle.error.forEach((err: any) => {
              console.log(`     • ${err.descripcion}: ${err.detalle}`)
            })
          }
        })
      }

      // Interpret status
      console.log('\n📋 Interpretación:')
      switch (result.estado) {
        case 'REC':
          console.log('   ✅ Recibido - El DTE fue recibido por el SII')
          break
        case 'RPR':
          console.log('   🔄 Reparo - El DTE tiene reparos')
          break
        case 'RCH':
          console.log('   ❌ Rechazado - El DTE fue rechazado')
          break
        case 'RSC':
          console.log('   ✅ Recibido con reparos - El DTE fue aceptado con observaciones')
          break
        case 'RFR':
          console.log('   ❌ Rechazado por firma - Problema con la firma digital')
          break
        default:
          console.log(`   ℹ️  Estado: ${result.estado}`)
      }
    }

  } catch (err) {
    await unlink(tempJsonFile).catch(() => {})
    console.error('❌ Error:', (err as Error).message)
    process.exit(1)
  }
}

checkDteStatus().catch(console.error)
