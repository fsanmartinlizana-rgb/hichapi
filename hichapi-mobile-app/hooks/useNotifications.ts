/**
 * Hook for setting up push notification listeners.
 * Subscribes on mount and cleans up on unmount.
 * Handles notification taps by navigating to the relevant screen.
 */

import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { notificationService } from '../services/notifications/NotificationService';
import type { RootStackNavigationProp } from '../types/navigation';

export function useNotifications() {
  const navigation = useNavigation<RootStackNavigationProp>();

  useEffect(() => {
    // Listener: notification received while app is in foreground
    const removeReceivedListener = notificationService.onNotificationReceived(
      (notification) => {
        console.log('[useNotifications] Notification received:', notification.request.identifier);
      }
    );

    // Listener: user tapped a notification
    const removeTappedListener = notificationService.onNotificationTapped(
      (response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;

        if (!data) return;

        // Navigate based on notification data
        if (data.orderId && typeof data.orderId === 'string') {
          // Navigate to order detail
          try {
            (navigation as any).navigate('Main', {
              screen: 'Garzon',
              params: {
                screen: 'OrderDetail',
                params: { orderId: data.orderId as string },
              },
            });
          } catch {
            // Navigation may not be ready — fail silently
          }
        } else if (data.tableId && typeof data.tableId === 'string') {
          // Navigate to table detail
          try {
            (navigation as any).navigate('Main', {
              screen: 'Mesas',
              params: {
                screen: 'TableDetail',
                params: { tableId: data.tableId as string },
              },
            });
          } catch {
            // Navigation may not be ready — fail silently
          }
        } else if (data.type === 'order_confirmed') {
          // Navigate to Comandas board
          try {
            (navigation as any).navigate('Main', {
              screen: 'Comandas',
              params: { screen: 'ComandasBoard' },
            });
          } catch {
            // fail silently
          }
        } else {
          // Default: navigate to Garzón list
          try {
            (navigation as any).navigate('Main', {
              screen: 'Garzon',
              params: { screen: 'GarzonList' },
            });
          } catch {
            // fail silently
          }
        }
      }
    );

    return () => {
      removeReceivedListener();
      removeTappedListener();
    };
  }, [navigation]);
}
