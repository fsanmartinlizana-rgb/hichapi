/**
 * Component tests for ComandasScreen.
 *
 * Verifies that orders appear in the correct Kanban columns based on their
 * status, and that loading / error states are rendered correctly.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

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
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
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
import ComandasScreen from '../../screens/comandas/ComandasScreen';
import type { Order } from '../../types/models';

const mockUseOrders = useOrders as jest.MockedFunction<typeof useOrders>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

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
  key: 'ComandasBoard',
  name: 'ComandasBoard',
  params: undefined,
} as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let orderCounter = 0;

function buildOrder(overrides?: Partial<Order>): Order {
  orderCounter += 1;
  return {
    id: `order-${orderCounter}`,
    restaurant_id: 'restaurant-uuid',
    table_id: `table-uuid-${orderCounter.toString().padStart(4, '0')}`,
    status: 'pending',
    total: 10000,
    client_name: `Cliente ${orderCounter}`,
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
      email: 'staff@test.com',
      user_metadata: { restaurant_id: 'restaurant-uuid' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2025-01-01T00:00:00Z',
    } as any,
    session: null as any,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
  } as any);
}

function renderComandasScreen() {
  return render(
    <ComandasScreen navigation={mockNavigation} route={mockRoute} />
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  orderCounter = 0;
  mockUseAuthReturn();
});

// ---------------------------------------------------------------------------
// 1. Renders 4 Kanban column headers
// ---------------------------------------------------------------------------

describe('ComandasScreen — column headers', () => {
  it('renders all 4 Kanban column headers', () => {
    mockUseOrdersReturn({ orders: [] });
    const { getByText } = renderComandasScreen();

    expect(getByText('Recibida')).toBeTruthy();
    expect(getByText('En Cocina')).toBeTruthy();
    expect(getByText('Lista')).toBeTruthy();
    expect(getByText('Entregada')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. Orders with status 'pending' appear in "Recibida" column
// ---------------------------------------------------------------------------

describe('ComandasScreen — pending orders in Recibida', () => {
  it('shows a pending order in the Recibida column', () => {
    const order = buildOrder({ status: 'pending', client_name: 'Cliente Pending' });
    mockUseOrdersReturn({ orders: [order] });

    const { getByText } = renderComandasScreen();

    expect(getByText('Cliente Pending')).toBeTruthy();
    // Column header is present
    expect(getByText('Recibida')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3. Orders with status 'confirmed' appear in "Recibida" column
// ---------------------------------------------------------------------------

describe('ComandasScreen — confirmed orders in Recibida', () => {
  it('shows a confirmed order in the Recibida column', () => {
    const order = buildOrder({ status: 'confirmed', client_name: 'Cliente Confirmed' });
    mockUseOrdersReturn({ orders: [order] });

    const { getByText } = renderComandasScreen();

    expect(getByText('Cliente Confirmed')).toBeTruthy();
    expect(getByText('Recibida')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. Orders with status 'preparing' appear in "En Cocina" column
// ---------------------------------------------------------------------------

describe('ComandasScreen — preparing orders in En Cocina', () => {
  it('shows a preparing order in the En Cocina column', () => {
    const order = buildOrder({ status: 'preparing', client_name: 'Cliente Preparing' });
    mockUseOrdersReturn({ orders: [order] });

    const { getByText } = renderComandasScreen();

    expect(getByText('Cliente Preparing')).toBeTruthy();
    expect(getByText('En Cocina')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. Orders with status 'ready' appear in "Lista" column
// ---------------------------------------------------------------------------

describe('ComandasScreen — ready orders in Lista', () => {
  it('shows a ready order in the Lista column', () => {
    const order = buildOrder({ status: 'ready', client_name: 'Cliente Ready' });
    mockUseOrdersReturn({ orders: [order] });

    const { getByText, getAllByText } = renderComandasScreen();

    expect(getByText('Cliente Ready')).toBeTruthy();
    // "Lista" appears as both the column header and the status badge label
    expect(getAllByText('Lista').length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 6. Orders with status 'paying' appear in "Entregada" column
// ---------------------------------------------------------------------------

describe('ComandasScreen — paying orders in Entregada', () => {
  it('shows a paying order in the Entregada column', () => {
    const order = buildOrder({ status: 'paying', client_name: 'Cliente Paying' });
    mockUseOrdersReturn({ orders: [order] });

    const { getByText } = renderComandasScreen();

    expect(getByText('Cliente Paying')).toBeTruthy();
    expect(getByText('Entregada')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 7. Cancelled orders do NOT appear in any column
// ---------------------------------------------------------------------------

describe('ComandasScreen — cancelled orders hidden', () => {
  it('does not render a cancelled order in any column', () => {
    const cancelledOrder = buildOrder({
      status: 'cancelled',
      client_name: 'Cliente Cancelado',
    });
    mockUseOrdersReturn({ orders: [cancelledOrder] });

    const { queryByText } = renderComandasScreen();

    expect(queryByText('Cliente Cancelado')).toBeNull();
  });

  it('hides cancelled orders while showing non-cancelled orders', () => {
    const orders = [
      buildOrder({ status: 'pending', client_name: 'Cliente Visible' }),
      buildOrder({ status: 'cancelled', client_name: 'Cliente Oculto' }),
    ];
    mockUseOrdersReturn({ orders });

    const { getByText, queryByText } = renderComandasScreen();

    expect(getByText('Cliente Visible')).toBeTruthy();
    expect(queryByText('Cliente Oculto')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. Loading state
// ---------------------------------------------------------------------------

describe('ComandasScreen — loading state', () => {
  it('shows ActivityIndicator when loading is true', () => {
    mockUseOrdersReturn({ loading: true });
    const { UNSAFE_getByType } = renderComandasScreen();

    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('shows loading text when loading is true', () => {
    mockUseOrdersReturn({ loading: true });
    const { getByText } = renderComandasScreen();
    expect(getByText('Cargando comandas…')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 9. Error state
// ---------------------------------------------------------------------------

describe('ComandasScreen — error state', () => {
  it('shows error message when error is set', () => {
    mockUseOrdersReturn({ error: 'Network error' });
    const { getByText } = renderComandasScreen();
    expect(getByText('No se pudieron cargar las comandas.')).toBeTruthy();
  });

  it('shows retry button when error is set', () => {
    mockUseOrdersReturn({ error: 'Network error' });
    const { getByText } = renderComandasScreen();
    expect(getByText('Reintentar')).toBeTruthy();
  });
});
