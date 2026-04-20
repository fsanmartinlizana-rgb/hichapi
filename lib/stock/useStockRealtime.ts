'use client'

/**
 * useStockRealtime — keeps a local list of stock_items in sync via Supabase Realtime.
 * Validates: Requirements 6.1, 6.4
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StockItem } from './useStockAlerts'

export interface UseStockRealtimeResult {
  items: StockItem[]
  loading: boolean
  refetch: () => void
}

export function useStockRealtime(restaurantId: string): UseStockRealtimeResult {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const fetchTokenRef = useRef(0)

  const fetchItems = useMemo(
    () => async () => {
      if (!restaurantId) {
        setItems([])
        setLoading(false)
        return
      }

      const token = ++fetchTokenRef.current
      setLoading(true)

      const { data, error } = await supabase
        .from('stock_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .order('category')
        .order('name')

      if (token !== fetchTokenRef.current) return
      if (!error && data) {
        setItems(data as StockItem[])
      }
      setLoading(false)
    },
    [restaurantId, supabase]
  )

  // Initial fetch
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Realtime subscription — update local state immediately on changes
  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`stock-realtime:${restaurantId}`)
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

  return { items, loading, refetch: fetchItems }
}
