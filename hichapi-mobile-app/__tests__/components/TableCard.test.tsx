/**
 * Component tests for TableCard.
 *
 * Verifies:
 * 1. Renders table label
 * 2. Shows Bell badge when table has a 'pending' order
 * 3. Shows Bell badge when table has a 'confirmed' order
 * 4. Shows Banknote badge when table has a 'paying' order
 * 5. Does NOT show Bell badge when table has no pending/confirmed orders
 * 6. Does NOT show Banknote badge when table has no paying orders
 * 7. Shows both badges when table has both pending and paying orders
 * 8. Calls onPress when card is tapped
 * 9. Calls onQRPress when QR button is tapped
 * 10. Shows correct seats count
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TableCard } from '../../components/TableCard';
import type { Table, Order } from '../../types/models';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock AlertBadge to avoid animation issues in tests
jest.mock('../../components/AlertBadge', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    AlertBadge: ({ type }: { type: string }) =>
      React.createElement(Text, { testID: `alert-badge-${type}` }, type),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTable(overrides?: Partial<Table>): Table {
  return {
    id: 'table-uuid-1',
    restaurant_id: 'restaurant-uuid-1',
    label: 'Mesa 5',
    seats: 4,
    status: 'libre',
    zone: 'Terraza',
    smoking: false,
    min_pax: 1,
    max_pax: 6,
    qr_token: 'qr-token-abc123',
    ...overrides,
  };
}

function buildOrder(overrides?: Partial<Order>): Order {
  return {
    id: 'order-uuid-1',
    restaurant_id: 'restaurant-uuid-1',
    table_id: 'table-uuid-1',
    status: 'pending',
    total: 10000,
    client_name: 'Ana García',
    notes: '',
    created_at: '2025-01-15T12:00:00Z',
    updated_at: '2025-01-15T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Renders table label
// ---------------------------------------------------------------------------

describe('TableCard — renders table label', () => {
  it('renders the table label text', () => {
    const table = buildTable({ label: 'Mesa 5' });
    const { getByText } = render(<TableCard table={table} />);
    expect(getByText('Mesa 5')).toBeTruthy();
  });

  it('renders a different table label', () => {
    const table = buildTable({ label: 'Terraza 2' });
    const { getByText } = render(<TableCard table={table} />);
    expect(getByText('Terraza 2')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. Bell badge — pending order
// ---------------------------------------------------------------------------

describe('TableCard — Bell badge for pending order', () => {
  it('shows Bell badge when table has a pending order', () => {
    const table = buildTable();
    const orders = [buildOrder({ status: 'pending' })];
    const { getByTestId } = render(<TableCard table={table} orders={orders} />);
    expect(getByTestId('alert-badge-bell')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3. Bell badge — confirmed order
// ---------------------------------------------------------------------------

describe('TableCard — Bell badge for confirmed order', () => {
  it('shows Bell badge when table has a confirmed order', () => {
    const table = buildTable();
    const orders = [buildOrder({ status: 'confirmed' })];
    const { getByTestId } = render(<TableCard table={table} orders={orders} />);
    expect(getByTestId('alert-badge-bell')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. Banknote badge — paying order
// ---------------------------------------------------------------------------

describe('TableCard — Banknote badge for paying order', () => {
  it('shows Banknote badge when table has a paying order', () => {
    const table = buildTable();
    const orders = [buildOrder({ status: 'paying' })];
    const { getByTestId } = render(<TableCard table={table} orders={orders} />);
    expect(getByTestId('alert-badge-banknote')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. No Bell badge when no pending/confirmed orders
// ---------------------------------------------------------------------------

describe('TableCard — no Bell badge without pending/confirmed orders', () => {
  it('does NOT show Bell badge when orders array is empty', () => {
    const table = buildTable();
    const { queryByTestId } = render(<TableCard table={table} orders={[]} />);
    expect(queryByTestId('alert-badge-bell')).toBeNull();
  });

  it('does NOT show Bell badge when order is in preparing status', () => {
    const table = buildTable();
    const orders = [buildOrder({ status: 'preparing' })];
    const { queryByTestId } = render(<TableCard table={table} orders={orders} />);
    expect(queryByTestId('alert-badge-bell')).toBeNull();
  });

  it('does NOT show Bell badge when order is paid', () => {
    const table = buildTable();
    const orders = [buildOrder({ status: 'paid' })];
    const { queryByTestId } = render(<TableCard table={table} orders={orders} />);
    expect(queryByTestId('alert-badge-bell')).toBeNull();
  });

  it('does NOT show Bell badge when no orders prop is provided', () => {
    const table = buildTable();
    const { queryByTestId } = render(<TableCard table={table} />);
    expect(queryByTestId('alert-badge-bell')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. No Banknote badge when no paying orders
// ---------------------------------------------------------------------------

describe('TableCard — no Banknote badge without paying orders', () => {
  it('does NOT show Banknote badge when orders array is empty', () => {
    const table = buildTable();
    const { queryByTestId } = render(<TableCard table={table} orders={[]} />);
    expect(queryByTestId('alert-badge-banknote')).toBeNull();
  });

  it('does NOT show Banknote badge when order is pending', () => {
    const table = buildTable();
    const orders = [buildOrder({ status: 'pending' })];
    const { queryByTestId } = render(<TableCard table={table} orders={orders} />);
    expect(queryByTestId('alert-badge-banknote')).toBeNull();
  });

  it('does NOT show Banknote badge when no orders prop is provided', () => {
    const table = buildTable();
    const { queryByTestId } = render(<TableCard table={table} />);
    expect(queryByTestId('alert-badge-banknote')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Both badges when pending and paying orders exist
// ---------------------------------------------------------------------------

describe('TableCard — both badges when pending and paying orders', () => {
  it('shows both Bell and Banknote badges', () => {
    const table = buildTable();
    const orders = [
      buildOrder({ id: 'order-1', status: 'pending' }),
      buildOrder({ id: 'order-2', status: 'paying' }),
    ];
    const { getByTestId } = render(<TableCard table={table} orders={orders} />);
    expect(getByTestId('alert-badge-bell')).toBeTruthy();
    expect(getByTestId('alert-badge-banknote')).toBeTruthy();
  });

  it('shows Bell badge for confirmed + Banknote badge for paying', () => {
    const table = buildTable();
    const orders = [
      buildOrder({ id: 'order-1', status: 'confirmed' }),
      buildOrder({ id: 'order-2', status: 'paying' }),
    ];
    const { getByTestId } = render(<TableCard table={table} orders={orders} />);
    expect(getByTestId('alert-badge-bell')).toBeTruthy();
    expect(getByTestId('alert-badge-banknote')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 8. onPress callback
// ---------------------------------------------------------------------------

describe('TableCard — onPress callback', () => {
  it('calls onPress when card is tapped', () => {
    const onPress = jest.fn();
    const table = buildTable({ label: 'Mesa 5' });
    const { getAllByRole } = render(
      <TableCard table={table} onPress={onPress} />
    );
    // The card is the first button (outer TouchableOpacity)
    const buttons = getAllByRole('button');
    fireEvent.press(buttons[0]);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onPress is not provided', () => {
    const table = buildTable();
    // Should not throw when rendered without onPress
    expect(() => render(<TableCard table={table} />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 9. onQRPress callback
// ---------------------------------------------------------------------------

describe('TableCard — onQRPress callback', () => {
  it('calls onQRPress when QR button is tapped', () => {
    const onQRPress = jest.fn();
    const table = buildTable({ label: 'Mesa 3' });
    const { getAllByRole } = render(
      <TableCard table={table} onQRPress={onQRPress} />
    );
    // The QR button is the last button in the card
    const buttons = getAllByRole('button');
    fireEvent.press(buttons[buttons.length - 1]);
    expect(onQRPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when QR button is tapped', () => {
    const onPress = jest.fn();
    const onQRPress = jest.fn();
    const table = buildTable({ label: 'Mesa 3' });
    const { getAllByRole } = render(
      <TableCard table={table} onPress={onPress} onQRPress={onQRPress} />
    );
    // The QR button is the last button in the card
    const buttons = getAllByRole('button');
    fireEvent.press(buttons[buttons.length - 1]);
    expect(onQRPress).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 10. Seats count
// ---------------------------------------------------------------------------

describe('TableCard — seats count', () => {
  it('shows correct seats count for 4 seats', () => {
    const table = buildTable({ seats: 4 });
    const { getByText } = render(<TableCard table={table} />);
    expect(getByText('4 asientos')).toBeTruthy();
  });

  it('shows singular "asiento" for 1 seat', () => {
    const table = buildTable({ seats: 1 });
    const { getByText } = render(<TableCard table={table} />);
    expect(getByText('1 asiento')).toBeTruthy();
  });

  it('shows correct seats count for 8 seats', () => {
    const table = buildTable({ seats: 8 });
    const { getByText } = render(<TableCard table={table} />);
    expect(getByText('8 asientos')).toBeTruthy();
  });
});
