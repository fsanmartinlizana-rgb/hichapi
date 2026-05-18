/**
 * Hook for fetching and subscribing to real-time order updates.
 *
 * Fetches the initial list of orders for a restaurant on mount, then
 * subscribes to Supabase Realtime changes and merges them into local state
 * using the pure `applyRealtimeUpdate` reducer.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { orderService } from '../services/orders/OrderService';
import { realtimeService } from '../services/realtime/RealtimeService';
import { applyRealtimeUpdate } from '../utils/realtimeReducer';
import type { Order } from '../types/models';
import type { OrderFilters } from '../types/ui';

interface UseOrdersResult {
  /** Current list of orders for the restaurant. */
  orders: Order[];
  /** True while the initial fetch is in progress. */
  loading: boolean;
  /** Error message if the fetch failed, otherwise null. */
  error: string | null;
  /** Manually re-fetches orders from the API. */
  refetch: () => Promise<void>;
}

/**
 * Fetches orders for `restaurantId` and keeps them in sync via Supabase Realtime.
 *
 * @param restaurantId - The restaurant whose orders to watch.
 * @param filters      - Optional filters applied to the initial fetch.
 */
export function useOrders(
  restaurantId: string,
  filters?: OrderFilters
): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to the active channel so the cleanup effect can
  // unsubscribe without needing the channel in its dependency array.
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await orderService.getOrders(restaurantId, filters);
      setOrders(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch orders';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, filters]);

  useEffect(() => {
    // Initial data fetch
    fetchOrders();

    // Subscribe to realtime updates
    const channel = realtimeService.subscribeToOrders(
      restaurantId,
      (payload) => {
        setOrders((current) => applyRealtimeUpdate(current, payload));
      }
    );
    channelRef.current = channel;

    // Cleanup: unsubscribe when the component unmounts or restaurantId changes
    return () => {
      if (channelRef.current) {
        realtimeService.unsubscribe(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: fetchOrders is intentionally excluded — we only want to re-subscribe
  // when restaurantId changes, not when the filters reference changes.

  return { orders, loading, error, refetch: fetchOrders };
}
