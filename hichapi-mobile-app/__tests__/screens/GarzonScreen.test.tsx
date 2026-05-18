/**
 * Component tests for GarzonScreen.
 * Verifies loading state, error state, order rendering, filter bar,
 * filter functionality, real-time update rendering, and empty state.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../config/api', () => ({
  API_BASE_URL: 'https://test.api.hichapi.com',
  API_TIMEOUT: 30000,
  API_RETRY_ATTEMPTS: 3,
  API_RETRY_DELAY: 1000,
}));

jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
  },
}));

jest.mock('../../hooks/useOrders');
jest.mock('../../hooks/useAuth');
jest.mock('../../services/orders/OrderService');

import { useOrders } from '../../hooks/useOrders';
import { useAuth } from '../../hooks/useAuth';
import { orderService } from '../../services/orders/OrderService';
import GarzonScreen from '../../screens/garzon/GarzonScreen';
import type { Order } from '../../types/models';

const mockUseOrders = useOrders as jest.MockedFunction<typeof useOrders>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUpdateOrderStatus = orderService.updateOrderStatus as jest.MockedFunction<
  typeof orderService.updateOrderStatus
>;

// ---------------------------------------------------------------------------
// Navigation mock
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => false),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  setOptions: jest.fn(),
  setParams: jest.fn(),
} as any;

const mockRoute = {
  key: 'GarzonList',
  name: 'GarzonList',
  params: undefined,
} as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildOrder(overrides?: Partial<Order>): Order {
  return {
    id: `order-${Math.random().toString(36).slice(2, 9)}`,
    restaurant_id: 'restaurant-uuid',
    table_id: 'table-uuid-abcd',
    status: 'pending',
    total: 10000,
    client_name: 'Cliente Test',
    notes: '',
    created_at: '2025-01-15T12:00:00Z',
    updated_at: '2025-01-15T12:00:00Z',
    ...overrides,
  };
}

const defaultRefetch = jest.fn().mockResolvedValue(undefined);

function mockUseOrdersReturn(overrides?: {
  orders?: Order[];
  loading?: boolean;
  error?: string | null;
  refetch?: jest.Mock;
}) {
  mockUseOrders.mockReturnValue({
    orders: overrides?.orders ?? [],
    loading: overrides?.loading ?? false,
    error: overrides?.error ?? null,
    refetch: overrides?.refetch ?? defaultRefetch,
  });
}

function mockUseAuthReturn() {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'user-uuid',
      email: 'garzon@test.com',
      user_metadata: { restaurant_id: 'restaurant-uuid' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2025-01-01T00:00:00Z',
    } as any,
    session: null as any,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
  } as any);
}

function renderGarzonScreen() {
  return render(<GarzonScreen navigation={mockNavigation} route={mockRoute} />);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuthReturn();
  mockUpdateOrderStatus.mockResolvedValue({} as Order);
});

// ---------------------------------------------------------------------------
// 1. Loading state
// ---------------------------------------------------------------------------

describe('GarzonScreen — loading state', () => {
  it('shows ActivityIndicator when loading is true', () => {
    mockUseOrdersReturn({ loading: true });
    const { getByTestId, UNSAFE_getByType } = renderGarzonScreen();

    // ActivityIndicator is rendered during loading
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('shows loading text when loading is true', () => {
    mockUseOrdersReturn({ loading: true });
    const { getByText } = renderGarzonScreen();
    expect(getByText('Cargando pedidos…')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. Error state
// ---------------------------------------------------------------------------

describe('GarzonScreen — error state', () => {
  it('shows error message when error is set', () => {
    mockUseOrdersReturn({ error: 'Network error' });
    const { getByText } = renderGarzonScreen();
    expect(getByText('No se pudieron cargar los pedidos.')).toBeTruthy();
  });

  it('shows retry button when error is set', () => {
    mockUseOrdersReturn({ error: 'Network error' });
    const { getByText } = renderGarzonScreen();
    expect(getByText('Reintentar')).toBeTruthy();
  });

  it('calls refetch when retry button is pressed', async () => {
    const mockRefetch = jest.fn().mockResolvedValue(undefined);
    mockUseOrdersReturn({ error: 'Network error', refetch: mockRefetch });

    const { getByText } = renderGarzonScreen();
    fireEvent.press(getByText('Reintentar'));

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Renders orders
// ---------------------------------------------------------------------------

describe('GarzonScreen — renders orders', () => {
  it('renders an OrderCard for each order in the list', () => {
    const orders = [
      buildOrder({ id: 'order-1', client_name: 'Ana García', status: 'pending' }),
      buildOrder({ id: 'order-2', client_name: 'Luis Martínez', status: 'confirmed' }),
      buildOrder({ id: 'order-3', client_name: 'María López', status: 'preparing' }),
    ];
    mockUseOrdersReturn({ orders });

    const { getByText } = renderGarzonScreen();

    expect(getByText('Ana García')).toBeTruthy();
    expect(getByText('Luis Martínez')).toBeTruthy();
    expect(getByText('María López')).toBeTruthy();
  });

  it('renders client names from orders', () => {
    const orders = [
      buildOrder({ client_name: 'Pedro Soto', status: 'pending' }),
    ];
    mockUseOrdersReturn({ orders });

    const { getByText } = renderGarzonScreen();
    expect(getByText('Pedro Soto')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. Filter bar
// ---------------------------------------------------------------------------

describe('GarzonScreen — filter bar', () => {
  beforeEach(() => {
    mockUseOrdersReturn({ orders: [] });
  });

  it('renders "Todas" filter button', () => {
    const { getByText } = renderGarzonScreen();
    expect(getByText('Todas')).toBeTruthy();
  });

  it('renders "Pendiente" filter button', () => {
    const { getByText } = renderGarzonScreen();
    expect(getByText('Pendiente')).toBeTruthy();
  });

  it('renders "Confirmada" filter button', () => {
    const { getByText } = renderGarzonScreen();
    expect(getByText('Confirmada')).toBeTruthy();
  });

  it('renders "En preparación" filter button', () => {
    const { getByText } = renderGarzonScreen();
    expect(getByText('En preparación')).toBeTruthy();
  });

  it('renders "Lista" filter button', () => {
    const { getByText } = renderGarzonScreen();
    expect(getByText('Lista')).toBeTruthy();
  });

  it('renders "Pagando" filter button', () => {
    const { getByText } = renderGarzonScreen();
    expect(getByText('Pagando')).toBeTruthy();
  });

  it('renders all 6 filter buttons', () => {
    const { getByText } = renderGarzonScreen();
    expect(getByText('Todas')).toBeTruthy();
    expect(getByText('Pendiente')).toBeTruthy();
    expect(getByText('Confirmada')).toBeTruthy();
    expect(getByText('En preparación')).toBeTruthy();
    expect(getByText('Lista')).toBeTruthy();
    expect(getByText('Pagando')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. Filter functionality
// ---------------------------------------------------------------------------

describe('GarzonScreen — filter functionality', () => {
  it('shows only paying orders when "Pagando" filter is pressed', () => {
    const orders = [
      buildOrder({ id: 'order-1', client_name: 'Ana García', status: 'pending' }),
      buildOrder({ id: 'order-2', client_name: 'Luis Martínez', status: 'paying' }),
      buildOrder({ id: 'order-3', client_name: 'María López', status: 'paying' }),
    ];
    mockUseOrdersReturn({ orders });

    const { getAllByText, getByText, queryByText } = renderGarzonScreen();

    // Press the "Pagando" filter button (first occurrence is the filter bar button)
    const pagandoButtons = getAllByText('Pagando');
    fireEvent.press(pagandoButtons[0]);

    // Paying orders should be visible
    expect(getByText('Luis Martínez')).toBeTruthy();
    expect(getByText('María López')).toBeTruthy();

    // Pending order should not be visible
    expect(queryByText('Ana García')).toBeNull();
  });

  it('shows all orders when "Todas" filter is active', () => {
    const orders = [
      buildOrder({ id: 'order-1', client_name: 'Ana García', status: 'pending' }),
      buildOrder({ id: 'order-2', client_name: 'Luis Martínez', status: 'paying' }),
    ];
    mockUseOrdersReturn({ orders });

    const { getByText } = renderGarzonScreen();

    // "Todas" is the default filter — both orders should be visible
    expect(getByText('Ana García')).toBeTruthy();
    expect(getByText('Luis Martínez')).toBeTruthy();
  });

  it('shows only pending orders when "Pendiente" filter is pressed', () => {
    const orders = [
      buildOrder({ id: 'order-1', client_name: 'Ana García', status: 'pending' }),
      buildOrder({ id: 'order-2', client_name: 'Luis Martínez', status: 'confirmed' }),
    ];
    mockUseOrdersReturn({ orders });

    const { getAllByText, getByText, queryByText } = renderGarzonScreen();

    // Press the "Pendiente" filter button (first occurrence is the filter bar button)
    const pendienteButtons = getAllByText('Pendiente');
    fireEvent.press(pendienteButtons[0]);

    expect(getByText('Ana García')).toBeTruthy();
    expect(queryByText('Luis Martínez')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Real-time update
// ---------------------------------------------------------------------------

describe('GarzonScreen — real-time update', () => {
  it('renders new order when useOrders returns updated orders list', async () => {
    // Initial render with one order
    const initialOrders = [
      buildOrder({ id: 'order-1', client_name: 'Ana García', status: 'pending' }),
    ];
    mockUseOrdersReturn({ orders: initialOrders });

    const { getByText, queryByText, rerender } = renderGarzonScreen();
    expect(getByText('Ana García')).toBeTruthy();
    expect(queryByText('Nuevo Cliente')).toBeNull();

    // Simulate real-time update: useOrders now returns an additional order
    const updatedOrders = [
      ...initialOrders,
      buildOrder({ id: 'order-2', client_name: 'Nuevo Cliente', status: 'pending' }),
    ];
    mockUseOrdersReturn({ orders: updatedOrders });

    rerender(<GarzonScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(getByText('Nuevo Cliente')).toBeTruthy();
    });
  });

  it('reflects status change when useOrders returns updated order status', async () => {
    const orderId = 'order-realtime-1';
    const initialOrders = [
      buildOrder({ id: orderId, client_name: 'Carlos Ruiz', status: 'pending' }),
    ];
    mockUseOrdersReturn({ orders: initialOrders });

    const { getAllByText, rerender } = renderGarzonScreen();
    // "Pendiente" appears in both filter bar and status badge
    const pendienteElements = getAllByText('Pendiente');
    // At least 2: one in filter bar, one in status badge
    expect(pendienteElements.length).toBeGreaterThanOrEqual(2);

    // Simulate real-time status update
    const updatedOrders = [
      buildOrder({ id: orderId, client_name: 'Carlos Ruiz', status: 'confirmed' }),
    ];
    mockUseOrdersReturn({ orders: updatedOrders });

    rerender(<GarzonScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(getAllByText('Confirmada').length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// 7. Empty state
// ---------------------------------------------------------------------------

describe('GarzonScreen — empty state', () => {
  it('shows empty state message when orders array is empty', () => {
    mockUseOrdersReturn({ orders: [] });
    const { getByText } = renderGarzonScreen();
    expect(getByText('Sin pedidos')).toBeTruthy();
  });

  it('shows "No hay pedidos activos" subtitle when all filter is active and no orders', () => {
    mockUseOrdersReturn({ orders: [] });
    const { getByText } = renderGarzonScreen();
    expect(getByText('No hay pedidos activos en este momento.')).toBeTruthy();
  });

  it('shows filter-specific empty message when filtered orders are empty', () => {
    // Only pending orders exist, but we filter by "paying"
    const orders = [
      buildOrder({ status: 'pending', client_name: 'Ana García' }),
    ];
    mockUseOrdersReturn({ orders });

    const { getByText } = renderGarzonScreen();

    fireEvent.press(getByText('Pagando'));

    expect(getByText('Sin pedidos')).toBeTruthy();
    expect(
      getByText(`No hay pedidos con estado "Pagando".`)
    ).toBeTruthy();
  });

  it('shows the 📋 icon in empty state', () => {
    mockUseOrdersReturn({ orders: [] });
    const { getByText } = renderGarzonScreen();
    expect(getByText('📋')).toBeTruthy();
  });
});
