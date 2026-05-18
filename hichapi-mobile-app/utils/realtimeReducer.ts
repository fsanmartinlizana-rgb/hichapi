/**
 * Pure reducer for applying Supabase Realtime payloads to a local Order array.
 *
 * This utility is intentionally side-effect-free so it can be used in both
 * React state updates and property-based tests.
 */

import type { Order } from '../types/models';
import type { RealtimePayload } from '../services/realtime/RealtimeService';

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Apply a single realtime payload to the current order state array.
 *
 * - **INSERT**: Adds the order if an order with the same `id` is not already
 *   present. If it is already present the state is returned unchanged
 *   (idempotent).
 * - **UPDATE**: Replaces the order whose `id` matches `payload.new.id`.
 *   If no matching order exists the new order is appended.
 * - **DELETE**: Removes the order whose `id` matches `payload.old.id`.
 *   If no matching order exists the state is returned unchanged.
 *
 * @param state   - Current array of orders.
 * @param payload - Realtime change payload from Supabase.
 * @returns A new array reflecting the applied change.
 */
export function applyRealtimeUpdate(
  state: Order[],
  payload: RealtimePayload<Order>
): Order[] {
  switch (payload.eventType) {
    case 'INSERT': {
      const alreadyPresent = state.some((o) => o.id === payload.new.id);
      if (alreadyPresent) {
        return state;
      }
      return [...state, payload.new];
    }

    case 'UPDATE': {
      const exists = state.some((o) => o.id === payload.new.id);
      if (exists) {
        return state.map((o) => (o.id === payload.new.id ? payload.new : o));
      }
      // Order not yet in local state — treat as an implicit insert
      return [...state, payload.new];
    }

    case 'DELETE': {
      const deletedId = (payload.old as Partial<Order>).id;
      if (!deletedId) {
        return state;
      }
      return state.filter((o) => o.id !== deletedId);
    }

    default:
      return state;
  }
}
