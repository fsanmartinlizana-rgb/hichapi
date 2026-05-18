/**
 * Integration Tests: RealtimeService
 *
 * Tests the RealtimeService methods using a mocked Supabase channel.
 * Covers subscribeToOrders, subscribeToTables, unsubscribe, and unsubscribeAll.
 */

import type { RealtimePayload } from '../../services/realtime/RealtimeService';
import type { Order, Table } from '../../types/models';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../config/supabase', () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Import service AFTER mocks are set up
// ---------------------------------------------------------------------------

// We need a fresh singleton for each test suite, so we reset the module
// registry before importing.
let realtimeService: typeof import('../../services/realtime/RealtimeService').realtimeService;
let RealtimeServiceModule: typeof import('../../services/realtime/RealtimeService');

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Reset mock implementations
  mockChannel.on.mockReturnThis();
  mockChannel.subscribe.mockReturnThis();
  mockChannel.unsubscribe.mockResolvedValue(undefined);
});

beforeAll(async () => {
  RealtimeServiceModule = await import('../../services/realtime/RealtimeService');
  realtimeService = RealtimeServiceModule.realtimeService;
});

// ---------------------------------------------------------------------------
// subscribeToOrders()
// ---------------------------------------------------------------------------

describe('RealtimeService.subscribeToOrders()', () => {
  it('creates a channel with the correct name "orders:{restaurantId}"', () => {
    const { supabase } = require('../../config/supabase');
    const restaurantId = 'restaurant-abc';

    realtimeService.subscribeToOrders(restaurantId, jest.fn());

    expect(supabase.channel).toHaveBeenCalledWith(`orders:${restaurantId}`);
  });

  it('calls .on("postgres_changes", ...) with the correct filter', () => {
    const restaurantId = 'restaurant-xyz';
    const callback = jest.fn();

    realtimeService.subscribeToOrders(restaurantId, callback);

    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }),
      expect.any(Function)
    );
  });

  it('calls .subscribe() to activate the channel', () => {
    const restaurantId = 'restaurant-subscribe-test';

    realtimeService.subscribeToOrders(restaurantId, jest.fn());

    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('invokes the callback with a typed payload when a change event fires', () => {
    const restaurantId = 'restaurant-callback-test';
    const callback = jest.fn<void, [RealtimePayload<Order>]>();

    realtimeService.subscribeToOrders(restaurantId, callback);

    // Capture the raw listener registered with .on()
    const rawListener = mockChannel.on.mock.calls[mockChannel.on.mock.calls.length - 1][2];

    const rawPayload = {
      eventType: 'INSERT',
      new: { id: 'order-1', restaurant_id: restaurantId, status: 'pending' },
      old: {},
    };

    rawListener(rawPayload);

    expect(callback).toHaveBeenCalledWith({
      eventType: 'INSERT',
      new: rawPayload.new,
      old: rawPayload.old,
    });
  });
});

// ---------------------------------------------------------------------------
// subscribeToTables()
// ---------------------------------------------------------------------------

describe('RealtimeService.subscribeToTables()', () => {
  it('creates a channel with the correct name "tables:{restaurantId}"', () => {
    const { supabase } = require('../../config/supabase');
    const restaurantId = 'restaurant-tables-test';

    realtimeService.subscribeToTables(restaurantId, jest.fn());

    expect(supabase.channel).toHaveBeenCalledWith(`tables:${restaurantId}`);
  });

  it('calls .on("postgres_changes", ...) with the correct table and filter', () => {
    const restaurantId = 'restaurant-tables-filter';
    const callback = jest.fn();

    realtimeService.subscribeToTables(restaurantId, callback);

    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'tables',
        filter: `restaurant_id=eq.${restaurantId}`,
      }),
      expect.any(Function)
    );
  });

  it('invokes the callback with a typed payload when a table change fires', () => {
    const restaurantId = 'restaurant-tables-callback';
    const callback = jest.fn<void, [RealtimePayload<Table>]>();

    realtimeService.subscribeToTables(restaurantId, callback);

    const rawListener = mockChannel.on.mock.calls[mockChannel.on.mock.calls.length - 1][2];

    const rawPayload = {
      eventType: 'UPDATE',
      new: { id: 'table-1', restaurant_id: restaurantId, status: 'ocupada' },
      old: { status: 'libre' },
    };

    rawListener(rawPayload);

    expect(callback).toHaveBeenCalledWith({
      eventType: 'UPDATE',
      new: rawPayload.new,
      old: rawPayload.old,
    });
  });
});

// ---------------------------------------------------------------------------
// unsubscribe()
// ---------------------------------------------------------------------------

describe('RealtimeService.unsubscribe()', () => {
  it('calls channel.unsubscribe() on the provided channel', async () => {
    const restaurantId = 'restaurant-unsub-test';
    const channel = realtimeService.subscribeToOrders(restaurantId, jest.fn());

    await realtimeService.unsubscribe(channel);

    expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// unsubscribeAll()
// ---------------------------------------------------------------------------

describe('RealtimeService.unsubscribeAll()', () => {
  it('unsubscribes all active channels', async () => {
    // Clear any channels accumulated by previous tests
    await realtimeService.unsubscribeAll();
    jest.clearAllMocks();
    mockChannel.on.mockReturnThis();
    mockChannel.subscribe.mockReturnThis();
    mockChannel.unsubscribe.mockResolvedValue(undefined);

    // Subscribe to two different channels
    realtimeService.subscribeToOrders('restaurant-all-1', jest.fn());
    realtimeService.subscribeToTables('restaurant-all-2', jest.fn());

    await realtimeService.unsubscribeAll();

    // unsubscribe should have been called once per channel
    expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('sets connection state to disconnected after unsubscribeAll', async () => {
    realtimeService.subscribeToOrders('restaurant-state-test', jest.fn());

    await realtimeService.unsubscribeAll();

    expect(realtimeService.getConnectionState()).toBe('disconnected');
  });
});

// ---------------------------------------------------------------------------
// getConnectionState()
// ---------------------------------------------------------------------------

describe('RealtimeService.getConnectionState()', () => {
  it('returns "disconnected" initially (after unsubscribeAll)', async () => {
    await realtimeService.unsubscribeAll();
    expect(realtimeService.getConnectionState()).toBe('disconnected');
  });

  it('returns "connecting" immediately after subscribing (before SUBSCRIBED status)', () => {
    // subscribe mock does not call the status callback, so state stays 'connecting'
    realtimeService.subscribeToOrders('restaurant-connecting', jest.fn());
    expect(realtimeService.getConnectionState()).toBe('connecting');
  });
});
