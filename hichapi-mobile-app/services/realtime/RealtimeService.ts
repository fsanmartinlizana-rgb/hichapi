/**
 * Singleton Supabase Realtime service for HiChapi Mobile App.
 * Manages WebSocket subscriptions to database changes for orders and tables.
 */

import { supabase } from '../../config/supabase';
import type { Order, Table } from '../../types/models';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RealtimePayload<T> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: Partial<T>;
};

type ConnectionState = 'connected' | 'disconnected' | 'connecting';

// ---------------------------------------------------------------------------
// RealtimeService class
// ---------------------------------------------------------------------------

class RealtimeService {
  private static instance: RealtimeService;

  /** Active channels keyed by channel name */
  private channels: Map<string, RealtimeChannel> = new Map();

  /** Current WebSocket connection state */
  private connectionState: ConnectionState = 'disconnected';

  // -------------------------------------------------------------------------
  // Singleton accessor
  // -------------------------------------------------------------------------

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  // -------------------------------------------------------------------------
  // Task 7.2 — Subscribe to orders table changes
  // -------------------------------------------------------------------------

  /**
   * Subscribe to all changes on the `orders` table filtered by `restaurant_id`.
   *
   * @param restaurantId - The restaurant whose orders to watch.
   * @param callback     - Called with the realtime payload on every change.
   * @returns The underlying RealtimeChannel (can be passed to `unsubscribe`).
   */
  subscribeToOrders(
    restaurantId: string,
    callback: (payload: RealtimePayload<Order>) => void
  ): RealtimeChannel {
    const channelName = `orders:${restaurantId}`;
    return this._subscribe<Order>(channelName, 'orders', `restaurant_id=eq.${restaurantId}`, callback);
  }

  // -------------------------------------------------------------------------
  // Task 7.3 — Subscribe to tables table changes
  // -------------------------------------------------------------------------

  /**
   * Subscribe to all changes on the `tables` table filtered by `restaurant_id`.
   *
   * @param restaurantId - The restaurant whose tables to watch.
   * @param callback     - Called with the realtime payload on every change.
   * @returns The underlying RealtimeChannel.
   */
  subscribeToTables(
    restaurantId: string,
    callback: (payload: RealtimePayload<Table>) => void
  ): RealtimeChannel {
    const channelName = `tables:${restaurantId}`;
    return this._subscribe<Table>(channelName, 'tables', `restaurant_id=eq.${restaurantId}`, callback);
  }

  // -------------------------------------------------------------------------
  // Task 7.4 — Unsubscribe methods
  // -------------------------------------------------------------------------

  /**
   * Unsubscribe a single channel and remove it from the internal map.
   *
   * @param channel - The RealtimeChannel returned by a subscribe call.
   */
  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await channel.unsubscribe();

    // Remove from internal map by searching for the matching channel reference
    for (const [name, stored] of this.channels.entries()) {
      if (stored === channel) {
        this.channels.delete(name);
        break;
      }
    }

    if (this.channels.size === 0) {
      this.connectionState = 'disconnected';
    }
  }

  /**
   * Unsubscribe all active channels and reset connection state.
   */
  async unsubscribeAll(): Promise<void> {
    const unsubscribePromises: Promise<void>[] = [];

    for (const channel of this.channels.values()) {
      unsubscribePromises.push(
        channel.unsubscribe().then(() => {
          // individual cleanup handled below
        })
      );
    }

    await Promise.all(unsubscribePromises);
    this.channels.clear();
    this.connectionState = 'disconnected';
  }

  // -------------------------------------------------------------------------
  // Connection state accessor
  // -------------------------------------------------------------------------

  /**
   * Returns the current WebSocket connection state.
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Internal helper that creates (or reuses) a channel and attaches a
   * `postgres_changes` listener.
   */
  private _subscribe<T>(
    channelName: string,
    table: string,
    filter: string,
    callback: (payload: RealtimePayload<T>) => void
  ): RealtimeChannel {
    // Reuse existing channel if already subscribed
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    this.connectionState = 'connecting';

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
          callback(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.connectionState = 'connected';
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.connectionState = 'disconnected';
        }
      });

    this.channels.set(channelName, channel);
    return channel;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const realtimeService = RealtimeService.getInstance();
