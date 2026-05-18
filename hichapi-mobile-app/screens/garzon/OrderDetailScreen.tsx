/**
 * OrderDetailScreen — full order detail view for waitstaff.
 *
 * Features:
 * - Fetches order by ID using orderService.getOrderById(orderId)
 * - Fetches order items using orderService.getOrderItems(orderId)
 * - Shows: order status, table, client name, notes, creation time
 * - Shows full list of order items with quantity, name, unit price, notes
 * - Shows order total in CLP
 * - Action button to advance status
 * - Loading and error states
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { orderService } from '../../services/orders/OrderService';
import { OrderValidator } from '../../services/orders/OrderValidator';
import { StatusBadge } from '../../components/StatusBadge';
import { ORDER_STATUS_LABELS } from '../../utils/constants';
import { formatCLP, formatDate, formatTime, formatRelativeTime } from '../../utils/formatters';
import type { Order, OrderItem, OrderStatus } from '../../types/models';
import type { OrderDetailScreenProps } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrderDetailScreen({ route, navigation }: OrderDetailScreenProps) {
  const { orderId } = route.params;

  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch order data
  // -------------------------------------------------------------------------

  const fetchOrderData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedOrder, fetchedItems] = await Promise.all([
        orderService.getOrderById(orderId),
        orderService.getOrderItems(orderId),
      ]);
      setOrder(fetchedOrder);
      setOrderItems(fetchedItems);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo cargar el pedido.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  // -------------------------------------------------------------------------
  // Status advance
  // -------------------------------------------------------------------------

  const handleStatusAdvance = useCallback(async () => {
    if (!order) return;
    const nextStatus = OrderValidator.getNextStatus(order.status);
    if (!nextStatus) return;

    setAdvancing(true);
    try {
      const updated = await orderService.updateOrderStatus(order.id, nextStatus);
      setOrder(updated);
    } catch (err) {
      Alert.alert(
        'Error',
        'No se pudo actualizar el estado del pedido. Intenta nuevamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setAdvancing(false);
    }
  }, [order]);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Cargando pedido…</Text>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error || !order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {error ?? 'No se encontró el pedido.'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchOrderData}
          accessibilityLabel="Reintentar cargar pedido"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const nextStatus = OrderValidator.getNextStatus(order.status);
  const isTerminal = OrderValidator.isTerminal(order.status);
  const tableLabel = order.table_label ?? `Mesa ${order.table_id.slice(-4)}`;
  const isPayingStatus = order.status === 'paying';

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Order header                                                        */}
      {/* ------------------------------------------------------------------ */}
      <View style={[styles.headerCard, isPayingStatus && styles.headerCardPaying]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.tableLabel}>{tableLabel}</Text>
            <Text style={styles.clientName}>{order.client_name}</Text>
          </View>
          <StatusBadge status={order.status} size="large" />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            📅 {formatDate(order.created_at)} a las {formatTime(order.created_at)}
          </Text>
          <Text style={styles.metaText}>
            🕐 {formatRelativeTime(order.created_at)}
          </Text>
        </View>

        {order.notes ? (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notas:</Text>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        ) : null}
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Order items                                                         */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Ítems del pedido ({orderItems.length})
        </Text>

        {orderItems.length === 0 ? (
          <Text style={styles.emptyItemsText}>Sin ítems registrados.</Text>
        ) : (
          orderItems.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemQuantity}>{item.quantity}×</Text>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSubtotal}>
                  {formatCLP(item.unit_price * item.quantity)}
                </Text>
              </View>

              <View style={styles.itemMeta}>
                <Text style={styles.itemUnitPrice}>
                  {formatCLP(item.unit_price)} c/u
                </Text>
                {item.notes ? (
                  <Text style={styles.itemNotes}>📝 {item.notes}</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Total                                                               */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{formatCLP(order.total)}</Text>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Action button                                                       */}
      {/* ------------------------------------------------------------------ */}
      {!isTerminal && nextStatus && (
        <TouchableOpacity
          style={[
            styles.actionButton,
            isPayingStatus && styles.actionButtonPaying,
            advancing && styles.actionButtonDisabled,
          ]}
          onPress={handleStatusAdvance}
          disabled={advancing}
          accessibilityLabel={`Avanzar estado a ${ORDER_STATUS_LABELS[nextStatus]}`}
          accessibilityRole="button"
        >
          {advancing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>
              → {ORDER_STATUS_LABELS[nextStatus]}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {isTerminal && (
        <View style={styles.terminalBadge}>
          <Text style={styles.terminalBadgeText}>
            Pedido {ORDER_STATUS_LABELS[order.status]?.toLowerCase() || 'desconocido'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 15,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  headerCardPaying: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tableLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  clientName: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 2,
  },
  metaRow: {
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  notesContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 13,
    color: '#374151',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  emptyItemsText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  itemCard: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
    gap: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    minWidth: 28,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  itemMeta: {
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 36,
  },
  itemUnitPrice: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  itemNotes: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    flex: 1,
  },
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  actionButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  actionButtonPaying: {
    backgroundColor: '#F59E0B',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  terminalBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  terminalBadgeText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
});
