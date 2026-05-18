/**
 * MenuItemCard — displays a single menu item with an "Agregar" button.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatCLP } from '../utils/formatters';
import type { MenuItem } from '../types/models';

export interface MenuItemCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
}

function MenuItemCardComponent({ item, onAddToCart }: MenuItemCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        {item.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.price}>{formatCLP(item.price)}</Text>
      </View>
      <TouchableOpacity
        style={[styles.addButton, !item.available && styles.addButtonDisabled]}
        onPress={() => onAddToCart(item)}
        disabled={!item.available}
        accessibilityLabel={`Agregar ${item.name} al carrito`}
        accessibilityRole="button"
      >
        <Text style={styles.addButtonText}>
          {item.available ? 'Agregar' : 'No disponible'}
        </Text>
      </TouchableOpacity>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  description: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  tag: {
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tagText: { fontSize: 10, color: '#6B7280' },
  price: { fontSize: 15, fontWeight: '700', color: '#111827' },
  addButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  addButtonDisabled: { backgroundColor: '#D1D5DB' },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

export const MenuItemCard = React.memo(MenuItemCardComponent);
export default MenuItemCard;
