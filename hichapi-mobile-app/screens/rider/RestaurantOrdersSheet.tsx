/**
 * screens/rider/RestaurantOrdersSheet.tsx
 *
 * Bottom-sheet modal showing pending delivery orders for a specific restaurant.
 * The rider can read details and choose which specific order to accept.
 */
import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Modal, Alert,
} from 'react-native'
import { getRestaurantPendingOrders, assignSpecificOrder, PendingOrderPreview } from '../../services/rider/api'
import type { MarketplaceRestaurant } from '../../../lib/delivery/types'

interface Props {
  visible: boolean
  restaurant: MarketplaceRestaurant | null
  token: string
  onClose: () => void
  onOrderAccepted: (order: any) => void
}

function formatTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  return `hace ${Math.round(mins / 60)} h`
}

export default function RestaurantOrdersSheet({
  visible,
  restaurant,
  token,
  onClose,
  onOrderAccepted,
}: Props) {
  const [orders, setOrders] = useState<PendingOrderPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [accepting, setAccepting] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !restaurant) return
    setLoading(true)
    getRestaurantPendingOrders(token, restaurant.restaurant_id)
      .then(setOrders)
      .catch(err => Alert.alert('Error', err.message))
      .finally(() => setLoading(false))
  }, [visible, restaurant])

  async function handleAccept(orderId: string) {
    setAccepting(orderId)
    try {
      const assigned = await assignSpecificOrder(token, orderId)
      onOrderAccepted(assigned)
    } catch (err: any) {
      Alert.alert('Error al aceptar', err.message)
    } finally {
      setAccepting(null)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.restaurantName}>{restaurant?.name}</Text>
            <Text style={styles.restaurantMeta}>
              {restaurant?.neighborhood} · {orders.length} pedido{orders.length !== 1 ? 's' : ''} disponible{orders.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#FF6B35" style={{ marginTop: 40 }} />
        ) : orders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No hay pedidos disponibles</Text>
            <Text style={styles.emptySubtext}>Alguien los tomó antes que tú</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.orderCard}>
                {/* Client */}
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.clientName}>👤 {item.client_name}</Text>
                    <Text style={styles.orderAge}>{formatTime(item.created_at)}</Text>
                  </View>
                  <Text style={styles.totalAmount}>
                    ${item.total_clp.toLocaleString('es-CL')}
                  </Text>
                </View>

                {/* Addresses */}
                <View style={styles.addressBlock}>
                  <View style={styles.addressRow}>
                    <Text style={styles.addressLabel}>📍</Text>
                    <Text style={styles.addressText} numberOfLines={2}>
                      {item.pickup_address}
                    </Text>
                  </View>
                  <View style={styles.addressDivider} />
                  <View style={styles.addressRow}>
                    <Text style={styles.addressLabel}>🏠</Text>
                    <Text style={styles.addressText} numberOfLines={2}>
                      {item.delivery_address}
                    </Text>
                  </View>
                </View>

                {/* Fee estimate */}
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Ganancia estimada</Text>
                  <Text style={styles.feeValue}>
                    ${restaurant?.fee_range.min.toLocaleString('es-CL')} – ${restaurant?.fee_range.max.toLocaleString('es-CL')} CLP
                  </Text>
                </View>

                {/* Accept button */}
                <TouchableOpacity
                  style={[styles.acceptBtn, accepting === item.id && styles.acceptBtnDisabled]}
                  onPress={() => handleAccept(item.id)}
                  disabled={!!accepting}
                >
                  {accepting === item.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.acceptBtnText}>✓ Aceptar este pedido</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:          { backgroundColor: '#0F0F1C', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '85%' },
  handle:         { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  restaurantName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  restaurantMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  closeBtn:       { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeBtnText:   { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  list:           { paddingHorizontal: 16, paddingTop: 12 },
  orderCard:      { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  orderHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  clientName:     { color: '#fff', fontSize: 14, fontWeight: '600' },
  orderAge:       { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  totalAmount:    { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  addressBlock:   { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12, marginBottom: 12 },
  addressRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  addressLabel:   { fontSize: 13, marginTop: 1 },
  addressText:    { color: 'rgba(255,255,255,0.7)', fontSize: 13, flex: 1, lineHeight: 18 },
  addressDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 8, marginLeft: 22 },
  feeRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  feeLabel:       { color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  feeValue:       { color: '#4ADE80', fontSize: 13, fontWeight: '600' },
  acceptBtn:      { backgroundColor: '#FF6B35', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  acceptBtnDisabled: { opacity: 0.6 },
  acceptBtnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty:          { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:      { fontSize: 40, marginBottom: 12 },
  emptyText:      { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySubtext:   { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
})
