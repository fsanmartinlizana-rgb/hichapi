/**
 * lib/delivery/heatmap.service.ts
 *
 * HeatMapService — RPC heatmap_grid call with 60-minute in-memory cache.
 * Requirements: 4.2, 4.3, 4.4, 4.7
 */
import { createAdminClient } from '@/lib/supabase/server'
import type { HeatMapCell, HeatMapFilters, TimeOfDay } from './types'

// ── Time-of-day ranges ────────────────────────────────────────────────────────

const TIME_OF_DAY_RANGES: Record<TimeOfDay, [number, number]> = {
  morning:   [6,  12],
  afternoon: [12, 18],
  evening:   [18, 24],
  night:     [0,   6],
}

// ── In-memory cache (60-minute TTL) ──────────────────────────────────────────

interface CacheEntry {
  data:    HeatMapCell[]
  expires: number
}

const cache = new Map<string, CacheEntry>()

const CACHE_TTL_MS = 60 * 60 * 1000 // 60 minutes

// ── Public API ────────────────────────────────────────────────────────────────

export async function getHeatMapData(filters: HeatMapFilters): Promise<HeatMapCell[]> {
  const cacheKey = JSON.stringify(filters)
  const cached   = cache.get(cacheKey)

  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  const supabase = createAdminClient()

  const [hourFrom, hourTo] = filters.time_of_day
    ? TIME_OF_DAY_RANGES[filters.time_of_day]
    : [null, null]

  const { data, error } = await supabase.rpc('heatmap_grid', {
    p_restaurant_id: filters.restaurant_id ?? null,
    p_days:          filters.days          ?? 30,
    p_hour_from:     hourFrom,
    p_hour_to:       hourTo,
    p_day_of_week:   filters.day_of_week   ?? null,
  })

  if (error) throw new Error(error.message)

  const result = (data ?? []) as HeatMapCell[]
  cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS })
  return result
}

/** Invalidate the entire cache (useful after new deliveries are recorded). */
export function invalidateHeatMapCache(): void {
  cache.clear()
}
