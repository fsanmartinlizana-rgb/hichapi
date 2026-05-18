/**
 * screens/rider/RiderMarketplaceScreen.tsx
 *
 * Marketplace — list of restaurants available for delivery, sorted by distance.
 * Tapping a restaurant opens RestaurantOrdersSheet to let the rider choose an order.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native'
import { getMarketplace } from '../../services/rider/api'
import { getCurrentPosition } from '../../services/rider/geolocation'
import { useRiderStore } from '../../services/rider/store'
import RestaurantOrdersSheet from './RestaurantOrdersSheet'
import type { MarketplaceRestaurant, DeliveryOrder, VehicleType } from '../../../lib/delivery/types'

interface Props {
  token: string
  vehicleType?: VehicleType
  onBack?: () => void
}

export default function RiderMarketplaceScreen({ token, vehicleType, onBack }: Props) {
  const { addActiveOrder, riderProfile } = useRiderStore()
  const [listings, setListings] = useState<MarketplaceRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRestaurant, setSelectedRestaurant] = useState<MarketplaceRestaurant | null>(null)

  const load = useCallback(async () => {
    const pos = await getCurrentPosition()
    const data = await getMarketplace(token, pos?.lat ?? null, pos?.lng ?? null, {
      vehicle_type: vehicleType,
    })
    setListings(data)
  }, [token, vehicleType])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  function handleRestaurantTap(restaurant: MarketplaceRestaurant) {
    if (restaurant.pending_orders_count === 0) return
    if (riderProfile?.status !== 'available' && riderProfile?.status !== 'busy') return
    setSelectedRestaurant(restaurant)
  }

  function handleOrderAccepted(order: DeliveryOrder) {
    setSelectedRestaurant(null)
    addActiveOrder(order)
    // Refresh listings to update pending counts
    load()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FF6B35" size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Mis pedidos activos</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title}>Restaurantes disponibles</Text>
      {riderProfile?.status === 'offline' && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            🔴 Estás offline — ve a Perfil para ponerte disponible
          </Text>
        </View>
      )}
      <FlatList
        data={listings}
        keyExtractor={item => item.restaurant_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={styles.emptyText}>No hay restaurantes disponibles en tu zona</Text>
          </View>
        }
        renderItem={({ item }) => {
          const hasPending = item.pending_orders_count > 0
          return (
            <TouchableOpacity
              style={[styles.card, !hasPending && { opacity: 0.6 }]}
              activeOpacity={0.7}
              disabled={!hasPending}
              onPress={() => handleRestaurantTap(item)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.restaurantName}>{item.name}</Text>
                <Text style={styles.distance}>{item.distance_km.toFixed(1)} km</Text>
              </View>
              {item.cuisine_type && (
                <Text style={styles.meta}>{item.cuisine_type} · {item.neighborhood}</Text>
              )}
              <View style={styles.cardFooter}>
                <Text style={styles.fee}>
                  ${item.fee_range.min.toLocaleString('es-CL')} – ${item.fee_range.max.toLocaleString('es-CL')} CLP
                </Text>
                <View style={[styles.badge, hasPending ? styles.badgeActive : styles.badgeInactive]}>
                  <Text style={[styles.badgeText, hasPending && styles.badgeTextActive]}>
                    {hasPending
                      ? `${item.pending_orders_count} pedido${item.pending_orders_count > 1 ? 's' : ''} →`
                      : 'Sin pedidos'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      <RestaurantOrdersSheet
        visible={!!selectedRestaurant}
        restaurant={selectedRestaurant}
        token={token}
        onClose={() => setSelectedRestaurant(null)}
        onOrderAccepted={handleOrderAccepted}
      />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: '#0A0A14' },
  container:      { flex: 1, padding: 16 },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A14' },
  backBtn:        { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingVertical: 4 },
  backBtnText:    { color: '#FF6B35', fontSize: 14, fontWeight: '600' },
  title:          { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  offlineBanner:  { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  offlineText:    { color: '#FCA5A5', fontSize: 13 },
  card:           { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  restaurantName: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  distance:       { color: '#FF6B35', fontSize: 13, fontWeight: '600' },
  meta:           { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 8 },
  cardFooter:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fee:            { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  badge:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeActive:    { backgroundColor: 'rgba(255,107,53,0.15)', borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)' },
  badgeInactive:  { backgroundColor: 'rgba(255,255,255,0.06)' },
  badgeText:      { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  badgeTextActive: { color: '#FF6B35', fontWeight: '600' },
  empty:          { paddingTop: 80, alignItems: 'center' },
  emptyIcon:      { fontSize: 40, marginBottom: 12 },
  emptyText:      { color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: 15 },
})

