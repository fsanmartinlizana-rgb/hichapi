/**
 * screens/rider/ActiveOrdersList.tsx
 *
 * Lists ALL in-progress delivery orders for the rider.
 * Shows assigned, picked_up, and in_transit orders simultaneously.
 * Tapping an order navigates to its detail/map screen.
 */
import React from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native'
import type { DeliveryOrder } from '../../../lib/delivery/types'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  assigned:   { label: 'Asignado',    color: '#F97316', icon: '📋' },
  picked_up:  { label: 'Recogido',    color: '#3B82F6', icon: '🛵' },
  in_transit: { label: 'En camino',   color: '#8B5CF6', icon: '🚀' },
}

interface Props {
  orders: DeliveryOrder[]
  onSelectOrder: (order: DeliveryOrder) => void
  onGoToMarketplace: () => void
}

export default function ActiveOrdersList({ orders, onSelectOrder, onGoToMarketplace }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mis pedidos activos</Text>
          <Text style={styles.subtitle}>
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} en curso
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onGoToMarketplace}>
          <Text style={styles.addBtnText}>+ Aceptar más</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: '#6B7280', icon: '📦' }
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => onSelectOrder(item)}
            >
              {/* Status badge */}
              <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20', borderColor: cfg.color + '40' }]}>
                <Text style={styles.statusIcon}>{cfg.icon}</Text>
                <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>

              {/* Client and fee row */}
              <View style={styles.cardHeader}>
                <Text style={styles.clientName}>{item.client_name}</Text>
                <Text style={styles.fee}>
                  ${(item.delivery_fee_clp ?? 0).toLocaleString('es-CL')} CLP
                </Text>
              </View>

              {/* Phone */}
              <Text style={styles.phone}>{item.client_phone}</Text>

              {/* Addresses */}
              <View style={styles.addressBlock}>
                <View style={styles.addressRow}>
                  <Text style={styles.dot}>📍</Text>
                  <Text style={styles.addressText} numberOfLines={1}>{item.pickup_address}</Text>
                </View>
                <View style={styles.addressRow}>
                  <Text style={styles.dot}>🏠</Text>
                  <Text style={styles.addressText} numberOfLines={1}>{item.delivery_address}</Text>
                </View>
              </View>

              {/* CTA */}
              <View style={styles.cardFooter}>
                <Text style={styles.tapHint}>Toca para ver ruta y actualizar estado →</Text>
              </View>
            </TouchableOpacity>
          )
        }}
        ListFooterComponent={
          <TouchableOpacity style={styles.marketplaceBtn} onPress={onGoToMarketplace}>
            <Text style={styles.marketplaceBtnText}>🛒 Ver más pedidos disponibles</Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: '#0A0A14' },
  container:      { flex: 1, backgroundColor: '#0A0A14' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  title:          { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle:       { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  addBtn:         { backgroundColor: '#FF6B35', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText:     { color: '#fff', fontSize: 13, fontWeight: '600' },
  list:           { padding: 16, paddingBottom: 40 },
  card:           { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statusBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, marginBottom: 10 },
  statusIcon:     { fontSize: 12 },
  statusText:     { fontSize: 12, fontWeight: '600' },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  clientName:     { color: '#fff', fontSize: 15, fontWeight: '600' },
  fee:            { color: '#4ADE80', fontSize: 15, fontWeight: '700' },
  phone:          { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 12 },
  addressBlock:   { gap: 6, marginBottom: 12 },
  addressRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  dot:            { fontSize: 12, marginTop: 1 },
  addressText:    { color: 'rgba(255,255,255,0.55)', fontSize: 13, flex: 1 },
  cardFooter:     { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10 },
  tapHint:        { color: 'rgba(255,255,255,0.25)', fontSize: 11 },
  marketplaceBtn: { backgroundColor: 'rgba(255,107,53,0.1)', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,107,53,0.25)', marginTop: 4 },
  marketplaceBtnText: { color: '#FF6B35', fontSize: 14, fontWeight: '600' },
})
