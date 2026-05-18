/**
 * TableDetailScreen — detailed view for a single restaurant table.
 *
 * Features:
 * - Shows table info: label, seats, zone, status, qr_token
 * - Shows active order for this table (if any)
 * - Shows order items if order exists
 * - Navigate to QRGenerator from this screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../hooks/useRestaurant';
import type { Table, Order, OrderItem } from '../../types/models';
import type { TableDetailScreenProps } from '../../types/navigation';
import { formatCLP } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Table status labels
// ---------------------------------------------------------------------------

const TABLE_STATUS_LABELS: Record<Table['status'], string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  bloqueada: 'Bloqueada',
};

const TABLE_STATUS_COLORS: Record<Table['status'], string> = {
  libre: '#10B981',
  ocupada: '#FF6B35',
  reservada: '#F59E0B',
  bloqueada: '#9CA3AF',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TableDetailScreen({
  route,
  navigation,
}: TableDetailScreenProps) {
  const { tableId } = route.params;
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();

  // -------------------------------------------------------------------------
  // Table state
  // -------------------------------------------------------------------------

  const [table, setTable] = useState<Table | null>(null);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [liberating, setLiberating] = useState(false);

  const fetchTable = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('tables')
        .select('id, label, seats, zone, smoking, status, qr_token, restaurant_id')
        .eq('id', tableId)
        .single();
      if (err) throw new Error(err.message);
      setTable(data as Table);
      setTableError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar la mesa';
      setTableError(message);
    } finally {
      setTableLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    fetchTable();
  }, [fetchTable]);

  // -------------------------------------------------------------------------
  // Active order state
  // -------------------------------------------------------------------------

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderLoading, setOrderLoading] = useState(true);

  const fetchActiveOrder = useCallback(async () => {
    if (!restaurantId) {
      setOrderLoading(false);
      return;
    }
    try {
      const { data: orders, error: ordErr } = await supabase
        .from('orders')
        .select('id, table_id, status, total, client_name, notes, created_at, updated_at, restaurant_id')
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .not('status', 'in', '("paid","cancelled")')
        .order('created_at', { ascending: false });

      if (ordErr) throw new Error(ordErr.message);
      const active = (orders ?? [])[0] ?? null;
      setActiveOrder(active);

      if (active) {
        const { data: items } = await supabase
          .from('order_items')
          .select('id, order_id, menu_item_id, name, quantity, unit_price, notes, status')
          .eq('order_id', active.id);
        setOrderItems((items ?? []) as OrderItem[]);
      }
    } catch {
      // Non-critical — silently fail
      setActiveOrder(null);
    } finally {
      setOrderLoading(false);
    }
  }, [restaurantId, tableId]);

  useEffect(() => {
    fetchActiveOrder();
  }, [fetchActiveOrder]);

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const handleQRPress = useCallback(() => {
    if (!table) return;
    navigation.navigate('QRGenerator', {
      tableId: table.id,
      tableLabel: table.label,
      qrToken: table.qr_token,
    });
  }, [navigation, table]);

  const handleLiberar = useCallback(async () => {
    if (!table) return;
    setLiberating(true);
    try {
      const { error: err } = await supabase
        .from('tables')
        .update({ status: 'libre' })
        .eq('id', table.id);
      if (err) throw err;
      await fetchTable();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo liberar la mesa';
      Alert.alert('Error', message);
    } finally {
      setLiberating(false);
    }
  }, [table, fetchTable]);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (tableLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Cargando mesa…</Text>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (tableError || !table) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {tableError ?? 'Mesa no encontrada'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchTable}
          accessibilityLabel="Reintentar cargar mesa"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  const statusColor = TABLE_STATUS_COLORS[table.status];
  const statusLabel = TABLE_STATUS_LABELS[table.status];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ------------------------------------------------------------------ */}
      {/* Table info card                                                     */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.tableLabel}>{table.label}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Asientos</Text>
          <Text style={styles.infoValue}>{table.seats}</Text>
        </View>

        {table.zone ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Zona</Text>
            <Text style={styles.infoValue}>{table.zone}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Token QR</Text>
          <Text style={[styles.infoValue, styles.tokenText]} numberOfLines={1}>
            {table.qr_token}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.qrButton}
          onPress={handleQRPress}
          accessibilityLabel={`Ver código QR de ${table.label}`}
          accessibilityRole="button"
        >
          <Text style={styles.qrButtonText}>Ver código QR</Text>
        </TouchableOpacity>

        {table.status !== 'libre' && (
          <TouchableOpacity
            style={[styles.qrButton, styles.liberarButton]}
            onPress={handleLiberar}
            disabled={liberating}
            accessibilityLabel={`Liberar mesa ${table.label}`}
            accessibilityRole="button"
          >
            <Text style={styles.qrButtonText}>
              {liberating ? 'Liberando…' : 'Liberar Mesa'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Active order                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Text style={styles.sectionTitle}>Orden activa</Text>

      {orderLoading ? (
        <ActivityIndicator size="small" color="#FF6B35" style={styles.orderLoader} />
      ) : activeOrder ? (
        <View style={styles.card}>
          <View style={styles.orderHeader}>
            <Text style={styles.clientName}>{activeOrder.client_name}</Text>
            <Text style={styles.orderTotal}>{formatCLP(activeOrder.total)}</Text>
          </View>

          <Text style={styles.orderStatus}>Estado: {activeOrder.status}</Text>

          {activeOrder.notes ? (
            <Text style={styles.orderNotes}>Notas: {activeOrder.notes}</Text>
          ) : null}

          {/* Order items */}
          {orderItems.length > 0 && (
            <View style={styles.itemsContainer}>
              <Text style={styles.itemsTitle}>Ítems del pedido</Text>
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
        </View>
      ) : (
        <View style={styles.emptyOrder}>
          <Text style={styles.emptyOrderText}>Sin orden activa</Text>
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
  content: {
    padding: 16,
    paddingBottom: 40,
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
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  tokenText: {
    fontFamily: 'monospace',
    fontSize: 12,
    maxWidth: '60%',
  },
  qrButton: {
    marginTop: 14,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  liberarButton: {
    backgroundColor: '#10B981',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  orderLoader: {
    marginTop: 20,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  orderStatus: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  orderNotes: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  itemsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  itemsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
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
  emptyOrder: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyOrderText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
