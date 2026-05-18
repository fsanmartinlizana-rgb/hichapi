/**
 * CartScreen — shopping cart review and checkout.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CartItemCard } from '../../components/CartItemCard';
import { useCart } from '../../hooks/useCart';
import { apiClient } from '../../services/api/APIClient';
import { formatCLP } from '../../utils/formatters';
import type { CartItem } from '../../types/ui';
import type { CartScreenProps } from '../../types/navigation';

export default function CartScreen({ navigation }: CartScreenProps) {
  const { cart, total, itemCount, updateQuantity, removeItem, clearCart } = useCart();
  const [confirming, setConfirming] = useState(false);

  const handleConfirmOrder = useCallback(async () => {
    if (cart.items.length === 0) return;
    setConfirming(true);
    try {
      const order = await apiClient.post('/api/orders', {
        restaurant_slug: cart.restaurant_slug,
        table_id: cart.table_id,
        client_name: 'Cliente App',
        notes: '',
        cart: cart.items.map((ci) => ({
          menu_item_id: ci.menu_item.id,
          name: ci.menu_item.name,
          quantity: ci.quantity,
          unit_price: ci.menu_item.price,
          note: ci.notes || null,
        })),
      });
      await clearCart();
      Alert.alert('¡Pedido confirmado!', 'Tu pedido ha sido enviado a la cocina.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'No se pudo confirmar el pedido. Intenta nuevamente.');
    } finally {
      setConfirming(false);
    }
  }, [cart, clearCart, navigation]);

  const renderItem = useCallback(
    ({ item }: { item: CartItem }) => (
      <CartItemCard
        item={item}
        onUpdateQuantity={updateQuantity}
        onRemove={removeItem}
      />
    ),
    [updateQuantity, removeItem]
  );

  if (cart.items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
        <Text style={styles.emptySubtitle}>Agrega ítems del menú para comenzar tu pedido.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Volver al menú"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Ver menú</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cart.items}
        renderItem={renderItem}
        keyExtractor={(item) => item.menu_item.id}
        contentContainerStyle={styles.listContent}
      />

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{formatCLP(total)}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.splitButton}
          onPress={() => navigation.navigate('SplitPayment', { orderId: '', total })}
          accessibilityLabel="Dividir cuenta"
          accessibilityRole="button"
        >
          <Text style={styles.splitButtonText}>Dividir cuenta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
          onPress={handleConfirmOrder}
          disabled={confirming}
          accessibilityLabel="Confirmar pedido"
          accessibilityRole="button"
        >
          {confirming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.confirmButtonText}>Confirmar pedido</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  listContent: { paddingVertical: 8, paddingBottom: 16 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  backButton: { backgroundColor: '#FF6B35', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  backButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#374151' },
  totalAmount: { fontSize: 22, fontWeight: '800', color: '#111827' },
  actions: { padding: 16, gap: 10, backgroundColor: '#fff' },
  splitButton: {
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  splitButtonText: { color: '#FF6B35', fontSize: 15, fontWeight: '600' },
  confirmButton: { backgroundColor: '#FF6B35', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmButtonDisabled: { backgroundColor: '#FF6B3580' },
  confirmButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
