/**
 * Offline queue for HiChapi Mobile App.
 * Queues failed write operations and retries them when connectivity is restored.
 * Persists the queue to AsyncStorage so it survives app restarts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../utils/constants';
import { logError } from '../../utils/errorLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueuedOperation {
  id: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  data?: unknown;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// OfflineQueue class
// ---------------------------------------------------------------------------

class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private loaded = false;

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      this.queue = raw ? (JSON.parse(raw) as QueuedOperation[]) : [];
    } catch {
      this.queue = [];
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.OFFLINE_QUEUE,
        JSON.stringify(this.queue)
      );
    } catch (error) {
      logError(error, { action: 'offline_queue_persist' });
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Adds a failed operation to the queue for later retry.
   */
  async enqueue(
    method: QueuedOperation['method'],
    endpoint: string,
    data?: unknown,
    maxRetries = 3
  ): Promise<void> {
    await this.load();
    const operation: QueuedOperation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      method,
      endpoint,
      data,
      retryCount: 0,
      maxRetries,
      createdAt: new Date().toISOString(),
    };
    this.queue.push(operation);
    await this.persist();
  }

  /**
   * Returns all pending operations in the queue.
   */
  async getQueue(): Promise<QueuedOperation[]> {
    await this.load();
    return [...this.queue];
  }

  /**
   * Returns the number of pending operations.
   */
  async size(): Promise<number> {
    await this.load();
    return this.queue.length;
  }

  /**
   * Removes a successfully processed operation from the queue.
   */
  async remove(operationId: string): Promise<void> {
    await this.load();
    this.queue = this.queue.filter((op) => op.id !== operationId);
    await this.persist();
  }

  /**
   * Increments the retry count for an operation.
   * Removes it if max retries exceeded.
   */
  async incrementRetry(operationId: string): Promise<void> {
    await this.load();
    const op = this.queue.find((o) => o.id === operationId);
    if (!op) return;

    op.retryCount += 1;
    if (op.retryCount >= op.maxRetries) {
      this.queue = this.queue.filter((o) => o.id !== operationId);
      logError(new Error(`Operation ${operationId} exceeded max retries`), {
        action: 'offline_queue_max_retries',
        endpoint: op.endpoint,
      });
    }
    await this.persist();
  }

  /**
   * Clears all operations from the queue.
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.persist();
  }
}

/** Singleton instance of the offline queue. */
export const offlineQueue = new OfflineQueue();
