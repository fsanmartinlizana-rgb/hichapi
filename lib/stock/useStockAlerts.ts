'use client'

/**
 * useStockAlerts — real-time stock alert hook.
 * Validates: Requirements 6.1, 6.2, 6.4, 3.5
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface StockItem {
  id: string
  restaurant_id: string
  name: string
  unit: string
  current_qty: number
  min_qty: number
  cost_per_unit: number
  supplier?: string | null
  category?: string | null
  active: boolean
  expiry_date?: string | null
  shelf_life_days?: number | null
  created_at?: string
  updated_at?: string
}

export interface UseStockAlertsResult {
  alertCount: number
  negativeItems: StockItem[]
  belowMinItems: StockItem[]
  totalInventoryValue: number
  loading: boolean
}

export function useStockAlerts(restaurantId: string): UseStockAlertsResult {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const fetchTokenRef = useRef(0)

  // Initial fetch
  useEffect(() => {
    if (!restaurantId) {
      setItems([])
      setLoading(false)
      return
    }

    const token = ++fetchTokenRef.current
    setLoading(true)

    supabase
      .from('stock_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('active', true)
      .then(({ data, error }) => {
        if (token !== fetchTokenRef.current) return
        if (!error && data) {
          setItems(data as StockItem[])
        }
        setLoading(false)
      })
  }, [restaurantId, supabase])

  // Realtime subscription
  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`stock-alerts:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_items',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload

          if (eventType === 'INSERT') {
            const item = newRecord as StockItem
            if (item.active) {
              setItems((prev) => [...prev, item])
            }
          } else if (eventType === 'UPDATE') {
            const item = newRecord as StockItem
            setItems((prev) => {
              const filtered = prev.filter((i) => i.id !== item.id)
              return item.active ? [...filtered, item] : filtered
            })
          } else if (eventType === 'DELETE') {
            const deleted = oldRecord as { id: string }
            setItems((prev) => prev.filter((i) => i.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, supabase])

  const negativeItems = useMemo(() => items.filter((i) => i.current_qty < 0), [items])
  const belowMinItems = useMemo(
    () => items.filter((i) => i.current_qty >= 0 && i.current_qty <= i.min_qty),
    [items]
  )
  const alertCount = negativeItems.length + belowMinItems.length
  const totalInventoryValue = useMemo(
    () => items.reduce((sum, i) => sum + i.current_qty * i.cost_per_unit, 0),
    [items]
  )

  return { alertCount, negativeItems, belowMinItems, totalInventoryValue, loading }
}
