/**
 * Unit tests for NotificationService.
 * Mocks expo-notifications (already mocked in jest.setup.ts).
 */

import * as Notifications from 'expo-notifications';

// ---------------------------------------------------------------------------
// Additional mock setup
// ---------------------------------------------------------------------------

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: { eas: { projectId: 'test-project-id' } },
    },
  },
}));

// ---------------------------------------------------------------------------
// Import service AFTER mocks
// ---------------------------------------------------------------------------

import { notificationService } from '../../services/notifications/NotificationService';

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// requestPermissions
// ---------------------------------------------------------------------------

describe('NotificationService.requestPermissions()', () => {
  it('returns true when status is "granted"', async () => {
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      expires: 'never',
      canAskAgain: true,
    });

    const result = await notificationService.requestPermissions();
    expect(result).toBe(true);
  });

  it('returns false when status is "denied"', async () => {
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
      granted: false,
      expires: 'never',
      canAskAgain: false,
    });

    const result = await notificationService.requestPermissions();
    expect(result).toBe(false);
  });

  it('returns false when status is "undetermined"', async () => {
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
      granted: false,
      expires: 'never',
      canAskAgain: true,
    });

    const result = await notificationService.requestPermissions();
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// registerForPushNotifications
// ---------------------------------------------------------------------------

describe('NotificationService.registerForPushNotifications()', () => {
  it('returns null when permissions are denied', async () => {
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
      granted: false,
      expires: 'never',
      canAskAgain: false,
    });

    const result = await notificationService.registerForPushNotifications();
    expect(result).toBeNull();
  });

  it('returns token string when permissions are granted', async () => {
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      expires: 'never',
      canAskAgain: true,
    });
    (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[test-token-abc123]',
      type: 'expo',
    });

    const result = await notificationService.registerForPushNotifications();
    expect(result).toBe('ExponentPushToken[test-token-abc123]');
  });

  it('returns null when getExpoPushTokenAsync throws', async () => {
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      expires: 'never',
      canAskAgain: true,
    });
    (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(
      new Error('Token fetch failed')
    );

    const result = await notificationService.registerForPushNotifications();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// onNotificationReceived
// ---------------------------------------------------------------------------

describe('NotificationService.onNotificationReceived()', () => {
  it('calls the callback when a notification is received', () => {
    const mockRemove = jest.fn();
    const mockSubscription = { remove: mockRemove };
    let capturedListener: ((n: Notifications.Notification) => void) | null = null;

    (mockNotifications.addNotificationReceivedListener as jest.Mock).mockImplementation(
      (listener) => {
        capturedListener = listener;
        return mockSubscription;
      }
    );

    const callback = jest.fn();
    notificationService.onNotificationReceived(callback);

    // Simulate a notification being received
    const fakeNotification = {
      request: {
        identifier: 'notif-1',
        content: { title: 'New Order', body: 'Mesa 5 has a new order', data: {} },
        trigger: null,
      },
      date: Date.now(),
    } as unknown as Notifications.Notification;

    capturedListener!(fakeNotification);

    expect(callback).toHaveBeenCalledWith(fakeNotification);
  });

  it('returns a cleanup function that removes the listener', () => {
    const mockRemove = jest.fn();
    const mockSubscription = { remove: mockRemove };

    (mockNotifications.addNotificationReceivedListener as jest.Mock).mockReturnValue(
      mockSubscription
    );

    const cleanup = notificationService.onNotificationReceived(jest.fn());

    expect(typeof cleanup).toBe('function');
    cleanup();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// onNotificationTapped
// ---------------------------------------------------------------------------

describe('NotificationService.onNotificationTapped()', () => {
  it('calls the callback when a notification is tapped', () => {
    const mockRemove = jest.fn();
    const mockSubscription = { remove: mockRemove };
    let capturedListener: ((r: Notifications.NotificationResponse) => void) | null = null;

    (mockNotifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
      (listener) => {
        capturedListener = listener;
        return mockSubscription;
      }
    );

    const callback = jest.fn();
    notificationService.onNotificationTapped(callback);

    const fakeResponse = {
      notification: {
        request: {
          identifier: 'notif-2',
          content: { title: 'Order Paying', body: 'Mesa 3 wants to pay', data: { type: 'order_paying' } },
          trigger: null,
        },
        date: Date.now(),
      },
      actionIdentifier: 'default',
    } as unknown as Notifications.NotificationResponse;

    capturedListener!(fakeResponse);

    expect(callback).toHaveBeenCalledWith(fakeResponse);
  });

  it('returns a cleanup function that removes the listener', () => {
    const mockRemove = jest.fn();
    const mockSubscription = { remove: mockRemove };

    (mockNotifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue(
      mockSubscription
    );

    const cleanup = notificationService.onNotificationTapped(jest.fn());

    expect(typeof cleanup).toBe('function');
    cleanup();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
