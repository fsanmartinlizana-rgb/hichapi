/**
 * Session persistence manager for HiChapi Mobile App.
 * Uses AsyncStorage (works in Expo Go).
 * For production builds, swap to expo-secure-store for encryption.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';

const SESSION_KEY = '@hichapi:session';

class SessionManager {
  async saveSession(session: Session): Promise<void> {
    try {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      throw new Error(
        `SessionManager: failed to save session — ${(error as Error).message}`
      );
    }
  }

  async getSession(): Promise<Session | null> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }

  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (error) {
      throw new Error(
        `SessionManager: failed to clear session — ${(error as Error).message}`
      );
    }
  }

  async hasValidSession(): Promise<boolean> {
    const session = await this.getSession();
    if (!session) return false;

    const expiresAt = session.expires_at;
    if (typeof expiresAt !== 'number') return false;

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const bufferSeconds = 60;

    return expiresAt > nowInSeconds + bufferSeconds;
  }
}

export const sessionManager = new SessionManager();
