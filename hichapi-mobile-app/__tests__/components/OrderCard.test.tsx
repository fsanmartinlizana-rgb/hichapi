/**
 * Component tests for OrderCard.
 * Verifies CLP formatting, status badge, action button visibility,
 * amber highlight, expand/collapse, and onStatusAdvance callback.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OrderCard } from '../../components/OrderCard';
import { ORDER_STATUS_LABELS } from '../../utils/constants';
import type { Order, OrderItem, OrderStatus } from '../../types/models';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../services/orders/OrderValidator');

// After mocking, import and configure the mock
import { OrderValidator } from '../../services/orders/OrderValidator';

const mockGetNextStatus = OrderValidator.getNextStatus as jest.MockedFunction<
  typeof OrderValidator.getNextStatus
>;
const mockIsTerminal = OrderValidator.isTerminal as jest.MockedFunction<
  typeof OrderValidator.isTerminal
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildOrder(overrides?: Partial<Order>): Order {
  return {
    id: 'order-uuid-1234',
    restaurant_id: 'restaurant-uuid-5678',
    table_id: 'table-uuid-abcd',
    status: 'pending',
    total: 15000,
    client_name: 'Juan Pérez',
    notes: '',
    created_at: '2025-01-15T12:00:00Z',
    updated_at: '2025-01-15T12:00:00Z',
    ...overrides,
  };
}

function buildOrderItem(overrides?: Partial<OrderItem>): OrderItem {
  return {
    id: 'item-uuid-1',
    order_id: 'order-uuid-1234',
    menu_item_id: 'menu-item-uuid-1',
    name: 'Empanada de pino',
    quantity: 2,
    unit_price: 2500,
    notes: '',
    status: 'pending',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Default: non-terminal, next status is 'confirmed'
  mockIsTerminal.mockReturnValue(false);
  mockGetNextStatus.mockReturnValue('confirmed');
});

// ---------------------------------------------------------------------------
// 1. CLP formatting
// ---------------------------------------------------------------------------

describe('OrderCard — CLP formatting', () => {
  it('renders total in CLP format for 15000', () => {
    const order = buildOrder({ total: 15000 });
    const { getByText } = render(<OrderCard order={order} />);
    // The component renders `$` + formatCLP(total) as adjacent text nodes
    // Use a regex to match the combined text content
    expect(getByText(/\$15\.000/)).toBeTruthy();
  });

  it('renders "$0" for total: 0', () => {
    const order = buildOrder({ total: 0 });
    const { getByText } = render(<OrderCard order={order} />);
    expect(getByText(/\$0/)).toBeTruthy();
  });

  it('renders "$1.000.000" for total: 1000000', () => {
    const order = buildOrder({ total: 1000000 });
    const { getByText } = render(<OrderCard order={order} />);
    expect(getByText(/\$1\.000\.000/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. Status badge
// ---------------------------------------------------------------------------

describe('OrderCard — status badge', () => {
  const allStatuses: OrderStatus[] = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'paying',
    'paid',
    'cancelled',
  ];

  allStatuses.forEach((status) => {
    it(`renders correct status label for "${status}"`, () => {
      // Terminal statuses need isTerminal to return true
      if (status === 'paid' || status === 'cancelled') {
        mockIsTerminal.mockReturnValue(true);
        mockGetNextStatus.mockReturnValue(null);
      } else {
        mockIsTerminal.mockReturnValue(false);
      }

      const order = buildOrder({ status });
      const { getByText } = render(<OrderCard order={order} />);
      expect(getByText(ORDER_STATUS_LABELS[status])).toBeTruthy();
    });
  });

  it('renders "Pendiente" for pending status', () => {
    const order = buildOrder({ status: 'pending' });
    const { getByText } = render(<OrderCard order={order} />);
    expect(getByText('Pendiente')).toBeTruthy();
  });

  it('renders "Pagando" for paying status', () => {
    mockGetNextStatus.mockReturnValue('paid');
    const order = buildOrder({ status: 'paying' });
    const { getByText } = render(<OrderCard order={order} />);
    expect(getByText('Pagando')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3. Action button visibility
// ---------------------------------------------------------------------------

describe('OrderCard — action button visibility', () => {
  it('shows action button when status is "pending" (not terminal)', () => {
    mockIsTerminal.mockReturnValue(false);
    mockGetNextStatus.mockReturnValue('confirmed');

    const order = buildOrder({ status: 'pending' });
    const { getByText } = render(<OrderCard order={order} showActions />);
    expect(getByText(`→ ${ORDER_STATUS_LABELS.confirmed}`)).toBeTruthy();
  });

  it('shows action button when status is "confirmed"', () => {
    mockIsTerminal.mockReturnValue(false);
    mockGetNextStatus.mockReturnValue('preparing');

    const order = buildOrder({ status: 'confirmed' });
    const { getByText } = render(<OrderCard order={order} showActions />);
    expect(getByText(`→ ${ORDER_STATUS_LABELS.preparing}`)).toBeTruthy();
  });

  it('hides action button when status is "paid" (terminal)', () => {
    mockIsTerminal.mockReturnValue(true);
    mockGetNextStatus.mockReturnValue(null);

    const order = buildOrder({ status: 'paid' });
    const { queryByText } = render(<OrderCard order={order} showActions />);
    // No "→" action button text should be present
    expect(queryByText(/^→/)).toBeNull();
  });

  it('hides action button when status is "cancelled" (terminal)', () => {
    mockIsTerminal.mockReturnValue(true);
    mockGetNextStatus.mockReturnValue(null);

    const order = buildOrder({ status: 'cancelled' });
    const { queryByText } = render(<OrderCard order={order} showActions />);
    expect(queryByText(/^→/)).toBeNull();
  });

  it('shows correct next status label "→ Confirmada" for pending', () => {
    mockIsTerminal.mockReturnValue(false);
    mockGetNextStatus.mockReturnValue('confirmed');

    const order = buildOrder({ status: 'pending' });
    const { getByText } = render(<OrderCard order={order} showActions />);
    expect(getByText('→ Confirmada')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. Amber highlight for paying status
// ---------------------------------------------------------------------------

describe('OrderCard — amber highlight for paying status', () => {
  it('applies amber border color when status is "paying"', () => {
    mockIsTerminal.mockReturnValue(false);
    mockGetNextStatus.mockReturnValue('paid');

    const order = buildOrder({ status: 'paying' });
    const { UNSAFE_getByProps } = render(<OrderCard order={order} />);

    // The card's accessibilityLabel contains the order info
    const card = UNSAFE_getByProps({
      accessibilityLabel: `Orden de ${order.client_name}, Mesa ${order.table_id.slice(-4)}, estado ${ORDER_STATUS_LABELS.paying}`,
    });

    // Check that the card has the amber border color applied
    const flatStyle = card.props.style;
    const styleArray = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasAmberBorder = styleArray.some(
      (s: Record<string, unknown>) => s && s.borderColor === '#F59E0B'
    );
    expect(hasAmberBorder).toBe(true);
  });

  it('does NOT apply amber border color when status is "pending"', () => {
    mockIsTerminal.mockReturnValue(false);
    mockGetNextStatus.mockReturnValue('confirmed');

    const order = buildOrder({ status: 'pending' });
    const { UNSAFE_getByProps } = render(<OrderCard order={order} />);

    const card = UNSAFE_getByProps({
      accessibilityLabel: `Orden de ${order.client_name}, Mesa ${order.table_id.slice(-4)}, estado ${ORDER_STATUS_LABELS.pending}`,
    });

    const flatStyle = card.props.style;
    const styleArray = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasAmberBorder = styleArray.some(
      (s: Record<string, unknown>) => s && s.borderColor === '#F59E0B'
    );
    expect(hasAmberBorder).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Expand / collapse
// ---------------------------------------------------------------------------

describe('OrderCard — expand/collapse', () => {
  it('shows expand toggle when orderItems are provided', () => {
    const order = buildOrder();
    const items = [buildOrderItem()];
    const { getByText } = render(<OrderCard order={order} orderItems={items} />);
    expect(getByText(/Ver 1 ítem/)).toBeTruthy();
  });

  it('hides expand toggle when no orderItems provided', () => {
    const order = buildOrder();
    const { queryByText } = render(<OrderCard order={order} />);
    expect(queryByText(/Ver \d+ ítem/)).toBeNull();
  });

  it('hides expand toggle when orderItems is an empty array', () => {
    const order = buildOrder();
    const { queryByText } = render(<OrderCard order={order} orderItems={[]} />);
    expect(queryByText(/Ver \d+ ítem/)).toBeNull();
  });

  it('shows items after pressing expand toggle', () => {
    const order = buildOrder();
    const items = [
      buildOrderItem({ name: 'Empanada de pino', quantity: 2 }),
      buildOrderItem({ id: 'item-uuid-2', name: 'Bebida cola', quantity: 1 }),
    ];
    const { getByText, queryByText } = render(
      <OrderCard order={order} orderItems={items} />
    );

    // Items should not be visible before expanding
    expect(queryByText('Empanada de pino')).toBeNull();

    // Press the expand toggle
    fireEvent.press(getByText(/Ver 2 ítems/));

    // Items should now be visible
    expect(getByText('Empanada de pino')).toBeTruthy();
    expect(getByText('Bebida cola')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 6. onStatusAdvance callback
// ---------------------------------------------------------------------------

describe('OrderCard — onStatusAdvance callback', () => {
  it('calls onStatusAdvance with correct orderId and nextStatus when action button pressed', () => {
    mockIsTerminal.mockReturnValue(false);
    mockGetNextStatus.mockReturnValue('confirmed');

    const onStatusAdvance = jest.fn();
    const order = buildOrder({ id: 'order-uuid-1234', status: 'pending' });

    const { getByText } = render(
      <OrderCard order={order} onStatusAdvance={onStatusAdvance} showActions />
    );

    fireEvent.press(getByText('→ Confirmada'));

    expect(onStatusAdvance).toHaveBeenCalledTimes(1);
    expect(onStatusAdvance).toHaveBeenCalledWith('order-uuid-1234', 'confirmed');
  });

  it('does NOT call onStatusAdvance when no callback is provided', () => {
    mockIsTerminal.mockReturnValue(false);
    mockGetNextStatus.mockReturnValue('confirmed');

    const order = buildOrder({ status: 'pending' });
    // Should not throw when pressing action button without callback
    const { getByText } = render(<OrderCard order={order} showActions />);
    expect(() => fireEvent.press(getByText('→ Confirmada'))).not.toThrow();
  });

  it('calls onStatusAdvance with "paid" when status is "paying"', () => {
    mockIsTerminal.mockReturnValue(false);
    mockGetNextStatus.mockReturnValue('paid');

    const onStatusAdvance = jest.fn();
    const order = buildOrder({ id: 'order-uuid-5678', status: 'paying' });

    const { getByText } = render(
      <OrderCard order={order} onStatusAdvance={onStatusAdvance} showActions />
    );

    fireEvent.press(getByText('→ Pagada'));

    expect(onStatusAdvance).toHaveBeenCalledWith('order-uuid-5678', 'paid');
  });
});
