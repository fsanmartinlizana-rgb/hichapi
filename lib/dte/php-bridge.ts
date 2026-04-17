/**
 * PHP Bridge for SII DTE operations
 * 
 * This module provides a bridge to execute PHP scripts that handle
 * DTE emission and status checking using LibreDTE.
 */

import { spawn } from 'child_process'
import path from 'path'

// ══════════════════════════════════════════════════════════════════════════════
//  Types
// ══════════════════════════════════════════════════════════════════════════════

export interface PhpEmitInput {
  cert_base64: string
  cert_password: string
  caf_xml: string
  document_type: number
  folio: number
  fecha_emision: string
  rut_emisor: string
  razon_social: string
  rut_envia: string
  rut_receptor?: string
  razon_receptor?: string
  giro?: string
  direccion?: string
  comuna?: string
  fecha_resolucion?: string
  numero_resolucion?: number
  items: Array<{
    name: string
    quantity: number
    unit_price: number
  }>
}

export interface PhpEmitOutput {
  ok: true
  trackid: string
  estado: string | null
  xml_file: string
}

export interface PhpEmitError {
  error: string
  message?: string
  response?: unknown
  xml_file?: string
  openssl_errors?: string[]
  cert_size?: number
  php_version?: string
  openssl_version?: string
}

export interface PhpStatusInput {
  cert_base64: string
  cert_password: string
  rut_emisor: string
  track_id: string
}

export interface PhpStatusOutput {
  estadistica?: Array<{
    aceptados?: number
    rechazados?: number
    reparos?: number
  }>
  detalle?: string
  error?: string
  message?: string
}

// ══════════════════════════════════════════════════════════════════════════════
//  PHP Script Execution
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a PHP script with JSON input via stdin
 */
async function executePHP<TInput, TOutput>(
  scriptPath: string,
  input: TInput,
  timeoutMs = 30000
): Promise<TOutput> {
  return new Promise((resolve, reject) => {
    const phpProcess = spawn('php', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timeout = setTimeout(() => {
      timedOut = true
      phpProcess.kill('SIGTERM')
      reject(new Error('PHP_TIMEOUT: Script execution exceeded timeout'))
    }, timeoutMs)

    phpProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    phpProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    phpProcess.on('close', (code) => {
      clearTimeout(timeout)

      if (timedOut) {
        return
      }

      // Try to parse JSON from stdout
      try {
        const result = JSON.parse(stdout)
        
        // Check if result contains an error
        if (result.error) {
          reject(new Error(`PHP_ERROR: ${result.error} - ${result.message || ''}`))
        } else {
          resolve(result as TOutput)
        }
      } catch (parseError) {
        // If JSON parsing fails, return raw output for debugging
        reject(
          new Error(
            `PHP_PARSE_ERROR: Failed to parse PHP output. Exit code: ${code}\nStdout: ${stdout}\nStderr: ${stderr}`
          )
        )
      }
    })

    phpProcess.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`PHP_SPAWN_ERROR: ${err.message}`))
    })

    // Send input as JSON to stdin
    phpProcess.stdin.write(JSON.stringify(input))
    phpProcess.stdin.end()
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  Public API
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Emit a DTE using the PHP bridge
 */
export async function emitDteViaPHP(
  input: PhpEmitInput
): Promise<PhpEmitOutput | PhpEmitError> {
  const scriptPath = path.join(process.cwd(), '.kiro/SII/APISII/emit_dte_api.php')
  
  try {
    const result = await executePHP<PhpEmitInput, PhpEmitOutput>(
      scriptPath,
      input,
      60000 // 60 second timeout for emission
    )
    return result
  } catch (error) {
    console.error('PHP Bridge emit error:', error)
    
    // Try to extract error details from the error message
    if (error instanceof Error) {
      const match = error.message.match(/PHP_ERROR: (\w+) - (.*)/)
      if (match) {
        return {
          error: match[1],
          message: match[2],
        }
      }
      
      return {
        error: 'PHP_BRIDGE_ERROR',
        message: error.message,
      }
    }
    
    return {
      error: 'UNKNOWN_ERROR',
      message: String(error),
    }
  }
}

/**
 * Check DTE status using the PHP bridge
 */
export async function checkDteStatusViaPHP(
  input: PhpStatusInput
): Promise<PhpStatusOutput> {
  const scriptPath = path.join(process.cwd(), '.kiro/SII/APISII/check_status_api.php')
  
  try {
    const result = await executePHP<PhpStatusInput, PhpStatusOutput>(
      scriptPath,
      input,
      30000 // 30 second timeout for status check
    )
    return result
  } catch (error) {
    console.error('PHP Bridge status check error:', error)
    
    if (error instanceof Error) {
      return {
        error: 'PHP_BRIDGE_ERROR',
        message: error.message,
      }
    }
    
    return {
      error: 'UNKNOWN_ERROR',
      message: String(error),
    }
  }
}
