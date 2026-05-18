/**
 * ComandasScreen — Kanban board for kitchen/floor staff.
 *
 * Displays active orders grouped into four columns:
 *   - "Recibida"  → pending, confirmed
 *   - "En Cocina" → preparing
 *   - "Lista"     → ready
 *   - "Entregada" → paying, paid
 *
 * Cancelled orders are hidden from all columns.
 *
 * Features:
 * - Horizontal ScrollView containing 4 KanbanColumn components
 * - Real-time order updates via useOrders hook
 * - Tap on order card navigates to OrderDetail (ItemDetail) screen
 * - Tap on advance button calls orderService.updateOrderStatus
 * - Loading state with ActivityIndicator
 * - Error state with retry button
 */

import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { KanbanColumn } from '../../components/KanbanColumn';
import { useOrders } from '../../hooks/useOrders';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../hooks/useRestaurant';
import { orderService } from '../../services/orders/OrderService';
import { KANBAN_COLUMNS } from '../../utils/constants';
import { filterOrdersForKanban } from '../../utils/kanbanUtils';
import type { ComandasBoardScreenProps } from '../../types/navigation';
import type { OrderStatus } from '../../types/models';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ComandasScreen({ navigation }: ComandasBoardScreenProps) {
  // -------------------------------------------------------------------------
  // Auth — get restaurantId from the authenticated user's metadata
  // -------------------------------------------------------------------------
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------
  const { orders, loading, error, refetch } = useOrders(restaurantId);
  
  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Filter out cancelled orders before distributing to columns
  const visibleOrders = filterOrdersForKanban(orders);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleOrderPress = useCallback(
    (orderId: string) => {
      // Navigate to ItemDetail screen (ComandasStack)
      navigation.navigate('ItemDetail', { itemId: orderId });
    },
    [navigation]
  );

  const handleStatusAdvance = useCallback(
    async (orderId: string, nextStatus: OrderStatus) => {
      try {
        await orderService.updateOrderStatus(orderId, nextStatus);
      } catch (err) {
        // Errors are handled silently; real-time subscription will reflect
        // the actual state from the server.
        console.warn('[ComandasScreen] Failed to advance order status:', err);
      }
    },
    []
  );

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Cargando comandas…</Text>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>No se pudieron cargar las comandas.</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          accessibilityLabel="Reintentar carga de comandas"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Main board
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.boardContent}
        style={styles.board}
      >
        {KANBAN_COLUMNS.map((column) => {
          const columnOrders = visibleOrders.filter((order) =>
            (column.statuses as readonly OrderStatus[]).includes(order.status)
          );

          return (
            <KanbanColumn
              key={column.label}
              title={column.label}
              orders={columnOrders}
              onOrderPress={handleOrderPress}
              onStatusAdvance={handleStatusAdvance}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
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
  board: {
    flex: 1,
  },
  boardContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 15,
    color: '#374151',
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
    fontSize: 15,
    fontWeight: '600',
  },
});
