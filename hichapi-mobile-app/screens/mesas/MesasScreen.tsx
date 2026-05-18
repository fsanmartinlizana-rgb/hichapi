/**
 * MesasScreen — grid view of all restaurant tables.
 *
 * Features:
 * - Fetches tables from GET /api/tables?restaurant_id=...
 * - Uses useOrders for alert badges (bell/banknote)
 * - Uses useRealtime for live table updates
 * - FlatList in 2-column grid layout
 * - Pull-to-refresh
 * - Bell badge when table has 'pending' or 'confirmed' order
 * - Banknote badge when table has 'paying' order
 * - Tap on table → TableDetail screen
 * - Tap on QR button → QRGenerator screen
 * - "Agregar Mesa" button (admin/owner only) with label input modal
 * - Loading and error states
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { TableCard } from '../../components/TableCard';
import { useOrders } from '../../hooks/useOrders';
import { useRealtime } from '../../hooks/useRealtime';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../hooks/useRestaurant';
import { supabase } from '../../config/supabase';
import { applyRealtimeUpdate } from '../../utils/realtimeReducer';
import type { Table, Order } from '../../types/models';
import type { MesasGridScreenProps } from '../../types/navigation';
import type { RealtimePayload } from '../../services/realtime/RealtimeService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns orders that belong to a specific table. */
function getOrdersForTable(orders: Order[], tableId: string): Order[] {
  return orders.filter((o) => o.table_id === tableId);
}

/** Returns true if the user has admin or owner role. */
function isAdminOrOwner(role?: string): boolean {
  return role === 'admin' || role === 'owner' || role === 'super_admin';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MesasScreen({ navigation }: MesasGridScreenProps) {
  const { user } = useAuth();
  const { restaurantId, role: userRole } = useRestaurant();

  // -------------------------------------------------------------------------
  // Tables state
  // -------------------------------------------------------------------------

  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTables = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const { data, error: err } = await supabase
        .from('tables')
        .select('id, label, seats, zone, smoking, status, qr_token, restaurant_id')
        .eq('restaurant_id', restaurantId)
        .order('label');
      if (err) throw new Error(err.message);
      setTables((data ?? []) as Table[]);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar las mesas';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // -------------------------------------------------------------------------
  // Orders (for alert badges)
  // -------------------------------------------------------------------------

  const { orders, refetch: refetchOrders } = useOrders(restaurantId);
  
  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchTables();
      refetchOrders();
    }, [fetchTables, refetchOrders])
  );

  // -------------------------------------------------------------------------
  // Realtime table updates
  // -------------------------------------------------------------------------

  useRealtime<Table>(
    `tables:${restaurantId}`,
    'tables',
    `restaurant_id=eq.${restaurantId}`,
    useCallback(
      (payload: RealtimePayload<Table>) => {
        setTables((current) => applyRealtimeUpdate(current, payload));
      },
      []
    )
  );

  // -------------------------------------------------------------------------
  // Pull-to-refresh
  // -------------------------------------------------------------------------

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTables();
  }, [fetchTables]);

  // -------------------------------------------------------------------------
  // Navigation handlers
  // -------------------------------------------------------------------------

  const handleTablePress = useCallback(
    (tableId: string) => {
      navigation.navigate('TableDetail', { tableId });
    },
    [navigation]
  );

  const handleQRPress = useCallback(
    (table: Table) => {
      navigation.navigate('QRGenerator', {
        tableId: table.id,
        tableLabel: table.label,
        qrToken: table.qr_token,
      });
    },
    [navigation]
  );

  // -------------------------------------------------------------------------
  // Add Table modal
  // -------------------------------------------------------------------------

  const [modalVisible, setModalVisible] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState('');
  const [addingTable, setAddingTable] = useState(false);

  const handleAddTable = useCallback(async () => {
    const label = newTableLabel.trim();
    if (!label) {
      Alert.alert('Error', 'Por favor ingresa un nombre para la mesa.');
      return;
    }
    setAddingTable(true);
    try {
      const qrToken = `qr-${label.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 10)}`;
      const { error: err } = await supabase
        .from('tables')
        .insert({
          restaurant_id: restaurantId,
          label,
          seats: 4,
          zone: 'interior',
          smoking: false,
          status: 'libre',
          qr_token: qrToken,
        });
      if (err) throw new Error(err.message);
      setModalVisible(false);
      setNewTableLabel('');
      fetchTables();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al agregar la mesa';
      Alert.alert('Error', message);
    } finally {
      setAddingTable(false);
    }
  }, [newTableLabel, restaurantId, fetchTables]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderItem = useCallback(
    ({ item }: { item: Table }) => {
      const tableOrders = getOrdersForTable(orders, item.id);
      return (
        <TableCard
          table={item}
          orders={tableOrders}
          onPress={() => handleTablePress(item.id)}
          onQRPress={() => handleQRPress(item)}
        />
      );
    },
    [orders, handleTablePress, handleQRPress]
  );

  const keyExtractor = useCallback((item: Table) => item.id, []);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Cargando mesas…</Text>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchTables}
          accessibilityLabel="Reintentar cargar mesas"
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

  return (
    <View style={styles.container}>
      <FlatList
        data={tables}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FF6B35"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay mesas registradas.</Text>
          </View>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Agregar Mesa button (admin/owner only)                              */}
      {/* ------------------------------------------------------------------ */}
      {isAdminOrOwner(userRole) && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Agregar mesa"
          accessibilityRole="button"
        >
          <Text style={styles.addButtonText}>+ Agregar Mesa</Text>
        </TouchableOpacity>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Add Table Modal                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nueva Mesa</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Nombre de la mesa (ej. Mesa 5)"
              value={newTableLabel}
              onChangeText={setNewTableLabel}
              autoFocus
              accessibilityLabel="Nombre de la nueva mesa"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setModalVisible(false);
                  setNewTableLabel('');
                }}
                accessibilityLabel="Cancelar agregar mesa"
                accessibilityRole="button"
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleAddTable}
                disabled={addingTable}
                accessibilityLabel="Confirmar agregar mesa"
                accessibilityRole="button"
              >
                {addingTable ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Agregar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  listContent: {
    padding: 6,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonCancelText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonConfirm: {
    backgroundColor: '#FF6B35',
  },
  modalButtonConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
