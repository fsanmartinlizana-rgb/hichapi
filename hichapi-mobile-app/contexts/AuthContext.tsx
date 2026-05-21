/**
 * Authentication context for HiChapi Mobile App.
 * Provides user, session, loading state, login, and logout to the component tree.
 */

import React, { createContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { authService } from '../services/auth/AuthService';
import { apiClient } from '../services/api/APIClient';
import { notificationService } from '../services/notifications/NotificationService';
import { pushTokenManager } from '../services/notifications/PushTokenManager';
import { resolveAppRole } from '../services/customer/roleResolver';
import { registerPushToken } from '../services/customer/api';

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context creation
// ---------------------------------------------------------------------------

export const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // -------------------------------------------------------------------------
  // Restore session on mount and subscribe to auth state changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initialize = async () => {
      try {
        // Restore existing session
        const existingSession = await authService.getSession();
        if (existingSession) {
          setSession(existingSession);
          setUser(existingSession.user);
          apiClient.setAuthToken(existingSession.access_token);
        }
      } catch (error) {
        console.warn('[AuthContext] Failed to restore session:', error);
      } finally {
        setLoading(false);
      }

      // Subscribe to future auth state changes
      unsubscribe = authService.onAuthStateChange((newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession) {
          apiClient.setAuthToken(newSession.access_token);
        } else {
          apiClient.clearAuthToken();
        }
      });
    };

    initialize();

    return () => {
      unsubscribe?.();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  const login = async (email: string, password: string): Promise<void> => {
    const newSession = await authService.login(email, password);
    setSession(newSession);
    setUser(newSession.user);
    apiClient.setAuthToken(newSession.access_token);

    // Register push token — staff vs comensal endpoints
    try {
      const token = await notificationService.registerForPushNotifications();
      if (token && newSession.user?.id) {
        const role = await resolveAppRole(newSession.user.id);
        if (role === 'customer') {
          await registerPushToken(token);
        } else {
          await pushTokenManager.syncTokenToBackend(token, newSession.user.id);
        }
      }
    } catch (error) {
      console.warn('[AuthContext] Push token registration failed:', error);
    }
  };

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  const logout = async (): Promise<void> => {
    await authService.logout();
    setSession(null);
    setUser(null);
    apiClient.clearAuthToken();
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const value: AuthContextValue = {
    user,
    session,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
