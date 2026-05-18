/**
 * OrderCard — expandable card displaying an order summary.
 *
 * Features:
 * - Header: table label, client name, StatusBadge, total in CLP
 * - Amber background highlight when status is 'paying'
 * - Expand/collapse toggle showing order items list
 * - Action button showing next status label (from OrderValidator.getNextStatus)
 * - Action button hidden when status is terminal (paid/cancelled)
 * - accessibilityLabel on all interactive elements
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { StatusBadge } from './StatusBadge';
import { OrderValidator } from '../services/orders/OrderValidator';
import { ORDER_STATUS_LABELS } from '../utils/constants';
import { formatCLP } from '../utils/formatters';
import type { Order, OrderItem, OrderStatus } from '../types/models';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OrderCardProps {
  order: Order;
  orderItems?: OrderItem[];
  onPress?: () => void;
  onStatusAdvance?: (orderId: string, nextStatus: OrderStatus) => void;
  showActions?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function OrderCardComponent({
  order,
  orderItems = [],
  onPress,
  onStatusAdvance,
  showActions = true,
}: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);

  const nextStatus = OrderValidator.getNextStatus(order.status);
  const isTerminal = OrderValidator.isTerminal(order.status);
  const isPayingStatus = order.status === 'paying';

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleActionPress = useCallback(() => {
    console.log(`[OrderCard] Botón de acción presionado para orden ${order?.id}, nextStatus: ${nextStatus}`);
    if (nextStatus && onStatusAdvance && order?.id) {
      onStatusAdvance(order.id, nextStatus);
    }
  }, [nextStatus, onStatusAdvance, order?.id]);

  const tableLabel = order?.table_label ?? `Mesa ${order?.table_id?.slice(-4) || '??'}`;

  return (
    <TouchableOpacity
      style={[styles.card, isPayingStatus && styles.cardPaying]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Orden de ${order?.client_name || 'Sin nombre'}, ${tableLabel}, estado ${ORDER_STATUS_LABELS[order?.status] || 'Desconocido'}`}
      accessibilityRole="button"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header row                                                          */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.tableLabel}>{tableLabel}</Text>
          <Text style={styles.clientName}>{order?.client_name || 'Sin nombre'}</Text>
        </View>

        <View style={styles.headerRight}>
          <StatusBadge status={order?.status} size="small" />
          <Text style={styles.total}>{formatCLP(order?.total || 0)}</Text>
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Expand / collapse toggle                                            */}
      {/* ------------------------------------------------------------------ */}
      {orderItems && orderItems?.length > 0 && (
        <TouchableOpacity
          style={styles.expandToggle}
          onPress={handleToggleExpand}
          accessibilityLabel={expanded ? 'Ocultar ítems del pedido' : 'Ver ítems del pedido'}
          accessibilityRole="button"
        >
          <Text style={styles.expandToggleText}>
            {expanded ? '▲ Ocultar ítems' : `▼ Ver ${orderItems.length} ítem${orderItems.length !== 1 ? 's' : ''}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Order items list (expanded)                                         */}
      {/* ------------------------------------------------------------------ */}
      {expanded && orderItems && orderItems?.length > 0 && (
        <View style={styles.itemsContainer}>
          {orderItems.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemQuantity}>{item.quantity}×</Text>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.notes ? (
                  <Text style={styles.itemNotes}>{item.notes}</Text>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>
                {formatCLP(item.unit_price * item.quantity)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Action buttons                                                    */}
      {/* ------------------------------------------------------------------ */}
      {showActions && !isTerminal && (
        <View style={styles.actionsRow}>
          {/* Precheck button (Solicitar Precuenta) - only if ready, delivered or already paying (to re-print) */}
          {['ready', 'delivered', 'paying'].includes(order?.status || '') && (
            <TouchableOpacity
              style={styles.precheckButton}
              onPress={() => onStatusAdvance?.(order?.id, 'paying')}
              accessibilityLabel="Solicitar precuenta"
              accessibilityRole="button"
            >
              <Text style={styles.precheckButtonText}>Solicitar Precuenta</Text>
            </TouchableOpacity>
          )}

          {/* Primary next status button */}
          {nextStatus && (
            <TouchableOpacity
              style={[styles.actionButton, isPayingStatus && styles.actionButtonPaying]}
              onPress={handleActionPress}
              accessibilityLabel={`Avanzar estado a ${ORDER_STATUS_LABELS[nextStatus]}`}
              accessibilityRole="button"
            >
              <Text style={styles.actionButtonText}>
                {isPayingStatus ? 'Finalizar Pago' : `→ ${ORDER_STATUS_LABELS[nextStatus] || 'Desconocido'}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardPaying: {
    backgroundColor: '#FFFBEB', // amber-50
    borderColor: '#F59E0B',     // amber-500
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tableLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  clientName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  expandToggle: {
    marginTop: 10,
    paddingVertical: 4,
  },
  expandToggleText: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '500',
  },
  itemsContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemQuantity: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    minWidth: 24,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    color: '#374151',
  },
  itemNotes: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 1,
  },
  itemPrice: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginLeft: 4,
  },
  actionButtonPaying: {
    backgroundColor: '#10B981', // green for paid/final step
    marginLeft: 0,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  precheckButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  precheckButtonText: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
});

// ---------------------------------------------------------------------------
// Export (memoized)
// ---------------------------------------------------------------------------

export const OrderCard = React.memo(OrderCardComponent);
export default OrderCard;
