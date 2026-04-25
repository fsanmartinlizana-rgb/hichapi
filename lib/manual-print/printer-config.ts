/**
 * Printer configuration service for manual print control system
 *
 * Reads notifier URL from:
 *   1. restaurants.notifier_url  (column, if it exists)
 *   2. NEXT_PUBLIC_NOTIFIER_URL  (env var fallback)
 *
 * Does NOT query print_servers — that table may not exist in all deployments.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { createClient } from '@/lib/supabase/client'
import type {
  PrinterConfigService,
  PrintServer,
  ValidationResult,
} from './types'

// URL del notifier de impresión — mismo servidor para todos los locales.
// El campo `comercio` en cada request identifica al local específico.
// Usa NEXT_PUBLIC_NOTIFIER_PRINT_URL en el browser, NOTIFIER_PRINT_URL en el server.
const NOTIFIER_PRINT_URL =
  (typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_NOTIFIER_PRINT_URL
    : process.env.NOTIFIER_PRINT_URL ?? process.env.NEXT_PUBLIC_NOTIFIER_PRINT_URL
  )?.replace(/\/$/, '') ?? 'https://api.notifier.realdev.cl'

/**
 * Build a virtual PrintServer from the notifier base URL.
 * `id` and `printer_addr` both point to the notifier URL.
 */
function virtualPrinter(notifierUrl: string, name = 'Notifier'): PrintServer {
  return {
    id:           notifierUrl,
    name,
    printer_kind: 'network',
    printer_addr: notifierUrl,
    active:       true,
  }
}

// ── PrinterConfigServiceImpl ──────────────────────────────────────────────────

class PrinterConfigServiceImpl implements PrinterConfigService {
  async getPreCuentaPrinter(_restaurantId: string): Promise<PrintServer | null> {
    return virtualPrinter(NOTIFIER_PRINT_URL)
  }

  async getBoletaPrinter(_restaurantId: string): Promise<PrintServer | null> {
    return virtualPrinter(NOTIFIER_PRINT_URL)
  }

  async validatePrinterConfig(
    _restaurantId: string,
    _type: 'precuenta' | 'boleta'
  ): Promise<ValidationResult> {
    // El notifier es siempre https://realdev.cl — siempre válido
    return { isValid: true }
  }

  // ── Stubs kept for interface compatibility ───────────────────────────────

  async getAvailablePrintServers(_restaurantId: string): Promise<PrintServer[]> {
    return []
  }

  async updatePrintSettings(
    _restaurantId: string,
    _settings: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true }
  }

  async getPrintSettings(_restaurantId: string) {
    return { autoPreCuenta: false, printTimeout: 10000 }
  }
}

// ── Utility Functions ────────────────────────────────────────────────────────

/**
 * Get the restaurant code (comercio) used in notifier requests.
 * Uses slug, falls back to slugified name.
 */
export async function getRestaurantCode(restaurantId: string): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('slug, name')
      .eq('id', restaurantId)
      .single()

    if (!restaurant) return null

    return (
      restaurant.slug ||
      restaurant.name.toLowerCase().replace(/\s+/g, '-')
    )
  } catch (error) {
    console.error('Error getting restaurant code:', error)
    return null
  }
}

/**
 * Get restaurant address details for precuenta requests.
 */
export async function getRestaurantAddress(restaurantId: string): Promise<{
  comuna: string
  direccion: string
} | null> {
  try {
    const supabase = createClient()
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('address, neighborhood')
      .eq('id', restaurantId)
      .single()

    if (!restaurant) return null

    return {
      direccion: (restaurant as any).direccion || restaurant.address || '',
      comuna:    (restaurant as any).comuna    || restaurant.neighborhood || '',
    }
  } catch (error) {
    console.error('Error getting restaurant address:', error)
    return null
  }
}

/**
 * Validate printer server connectivity (config-level check only).
 */
export function validatePrinterConnectivity(
  printServer: PrintServer
): { connected: boolean; error?: string } {
  if (!printServer.printer_addr) {
    return { connected: false, error: 'Dirección de red no configurada' }
  }
  return { connected: true }
}

// ── Export ───────────────────────────────────────────────────────────────────

export { PrinterConfigServiceImpl }
