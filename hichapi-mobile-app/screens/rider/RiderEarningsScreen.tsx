/**
 * screens/rider/RiderEarningsScreen.tsx
 *
 * Earnings screen — total fees, delivery count, avg rating by period.
 * Requirements: 3.10
 */
import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { getDeliveryOrders } from '../../services/rider/api'
import type { DeliveryOrder } from '../../../lib/delivery/types'

type Period = 'today' | 'week' | 'month'

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoy',
  week:  'Esta semana',
  month: 'Este mes',
}

function getPeriodStart(period: Period): Date {
  const now = new Date()
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

interface Props {
  token: string
}

export default function RiderEarningsScreen({ token }: Props) {
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('today')

  useEffect(() => {
    setLoading(true)
    getDeliveryOrders(token, 'delivered')
      .then(setOrders)
      .catch(console.warn)
      .finally(() => setLoading(false))
  }, [token])

  const periodStart = getPeriodStart(period)
  const filtered = orders.filter(o =>
    o.delivered_at && new Date(o.delivered_at) >= periodStart,
  )

  const totalEarnings = filtered.reduce((s, o) => s + (o.delivery_fee_clp ?? 0), 0)
  const deliveryCount = filtered.length

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mis ganancias</Text>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodChip, period === p && styles.periodChipActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#FF6B35" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Summary cards */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Ganancias</Text>
              <Text style={styles.summaryValue}>
                ${totalEarnings.toLocaleString('es-CL')}
              </Text>
              <Text style={styles.summarySub}>CLP</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Entregas</Text>
              <Text style={styles.summaryValue}>{deliveryCount}</Text>
              <Text style={styles.summarySub}>completadas</Text>
            </View>
          </View>

          {/* Order list */}
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sin entregas en este período</Text>
            </View>
          ) : (
            <View style={styles.orderList}>
              <Text style={styles.sectionTitle}>Detalle de entregas</Text>
              {filtered.map(order => (
                <View key={order.id} style={styles.orderRow}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderClient}>{order.client_name}</Text>
                    <Text style={styles.orderAddress} numberOfLines={1}>
                      {order.delivery_address}
                    </Text>
                    {order.delivered_at && (
                      <Text style={styles.orderTime}>
                        {new Date(order.delivered_at).toLocaleTimeString('es-CL', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.orderFee}>
                    +${(order.delivery_fee_clp ?? 0).toLocaleString('es-CL')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0A0A14' },
  content:          { padding: 16, paddingBottom: 40 },
  title:            { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  periodRow:        { flexDirection: 'row', gap: 8, marginBottom: 20 },
  periodChip:       { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  periodChipActive: { backgroundColor: '#FF6B35' },
  periodText:       { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  periodTextActive: { color: '#fff', fontWeight: '600' },
  summaryRow:       { flexDirection: 'row', gap: 12, marginBottom: 24 },
  summaryCard:      { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  summaryLabel:     { color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  summaryValue:     { color: '#4ADE80', fontSize: 28, fontWeight: '700' },
  summarySub:       { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 },
  sectionTitle:     { color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  orderList:        { gap: 8 },
  orderRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 },
  orderInfo:        { flex: 1, marginRight: 12 },
  orderClient:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  orderAddress:     { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  orderTime:        { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 },
  orderFee:         { color: '#4ADE80', fontSize: 15, fontWeight: '700' },
  empty:            { padding: 40, alignItems: 'center' },
  emptyText:        { color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
})
