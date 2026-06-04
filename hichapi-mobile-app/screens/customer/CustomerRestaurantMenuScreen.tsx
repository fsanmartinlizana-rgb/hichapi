import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { CustomerSearchStackParamList } from '../../types/navigation';
import { customerStyles } from '../../components/customer/customerStyles';

type Props = StackScreenProps<CustomerSearchStackParamList, 'CustomerRestaurantMenu'>;

export default function CustomerRestaurantMenuScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { restaurant, menu_items } = route.params;

  // Group menu items by category
  const groupedMenu = useMemo(() => {
    const groups: Record<string, typeof menu_items> = {};
    menu_items.forEach(item => {
      const cat = item.category || 'Otros';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [menu_items]);

  return (
    <View style={[customerStyles.screen, { backgroundColor: '#FAFAF8' }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{restaurant.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
          <Text style={styles.restaurantMeta}>
            {restaurant.neighborhood} · {restaurant.cuisine_type}
          </Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color="#fff" />
            <Text style={styles.ratingText}>{restaurant.rating}</Text>
          </View>
        </View>

        {Object.keys(groupedMenu).map(category => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.toUpperCase()}</Text>
            
            {groupedMenu[category].map(item => (
              <View key={item.id} style={styles.menuItem}>
                <View style={styles.itemContent}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.itemDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <Text style={styles.itemPrice}>
                    ${item.price.toLocaleString('es-CL')}
                  </Text>
                </View>
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.itemImage} />
                ) : (
                  <View style={styles.itemImagePlaceholder}>
                    <Ionicons name="restaurant-outline" size={24} color="#C1C1C1" />
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}

        {menu_items.length === 0 && (
          <Text style={styles.emptyText}>Este restaurante no tiene menú registrado.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  restaurantInfo: {
    padding: 24,
    backgroundColor: '#fff',
    marginBottom: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 4,
    textAlign: 'center',
  },
  restaurantMeta: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  categorySection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 16,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 18,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  itemImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 40,
    fontSize: 16,
  },
});
