/**
 * Push token persistence and backend sync manager for HiChapi Mobile App.
 * Stores the Expo push token in AsyncStorage and syncs it to the backend.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/APIClient';
import { ENDPOINTS } from '../api/endpoints';
import { STORAGE_KEYS } from '../../utils/constants';

class PushTokenManager {
  /**
   * Saves the push token to AsyncStorage.
   */
  async saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
  }

  /**
   * Retrieves the stored push token from AsyncStorage.
   * Returns null if no token is stored.
   */
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
  }

  /**
   * Removes the stored push token from AsyncStorage.
   */
  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.PUSH_TOKEN);
  }

  /**
   * Syncs the push token to the backend via PATCH /api/push-tokens.
   * Saves the token locally before syncing.
   */
  async syncTokenToBackend(token: string, userId: string): Promise<void> {
    await this.saveToken(token);
    await apiClient.patch(ENDPOINTS.PUSH_TOKENS, { token, userId });
  }
}

/** Singleton instance of the push token manager. */
export const pushTokenManager = new PushTokenManager();
