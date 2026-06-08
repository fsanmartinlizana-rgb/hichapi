/**
 * Authentication service for HiChapi Mobile App.
 * Wraps Supabase Auth methods and provides a clean interface for login,
 * logout, session management, and password operations.
 */

import { supabase } from '../../config/supabase';
import type { Session, User } from '@supabase/supabase-js';

class AuthService {
  /**
   * Signs in a user with email and password.
   * @throws Error with descriptive message on failure.
   */
  async login(email: string, password: string): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(`Login failed: ${error.message}`);
    }

    if (!data.session) {
      throw new Error('Login failed: no session returned');
    }

    return data.session;
  }

  /**
   * Signs out the current user and clears the local session.
   * @throws Error with descriptive message on failure.
   */
  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Returns the current active session, or null if not authenticated.
   * @throws Error with descriptive message on failure.
   */
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(`Failed to retrieve session: ${error.message}`);
    }

    return data.session;
  }

  /**
   * Refreshes the current session and returns the updated session.
   * @throws Error if the session cannot be refreshed.
   */
  async refreshSession(): Promise<Session> {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      throw new Error(`Session refresh failed: ${error.message}`);
    }

    if (!data.session) {
      throw new Error('Session refresh failed: no session returned');
    }

    return data.session;
  }

  /**
   * Sends a password recovery email to the given address.
   * @throws Error with descriptive message on failure.
   */
  async recoverPassword(email: string): Promise<void> {
    const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    
    const response = await fetch(`${apiUrl}/api/auth/recover-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      let errorMessage = 'Error al enviar instrucciones';
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage = errorData.error;
      } catch (e) {
        // Fallback to default message
      }
      throw new Error(`Password recovery failed: ${errorMessage}`);
    }
  }

  /**
   * Updates the authenticated user's password.
   * @throws Error with descriptive message on failure.
   */
  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      throw new Error(`Password update failed: ${error.message}`);
    }
  }

  /**
   * Returns the currently authenticated user from the in-memory session cache,
   * or null if no user is signed in.
   *
   * Note: This is a synchronous read of the cached state. For a guaranteed
   * fresh value, call `getSession()` instead.
   */
  getCurrentUser(): User | null {
    // supabase.auth exposes the cached user via the internal session.
    // We access it through the synchronous `getUser` workaround by reading
    // the session from the in-memory store.
    const session = (supabase.auth as unknown as { currentSession?: Session })
      .currentSession;
    return session?.user ?? null;
  }

  /**
   * Subscribes to authentication state changes.
   * @param callback - Called with the new session (or null on logout).
   * @returns Unsubscribe function to clean up the listener.
   */
  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });

    return () => subscription.unsubscribe();
  }
}

/** Singleton instance of the authentication service. */
export const authService = new AuthService();
