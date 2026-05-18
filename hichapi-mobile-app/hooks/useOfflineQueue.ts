/**
 * Hook for monitoring network state and flushing the offline queue on reconnect.
 * Uses NetInfo to detect connectivity changes.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { offlineQueue } from '../services/storage/OfflineQueue';
import { apiClient } from '../services/api/APIClient';
import { logError, logInfo } from '../utils/errorLogger';

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(true);
  const [isFlushing, setIsFlushing] = useState(false);
  const wasOfflineRef = useRef(false);

  const flushQueue = useCallback(async () => {
    const pending = await offlineQueue.getQueue();
    if (pending.length === 0) return;

    setIsFlushing(true);
    logInfo(`Flushing ${pending.length} queued operations`, { action: 'offline_queue_flush' });

    for (const op of pending) {
      try {
        if (op.method === 'POST') {
          await apiClient.post(op.endpoint, op.data);
        } else if (op.method === 'PATCH') {
          await apiClient.patch(op.endpoint, op.data);
        } else if (op.method === 'DELETE') {
          await apiClient.delete(op.endpoint);
        }
        await offlineQueue.remove(op.id);
      } catch (error) {
        logError(error, { action: 'offline_queue_retry', endpoint: op.endpoint });
        await offlineQueue.incrementRetry(op.id);
      }
    }

    setIsFlushing(false);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);

      // Flush queue when transitioning from offline → online
      if (online && wasOfflineRef.current) {
        flushQueue();
      }

      wasOfflineRef.current = !online;
    });

    return () => unsubscribe();
  }, [flushQueue]);

  return { isOnline, isFlushing, flushQueue };
}
