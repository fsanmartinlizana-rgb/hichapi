import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../../utils/theme'

const STEPS = [
  { key: 'pending_assignment', label: 'Pendiente' },
  { key: 'assigned', label: 'Asignado' },
  { key: 'picked_up', label: 'Recogido' },
  { key: 'in_transit', label: 'En camino' },
  { key: 'delivered', label: 'Entregado' },
]

const ORDER = ['pending_assignment', 'assigned', 'picked_up', 'in_transit', 'delivered']

export function DeliveryProgressBar({ status }: { status: string }) {
  const idx = ORDER.indexOf(status)
  const current = idx >= 0 ? idx : 0

  if (status === 'cancelled' || status === 'failed') {
    return (
      <Text style={styles.terminal}>Pedido {status === 'cancelled' ? 'cancelado' : 'fallido'}</Text>
    )
  }

  return (
    <View style={styles.row}>
      {STEPS.map((s, i) => (
        <View key={s.key} style={styles.step}>
          <View
            style={[
              styles.dot,
              i <= current && styles.dotActive,
              i === current && styles.dotCurrent,
            ]}
          />
          <Text style={[styles.label, i === current && styles.labelActive]} numberOfLines={1}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { flex: 1, alignItems: 'center' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.borderMedium,
    marginBottom: 4,
  },
  dotActive: { backgroundColor: COLORS.primary },
  dotCurrent: { width: 14, height: 14, borderRadius: 7, marginBottom: 2 },
  label: { fontSize: 8, color: COLORS.textMuted, textAlign: 'center' },
  labelActive: { color: COLORS.primary, fontWeight: '700' },
  terminal: { color: COLORS.error, fontSize: 14, textAlign: 'center' },
})
