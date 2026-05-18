/**
 * KanbanColumn — a fixed-width vertical column for the Kanban board.
 *
 * Features:
 * - Column header with title and order count badge
 * - Vertical ScrollView of compact order cards
 * - Each card shows: table label, client name, creation timestamp,
 *   order items count, and status badge
 * - Tap on card calls onOrderPress
 * - Tap on advance button calls onStatusAdvance
 * - Fixed width of 220px for horizontal scrolling
 * - Wrapped with React.memo
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { StatusBadge } from './StatusBadge';
import { OrderValidator } from '../services/orders/OrderValidator';
import { ORDER_STATUS_LABELS } from '../utils/constants';
import { formatRelativeTime } from '../utils/formatters';
import type { Order, OrderStatus } from '../types/models';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KanbanColumnProps {
  title: string;
  orders: Order[];
  onOrderPress?: (orderId: string) => void;
  onStatusAdvance?: (orderId: string, nextStatus: OrderStatus) => void;
  columnColor?: string;
}

// ---------------------------------------------------------------------------
// Compact order card (internal)
// ---------------------------------------------------------------------------

interface CompactOrderCardProps {
  order: Order;
  onPress?: () => void;
  onStatusAdvance?: (orderId: string, nextStatus: OrderStatus) => void;
}

function CompactOrderCard({ order, onPress, onStatusAdvance }: CompactOrderCardProps) {
  const nextStatus = OrderValidator.getNextStatus(order.status);
  const isTerminal = OrderValidator.isTerminal(order.status);

  // Derive a human-readable table label from the table_id
  const tableLabel = order.table_label ?? `Mesa ${order.table_id.slice(-4)}`;

  const handleAdvancePress = useCallback(() => {
    if (nextStatus && onStatusAdvance) {
      onStatusAdvance(order.id, nextStatus);
    }
  }, [nextStatus, onStatusAdvance, order.id]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Orden de ${order.client_name}, ${tableLabel}`}
      accessibilityRole="button"
    >
      {/* Table label + client name */}
      <View style={styles.cardHeader}>
        <Text style={styles.tableLabel} numberOfLines={1}>
          {tableLabel}
        </Text>
        <StatusBadge status={order.status} size="small" />
      </View>

      <Text style={styles.clientName} numberOfLines={1}>
        {order.client_name}
      </Text>

      {/* Timestamp */}
      <Text style={styles.timestamp}>
        {formatRelativeTime(order.created_at)}
      </Text>

      {/* Items count */}
      <Text style={styles.itemsCount}>
        {(order as any).items_count != null
          ? `${(order as any).items_count} ítem${(order as any).items_count !== 1 ? 's' : ''}`
          : ''}
      </Text>

      {/* Advance button */}
      {!isTerminal && nextStatus && (
        <TouchableOpacity
          style={styles.advanceButton}
          onPress={handleAdvancePress}
          accessibilityLabel={`Avanzar a ${ORDER_STATUS_LABELS[nextStatus]}`}
          accessibilityRole="button"
        >
          <Text style={styles.advanceButtonText}>
            → {ORDER_STATUS_LABELS[nextStatus]}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const MemoCompactOrderCard = React.memo(CompactOrderCard);

// ---------------------------------------------------------------------------
// KanbanColumn
// ---------------------------------------------------------------------------

function KanbanColumnComponent({
  title,
  orders,
  onOrderPress,
  onStatusAdvance,
  columnColor = '#F3F4F6',
}: KanbanColumnProps) {
  return (
    <View style={[styles.column, { backgroundColor: columnColor }]}>
      {/* Column header */}
      <View style={styles.columnHeader}>
        <Text style={styles.columnTitle}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{orders.length}</Text>
        </View>
      </View>

      {/* Order cards */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {orders.map((order) => (
          <MemoCompactOrderCard
            key={order.id}
            order={order}
            onPress={onOrderPress ? () => onOrderPress(order.id) : undefined}
            onStatusAdvance={onStatusAdvance}
          />
        ))}

        {orders.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Sin órdenes</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const COLUMN_WIDTH = 220;

const styles = StyleSheet.create({
  column: {
    width: COLUMN_WIDTH,
    borderRadius: 12,
    marginHorizontal: 6,
    paddingBottom: 8,
    flex: 1,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#6B7280',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tableLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 6,
  },
  clientName: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  itemsCount: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  advanceButton: {
    marginTop: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  advanceButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});

// ---------------------------------------------------------------------------
// Export (memoized)
// ---------------------------------------------------------------------------

export const KanbanColumn = React.memo(KanbanColumnComponent);
export default KanbanColumn;
