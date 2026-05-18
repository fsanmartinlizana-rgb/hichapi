/**
 * ClientMenuScreen — menu browsing screen for restaurant clients.
 * Fetches menu items, groups by category, shows cart summary and Chapi chat.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MenuItemCard } from '../../components/MenuItemCard';
import { ChapiChatModal } from '../../components/ChapiChatModal';
import { supabase } from '../../config/supabase';
import { useCart } from '../../hooks/useCart';
import { useRestaurant } from '../../hooks/useRestaurant';
import { apiClient } from '../../services/api/APIClient';
import { formatCLP } from '../../utils/formatters';
import type { MenuItem } from '../../types/models';
import type { ClientMenuScreenProps } from '../../types/navigation';

interface MenuSection {
  title: string;
  data: MenuItem[];
}

export default function ClientMenuScreen({ route, navigation }: ClientMenuScreenProps) {
  const { restaurantId, tableId } = route.params;
  const { cart, total, itemCount, addItem } = useCart();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [requestingBill, setRequestingBill] = useState(false);
  const [billRequested, setBillRequested] = useState(false);

  // Fetch menu items directly from Supabase
  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from('menu_items')
      .select('id, restaurant_id, name, description, price, category, tags, available')
      .eq('restaurant_id', restaurantId)
      .eq('available', true)
      .order('category')
      .then(({ data, error: err }) => {
        if (err) {
          setError('No se pudo cargar el menú.');
        } else {
          setMenuItems((data ?? []) as MenuItem[]);
        }
        setLoading(false);
      });
  }, [restaurantId]);

  // Group items by category
  const sections = useMemo<MenuSection[]>(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
      const existing = map.get(item.category) ?? [];
      map.set(item.category, [...existing, item]);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [menuItems]);

  const handleAddToCart = useCallback(
    async (item: MenuItem) => {
      await addItem(item, 1);
    },
    [addItem]
  );

  const handleRequestBill = useCallback(async () => {
    setRequestingBill(true);
    try {
      await apiClient.patch(`/api/orders/${tableId}`, { status: 'paying' });
      setBillRequested(true);
    } catch {
      Alert.alert('Error', 'No se pudo solicitar la cuenta. Intenta nuevamente.');
    } finally {
      setRequestingBill(false);
    }
  }, [tableId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Bill requested confirmation */}
      {billRequested && (
        <View style={styles.billConfirmation}>
          <Text style={styles.billConfirmationText}>✅ Tu garzón ha sido notificado</Text>
        </View>
      )}

      {/* Menu list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MenuItemCard item={item} onAddToCart={handleAddToCart} />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No hay ítems disponibles.</Text>
          </View>
        }
      />

      {/* Request bill button (shown when order is ready) */}
      {orderStatus === 'ready' && !billRequested && (
        <TouchableOpacity
          style={styles.billButton}
          onPress={handleRequestBill}
          disabled={requestingBill}
          accessibilityLabel="Pedir la cuenta"
          accessibilityRole="button"
        >
          {requestingBill ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.billButtonText}>Pedir la cuenta</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Cart summary bar */}
      {itemCount > 0 && (
        <View style={styles.cartBar}>
          <View style={styles.cartInfo}>
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
            <Text style={styles.cartTotal}>{formatCLP(total)}</Text>
          </View>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => navigation.navigate('Cart')}
            accessibilityLabel="Ver carrito"
            accessibilityRole="button"
          >
            <Text style={styles.cartButtonText}>Ver carrito →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Chapi chat button */}
      <TouchableOpacity
        style={styles.chapiButton}
        onPress={() => setChatVisible(true)}
        accessibilityLabel="Abrir chat con Chapi"
        accessibilityRole="button"
      >
        <Text style={styles.chapiButtonText}>🤖</Text>
      </TouchableOpacity>

      {/* Chapi chat modal */}
      <ChapiChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        restaurantId={restaurantId}
        tableId={tableId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  listContent: { paddingBottom: 120 },
  sectionHeader: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  billConfirmation: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#6EE7B7',
  },
  billConfirmationText: { fontSize: 14, color: '#065F46', fontWeight: '600' },
  billButton: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  billButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cartInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartBadge: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  cartBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cartTotal: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cartButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  chapiButton: {
    position: 'absolute',
    bottom: 72,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  chapiButtonText: { fontSize: 24 },
});
