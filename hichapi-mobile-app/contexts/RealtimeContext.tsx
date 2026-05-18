/**
 * Realtime context for HiChapi Mobile App.
 * Provides the current Supabase Realtime connection state to the component tree.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { realtimeService } from '../services/realtime/RealtimeService';

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

export interface RealtimeContextValue {
  connectionState: 'connected' | 'disconnected' | 'connecting';
}

// ---------------------------------------------------------------------------
// Context creation
// ---------------------------------------------------------------------------

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

interface RealtimeProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the component tree and polls the `realtimeService` connection state,
 * making it available to any descendant via `useRealtimeContext`.
 */
export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const [connectionState, setConnectionState] = useState<
    'connected' | 'disconnected' | 'connecting'
  >(realtimeService.getConnectionState());

  useEffect(() => {
    // Poll the service's connection state every second.
    // Supabase Realtime does not expose a direct state-change callback on the
    // client level (only per-channel), so polling is the simplest approach
    // that avoids coupling the context to specific channel subscriptions.
    const interval = setInterval(() => {
      const current = realtimeService.getConnectionState();
      setConnectionState((prev) => (prev !== current ? current : prev));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const value: RealtimeContextValue = { connectionState };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Consume the RealtimeContext. Must be used within a `RealtimeProvider`.
 */
export function useRealtimeContext(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtimeContext must be used within a RealtimeProvider');
  }
  return context;
}
