/**
 * GarzonScreen — main order management panel for waitstaff.
 *
 * Features:
 * - FlatList of OrderCard components
 * - Filter bar with status filter buttons (All, Pending, Confirmed, Preparing, Ready, Paying)
 * - Pull-to-refresh calling refetch()
 * - Wired to orderService.updateOrderStatus when action button pressed
 * - Amber visual alert for 'paying' orders (handled inside OrderCard)
 * - Empty state when no orders match filter
 * - Loading state with ActivityIndicator
 * - Error state with retry button
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOrders } from '../../hooks/useOrders';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../hooks/useRestaurant';
import { orderService } from '../../services/orders/OrderService';
import { OrderCard } from '../../components/OrderCard';
import { ORDER_STATUS_LABELS } from '../../utils/constants';
import { supabase } from '../../config/supabase';
import { apiClient } from '../../services/api/APIClient';
import { TicketService, type TicketContext } from '../../services/printing/TicketService';
import { TicketPrinterModal } from '../../components/TicketPrinterModal';
import { BillSplitModal } from '../../components/BillSplitModal';
import type { Order, OrderStatus, MenuItem, Table, Printer, TicketGroup } from '../../types/models';
import type { GarzonListScreenProps } from '../../types/navigation';
import { useFocusEffect } from '@react-navigation/native';

// ---------------------------------------------------------------------------
// Filter configuration
// ---------------------------------------------------------------------------

type FilterOption = 'all' | OrderStatus;

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: ORDER_STATUS_LABELS.pending },
  { key: 'confirmed', label: ORDER_STATUS_LABELS.confirmed },
  { key: 'preparing', label: ORDER_STATUS_LABELS.preparing },
  { key: 'ready', label: ORDER_STATUS_LABELS.ready },
  { key: 'paying', label: ORDER_STATUS_LABELS.paying },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GarzonScreen({ navigation }: GarzonListScreenProps) {
  const { user } = useAuth();
  const { restaurantId, address, neighborhood } = useRestaurant();

  const { orders, loading, error, refetch } = useOrders(restaurantId);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [refreshing, setRefreshing] = useState(false);

  // -------------------------------------------------------------------------
  // New order state
  // -------------------------------------------------------------------------
  const [newOrderModal, setNewOrderModal] = useState(false);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [orderLines, setOrderLines] = useState<{ item: MenuItem; qty: number; note: string }[]>([]);
  const [clientName, setClientName] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [printers, setPrinters] = useState<Printer[]>([]);

  // Printer selection state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketGroups, setTicketGroups] = useState<TicketGroup[]>([]);
  const [ticketCtx, setTicketCtx] = useState<TicketContext | null>(null);
  const [isPrecuentaSelection, setIsPrecuentaSelection] = useState(false);
  const [showBillSplitModal, setShowBillSplitModal] = useState(false);
  const [orderToPay, setOrderToPay] = useState<Order | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const openNewOrder = useCallback(async () => {
    // Load tables and menu items
    const [{ data: tablesData }, { data: menuData }, printersRes] = await Promise.all([
      supabase.from('tables').select('id, label, status').eq('restaurant_id', restaurantId).order('label'),
      supabase.from('menu_items').select('id, name, price, category, destination').eq('restaurant_id', restaurantId).eq('available', true).order('category'),
      TicketService.getPrinters(restaurantId),
    ]);
    setTables((tablesData ?? []) as Table[]);
    setMenuItems((menuData ?? []) as MenuItem[]);
    setPrinters(printersRes);
    setSelectedTableId('');
    setOrderLines([]);
    setClientName('');
    setSearchQuery('');
    setTableSearchQuery('');
    setActiveCategory(null);
    setNewOrderModal(true);
  }, [restaurantId]);

  // Load printers when screen focuses to have them ready for pre-check
  useFocusEffect(
    useCallback(() => {
      if (restaurantId) {
        TicketService.getPrinters(restaurantId).then((p) => {
          console.log(`[GarzonScreen] Loaded ${p.length} printers`);
          setPrinters(p);
        });
      }
    }, [restaurantId])
  );

  const addLine = useCallback((item: MenuItem) => {
    setOrderLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) return prev.map((l) => l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { item, qty: 1, note: '' }];
    });
  }, []);

  const updateLineNote = useCallback((itemId: string, note: string) => {
    setOrderLines((prev) => prev.map((l) => l.item.id === itemId ? { ...l, note } : l));
  }, []);

  const removeLine = useCallback((itemId: string) => {
    setOrderLines((prev) => prev.filter((l) => l.item.id !== itemId));
  }, []);

  const handleCreateOrder = useCallback(async () => {
    if (!selectedTableId) { Alert.alert('Error', 'Selecciona una mesa.'); return; }
    if (orderLines.length === 0) { Alert.alert('Error', 'Agrega al menos un ítem.'); return; }
    setCreatingOrder(true);
    try {
      const res = await apiClient.post('/api/orders/internal', {
        restaurant_id: restaurantId,
        table_id: selectedTableId,
        client_name: clientName.trim() || 'Garzón',
        cart: orderLines.map((l) => ({
          menu_item_id: l.item.id,
          name: l.item.name,
          quantity: l.qty,
          unit_price: l.item.price,
          note: l.note.trim() || undefined,
          destination: (l.item as any).destination ?? 'cocina',
        })),
      });

      const orderId = res.orderId;
      const table = tables.find((t) => t.id === selectedTableId);

      setNewOrderModal(false);
      await refetch();

      // Dispatch tickets
      if (orderId && printers.length > 0) {
        const ctx: TicketContext = {
          restaurantId,
          orderId,
          tableLabel: table?.label || 'Mesa',
          waiterName: user?.email?.split('@')[0] || 'Garzón',
          clientName: clientName.trim() || 'Cliente',
          address,
          neighborhood,
        };

        const groups = await TicketService.prepareAndSendTickets(
          orderLines.map((l) => ({
            name: l.item.name,
            quantity: l.qty,
            notes: l.note,
            destination: (l.item as any).destination ?? 'cocina',
          })),
          ctx,
          printers
        );

        if (groups.length > 0) {
          setTicketGroups(groups);
          setTicketCtx(ctx);
          setIsPrecuentaSelection(false);
          setShowTicketModal(true);
        } else {
          Alert.alert('✅ Pedido creado', 'La comanda fue enviada a impresión.');
        }
      } else {
        Alert.alert('✅ Pedido creado', 'La comanda fue registrada.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear el pedido';
      Alert.alert('Error', msg);
    } finally {
      setCreatingOrder(false);
    }
  }, [selectedTableId, orderLines, clientName, restaurantId, refetch]);

  // -------------------------------------------------------------------------
  // Filtered Menu Items
  // -------------------------------------------------------------------------

  const categories = useMemo(() => {
    const cats = new Set(menuItems.map((i) => i.category));
    return Array.from(cats).sort();
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !activeCategory || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchQuery, activeCategory]);

  const groupedMenuItems = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    filteredMenuItems.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredMenuItems]);

  const filteredTables = useMemo(() => {
    if (!tableSearchQuery) return tables;
    return tables.filter((t) => t.label.toLowerCase().includes(tableSearchQuery.toLowerCase()));
  }, [tables, tableSearchQuery]);

  // -------------------------------------------------------------------------
  // Filtered orders
  // -------------------------------------------------------------------------

  const filteredOrders = useMemo<Order[]>(() => {
    if (activeFilter === 'all') {
      return orders;
    }
    return orders.filter((o) => o.status === activeFilter);
  }, [orders, activeFilter]);

  // -------------------------------------------------------------------------
  // Pull-to-refresh
  // -------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // -------------------------------------------------------------------------
  // Status advance
  // -------------------------------------------------------------------------

  const handleStatusAdvance = useCallback(
    async (orderId: string, nextStatus: OrderStatus) => {
      if (nextStatus === 'paid') {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          setOrderToPay(order);
          setShowBillSplitModal(true);
          return;
        }
      }

      console.log(`[GarzonScreen] Advancing order ${orderId} to ${nextStatus}`);
      try {
        await orderService.updateOrderStatus(orderId, nextStatus);
        
        // Handle pre-check (precuenta) printing if moving to 'paying'
        if (nextStatus === 'paying' && printers.length > 0) {
          try {
            console.log(`[GarzonScreen] Fetching order details for pre-check: /api/orders/${orderId}`);
            const orderData = await apiClient.get(`/api/orders/${orderId}`);
            if (!orderData) throw new Error('No se pudieron obtener los datos de la orden');

            const table = tables.find(t => t.id === orderData.table_id);
            const cajaPrinters = printers.filter(p => p.kind === 'caja');

            if (cajaPrinters.length > 0) {
              const ctx: TicketContext = {
                restaurantId,
                orderId,
                tableLabel: table?.label || 'Mesa',
                waiterName: user?.email?.split('@')[0] || 'Garzón',
                clientName: orderData.client_name || 'Cliente',
                address,
                neighborhood,
              };

              const items = orderData.order_items || [];
              
              if (cajaPrinters.length === 1) {
                // Auto-send
                console.log(`[GarzonScreen] Auto-sending pre-check to ${cajaPrinters[0].name}`);
                const success = await TicketService.requestPrecuenta(cajaPrinters[0].name, ctx, orderData, items);
                if (success) {
                  Alert.alert('✅ Precuenta enviada', `La precuenta se envió a ${cajaPrinters[0].name}`);
                } else {
                  Alert.alert('⚠️ Error', 'La precuenta se marcó como "Pagando" pero no se pudo imprimir.');
                }
              } else {
                // Selection modal
                console.log(`[GarzonScreen] Showing printer selection modal for ${cajaPrinters.length} printers`);
                setTicketGroups([{
                  kind: 'caja',
                  items: items.map((i: any) => ({ nombre: i.name, cantidad: i.quantity, precio: i.unit_price })),
                  printers: cajaPrinters.map(p => ({ id: p.id, name: p.name })),
                }]);
                setTicketCtx(ctx);
                setIsPrecuentaSelection(true);
                setShowTicketModal(true);
              }
            } else {
              console.warn('[GarzonScreen] No hay impresoras de tipo "caja" configuradas.');
              Alert.alert('Aviso', 'El pedido cambió a "Pagando", pero no hay impresoras de tipo "caja" configuradas para la precuenta.');
            }
          } catch (fetchErr) {
            console.error('[GarzonScreen] Error fetching order details for pre-check:', fetchErr);
            Alert.alert('Error', 'No se pudieron obtener los detalles del pedido para la precuenta.');
          }
        }

        await refetch();
      } catch (err) {
        Alert.alert(
          'Error',
          'No se pudo actualizar el estado del pedido. Intenta nuevamente.',
          [{ text: 'OK' }]
        );
      }
    },
    [refetch, orders, printers, tables, restaurantId, user, address, neighborhood]
  );


  // -------------------------------------------------------------------------
  // Navigate to order detail
  // -------------------------------------------------------------------------

  const handleOrderPress = useCallback(
    (orderId: string) => {
      navigation.navigate('OrderDetail', { orderId });
    },
    [navigation]
  );

  const onTicketConfirm = useCallback(async (selections: Record<string, string>) => {
    if (!ticketCtx) return;
    setShowTicketModal(false);

    const sends: Promise<boolean>[] = [];

    if (isPrecuentaSelection) {
      const printerName = selections['caja'];
      const order = orders.find(o => o.id === ticketCtx.orderId);
      if (order && printerName) {
        try {
          const { order_items } = await apiClient.get(`/api/orders/${ticketCtx.orderId}`);
          await TicketService.requestPrecuenta(printerName, ticketCtx, order, order_items || []);
          Alert.alert('✅ Precuenta enviada', `Se solicitó la precuenta en la impresora ${printerName}.`);
        } catch (err) {
          console.error('[GarzonScreen] Error sending pre-check:', err);
        }
      }
    } else {
      for (const group of ticketGroups) {
        const printerName = selections[group.kind];
        if (printerName) {
          sends.push(TicketService.postTicket(printerName, ticketCtx, group.items.map(i => ({
            name: i.nombre,
            quantity: i.cantidad,
            notes: i.observacion
          }))));
        }
      }
      await Promise.allSettled(sends);
      Alert.alert('✅ Tickets enviados', 'Las comandas fueron enviadas a impresión.');
    }
    
    setTicketCtx(null);
    setTicketGroups([]);
  }, [ticketCtx, isPrecuentaSelection, orders, ticketGroups]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderOrder = useCallback(
    ({ item }: { item: Order }) => (
      <OrderCard
        order={item}
        onPress={() => handleOrderPress(item.id)}
        onStatusAdvance={handleStatusAdvance}
        showActions
      />
    ),
    [handleOrderPress, handleStatusAdvance]
  );

  const keyExtractor = useCallback((item: Order) => item.id, []);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Cargando pedidos…</Text>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No se pudieron cargar los pedidos.</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={refetch}
          accessibilityLabel="Reintentar cargar pedidos"
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
      {/* ------------------------------------------------------------------ */}
      {/* Filter bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {FILTER_OPTIONS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterButton,
              activeFilter === key && styles.filterButtonActive,
            ]}
            onPress={() => setActiveFilter(key)}
            accessibilityLabel={`Filtrar por ${label}`}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.filterButtonText,
                activeFilter === key && styles.filterButtonTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ------------------------------------------------------------------ */}
      {/* Order list                                                          */}
      {/* ------------------------------------------------------------------ */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={keyExtractor}
        contentContainerStyle={
          filteredOrders.length === 0 ? styles.emptyListContent : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FF6B35"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📋</Text>
            <Text style={styles.emptyStateTitle}>Sin pedidos</Text>
            <Text style={styles.emptyStateSubtitle}>
              {activeFilter === 'all'
                ? 'No hay pedidos activos en este momento.'
                : `No hay pedidos con estado "${FILTER_OPTIONS.find((f) => f.key === activeFilter)?.label ?? activeFilter}".`}
            </Text>
          </View>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* FAB — Nuevo pedido                                                  */}
      {/* ------------------------------------------------------------------ */}
      <TouchableOpacity
      style={styles.fab}
      onPress={openNewOrder}
      accessibilityLabel="Crear nuevo pedido"
      accessibilityRole="button"
    >
      <Text style={styles.fabText}>+</Text>
    </TouchableOpacity>

      {/* ------------------------------------------------------------------ */}
      {/* New Order Modal                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Modal visible={newOrderModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuevo Pedido</Text>
            <TouchableOpacity onPress={() => setNewOrderModal(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView stickyHeaderIndices={[1]}>
            <View>
              {/* 1. Client Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionLabel}>Datos del Cliente</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Nombre (opcional)"
                  value={clientName}
                  onChangeText={setClientName}
                />
              </View>

              {/* 2. Table Selection */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionLabel}>Mesa</Text>
                <TextInput
                  style={styles.tableSearchInput}
                  placeholder="Buscar mesa por nombre..."
                  value={tableSearchQuery}
                  onChangeText={setTableSearchQuery}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
                  {filteredTables.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.tableChip, selectedTableId === t.id && styles.tableChipActive]}
                      onPress={() => setSelectedTableId(t.id)}
                    >
                      <Text style={[styles.tableChipText, selectedTableId === t.id && styles.tableChipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* 3. Current Order Summary (if any) */}
              {orderLines.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionLabel}>Resumen del pedido</Text>
                  {orderLines.map((line) => (
                    <View key={line.item.id} style={styles.lineItemContainer}>
                      <View style={styles.lineRow}>
                        <Text style={styles.lineName}>{line.qty}x {line.item.name}</Text>
                        <TouchableOpacity onPress={() => removeLine(line.item.id)} style={styles.qtyBtn}>
                          <Text style={styles.lineRemove}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={styles.lineNoteInput}
                        placeholder="Nota o comentario (ej. sin cebolla)..."
                        value={line.note}
                        onChangeText={(text) => updateLineNote(line.item.id, text)}
                        multiline
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 4. Product Search & Categories (Sticky Header Index 1) */}
            <View style={styles.searchAndCategoryHeader}>
              <Text style={styles.sectionLabel}>Agregar productos</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar producto por nombre..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                <TouchableOpacity
                  style={[styles.categoryChip, !activeCategory && styles.categoryChipActive]}
                  onPress={() => setActiveCategory(null)}
                >
                  <Text style={[styles.categoryChipText, !activeCategory && styles.categoryChipTextActive]}>Todos</Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, activeCategory === cat && styles.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 5. Menu Items */}
            <View style={styles.menuItemsList}>
              {Object.entries(groupedMenuItems).map(([category, items]) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryHeader}>{category}</Text>
                  {items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.menuItemRow}
                      onPress={() => addLine(item)}
                      accessibilityRole="button"
                    >
                      <View style={styles.menuItemInfo}>
                        <Text style={styles.menuItemName}>{item.name}</Text>
                      </View>
                      <Text style={styles.menuItemPrice}>${item.price.toLocaleString('es-CL')}</Text>
                      <View style={styles.addBtn}>
                        <Text style={styles.addBtnText}>+</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              {Object.keys(groupedMenuItems).length === 0 && (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResults}>No se encontraron productos.</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmBtn, (!selectedTableId || orderLines.length === 0) && styles.confirmBtnDisabled]}
            onPress={handleCreateOrder}
            disabled={creatingOrder || !selectedTableId || orderLines.length === 0}
          >
            <Text style={styles.confirmBtnText}>
              {creatingOrder ? 'Enviando...' : 'Confirmar pedido'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      <TicketPrinterModal
        visible={showTicketModal}
        groups={ticketGroups}
        title={isPrecuentaSelection ? 'Seleccionar impresora para precuenta' : 'Enviar tickets a cocina/barra'}
        onConfirm={onTicketConfirm}
        onCancel={() => setShowTicketModal(false)}
      />

      <BillSplitModal
        visible={showBillSplitModal}
        tableLabel={tables.find(t => t.id === orderToPay?.table_id)?.label || 'Mesa'}
        tableId={orderToPay?.table_id || ''}
        orderIds={orderToPay ? [orderToPay.id] : []}
        totalAmount={orderToPay?.total || 0}
        restaurantId={restaurantId}
        onClose={() => setShowBillSplitModal(false)}
        onComplete={async () => {
          setShowBillSplitModal(false);
          setOrderToPay(null);
          await refetch();
        }}
      />
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
  filterBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    maxHeight: 52,
  },
  filterBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: '#FFF3EE',
    borderColor: '#FF6B35',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 24,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  noResults: { textAlign: 'center', color: '#9CA3AF', marginTop: 24, fontSize: 14 },
  // Layout & Modal Refinement
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff' 
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  closeBtn: { fontSize: 22, color: '#6B7280', padding: 4 },
  modalSection: { paddingHorizontal: 16, marginTop: 16 },
  modalInput: { 
    backgroundColor: '#F9FAFB', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    borderRadius: 8, 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    fontSize: 14, 
    color: '#111827' 
  },
  sectionLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#6B7280', 
    marginBottom: 8, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  tableSearchInput: { 
    backgroundColor: '#F3F4F6', 
    borderRadius: 8, 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    fontSize: 13, 
    marginBottom: 10 
  },
  tableScroll: { paddingHorizontal: 0, marginBottom: 8 },
  tableChip: { 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 20, 
    backgroundColor: '#F3F4F6', 
    marginRight: 8, 
    borderWidth: 1, 
    borderColor: 'transparent' 
  },
  tableChipActive: { backgroundColor: '#FFF3EE', borderColor: '#FF6B35' },
  tableChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  tableChipTextActive: { color: '#FF6B35', fontWeight: '700' },
  lineRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#FDF2F0', 
  },
  lineItemContainer: {
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FDF2F0',
  },
  lineNoteInput: {
    backgroundColor: '#fff',
    padding: 8,
    fontSize: 12,
    color: '#4B5563',
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    minHeight: 36,
  },
  lineName: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  lineRemove: { fontSize: 18, color: '#EF4444', marginLeft: 12 },
  searchAndCategoryHeader: { 
    backgroundColor: '#fff', 
    paddingTop: 16, 
    paddingBottom: 8, 
    paddingHorizontal: 16,
    borderTopWidth: 8, 
    borderTopColor: '#F9FAFB', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  searchInput: { 
    backgroundColor: '#F3F4F6', 
    borderRadius: 10, 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    fontSize: 14, 
    marginBottom: 12 
  },
  categoryScroll: { paddingHorizontal: 0, marginBottom: 4 },
  categoryChip: { 
    paddingVertical: 6, 
    paddingHorizontal: 14, 
    borderRadius: 15, 
    backgroundColor: '#F3F4F6', 
    marginRight: 8 
  },
  categoryChipActive: { backgroundColor: '#111827' },
  categoryChipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  menuItemsList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  categorySection: { marginBottom: 20 },
  categoryHeader: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: '#9CA3AF', 
    textTransform: 'uppercase', 
    marginBottom: 10 
  },
  menuItemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 8, 
    borderWidth: 1, 
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  menuItemInfo: { flex: 1 },
  menuItemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  menuItemPrice: { fontSize: 14, fontWeight: '700', color: '#374151', marginRight: 12 },
  addBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#FF6B35', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '300', lineHeight: 26 },
  confirmBtn: { 
    margin: 16, 
    backgroundColor: '#FF6B35', 
    borderRadius: 12, 
    paddingVertical: 16, 
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  confirmBtnDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  noResultsContainer: { alignItems: 'center', paddingVertical: 40 },
});
