/**
 * Generic hook for subscribing to Supabase Realtime postgres_changes events.
 * Subscribes on mount and unsubscribes on unmount.
 */

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import type { RealtimePayload } from '../services/realtime/RealtimeService';
import { realtimeService } from '../services/realtime/RealtimeService';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to realtime changes for a given table and filter.
 *
 * @param channelName - Unique name for the channel (e.g. `orders:restaurant-1`).
 * @param table       - Database table to watch (e.g. `orders`).
 * @param filter      - PostgREST filter string (e.g. `restaurant_id=eq.abc`).
 * @param callback    - Called with the realtime payload on every change.
 * @returns `{ connected }` — whether the channel is currently subscribed.
 */
export function useRealtime<T>(
  channelName: string,
  table: string,
  filter: string,
  callback: (payload: RealtimePayload<T>) => void
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Keep a stable ref to the callback so the effect doesn't re-run on every render
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    // Create the channel directly via supabase so we can track status independently
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        (rawPayload: any) => {
          const payload: RealtimePayload<T> = {
            eventType: rawPayload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: rawPayload.new as T,
            old: rawPayload.old as Partial<T>,
          };
          callbackRef.current(payload);
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, filter]);

  return { connected };
}
