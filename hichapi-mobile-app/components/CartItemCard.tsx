/**
 * CartItemCard — displays a cart item with quantity controls and remove button.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatCLP } from '../utils/formatters';
import { CartCalculator } from '../services/cart/CartCalculator';
import type { CartItem } from '../types/ui';

export interface CartItemCardProps {
  item: CartItem;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

function CartItemCardComponent({ item, onUpdateQuantity, onRemove }: CartItemCardProps) {
  const subtotal = CartCalculator.calculateSubtotal(item);

  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.menu_item.name}</Text>
        {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
        <Text style={styles.subtotal}>{formatCLP(subtotal)}</Text>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => onUpdateQuantity(item.menu_item.id, item.quantity - 1)}
          accessibilityLabel="Reducir cantidad"
          accessibilityRole="button"
        >
          <Text style={styles.qtyButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => onUpdateQuantity(item.menu_item.id, item.quantity + 1)}
          accessibilityLabel="Aumentar cantidad"
          accessibilityRole="button"
        >
          <Text style={styles.qtyButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(item.menu_item.id)}
          accessibilityLabel={`Eliminar ${item.menu_item.name} del carrito`}
          accessibilityRole="button"
        >
          <Text style={styles.removeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginVertical: 4,
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 14, fontWeight: '600', color: '#111827' },
  notes: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 },
  subtotal: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: { fontSize: 18, color: '#374151', fontWeight: '600' },
  quantity: { fontSize: 15, fontWeight: '700', color: '#111827', minWidth: 20, textAlign: 'center' },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  removeButtonText: { fontSize: 12, color: '#EF4444', fontWeight: '700' },
});

export const CartItemCard = React.memo(CartItemCardComponent);
export default CartItemCard;
