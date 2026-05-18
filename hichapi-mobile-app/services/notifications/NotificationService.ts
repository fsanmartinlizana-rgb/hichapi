/**
 * Push notification service for HiChapi Mobile App.
 * Safe for Expo Go — gracefully handles missing native modules.
 */

import * as Notifications from 'expo-notifications';

// Set notification handler only if the module is available
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {
  // expo-notifications not available in this environment
}

class NotificationService {
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  async registerForPushNotifications(): Promise<string | null> {
    try {
      const granted = await this.requestPermissions();
      if (!granted) return null;
      const tokenData = await Notifications.getExpoPushTokenAsync();
      return tokenData.data;
    } catch {
      return null;
    }
  }

  async unregisterPushToken(): Promise<void> {
    try {
      await Notifications.unregisterForNotificationsAsync();
    } catch {
      // Not supported on all platforms
    }
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: data ?? {} },
        trigger: null,
      });
    } catch {
      // Silently fail in Expo Go
    }
  }

  onNotificationReceived(
    callback: (notification: Notifications.Notification) => void
  ): () => void {
    try {
      const subscription = Notifications.addNotificationReceivedListener(callback);
      return () => subscription.remove();
    } catch {
      return () => {};
    }
  }

  onNotificationTapped(
    callback: (response: Notifications.NotificationResponse) => void
  ): () => void {
    try {
      const subscription =
        Notifications.addNotificationResponseReceivedListener(callback);
      return () => subscription.remove();
    } catch {
      return () => {};
    }
  }
}

export const notificationService = new NotificationService();
