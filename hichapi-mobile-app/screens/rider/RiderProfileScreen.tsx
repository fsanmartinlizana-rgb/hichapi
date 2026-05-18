/**
 * screens/rider/RiderProfileScreen.tsx
 *
 * Rider profile — view/edit data, status toggle, rating display.
 * Requirements: 1.9, 1.10, 1.11, 6.5
 */
import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, Switch,
  StyleSheet, Alert, ScrollView,
} from 'react-native'
import { updateRiderStatus } from '../../services/rider/api'
import type { RiderProfile } from '../../../lib/delivery/types'

const STATUS_LABELS: Record<string, string> = {
  pending_verification: 'Pendiente de verificación',
  available:            'Disponible',
  offline:              'Desconectado',
  busy:                 'En entrega',
  suspended:            'Suspendido',
}

const VEHICLE_LABELS: Record<string, string> = {
  bicycle:    'Bicicleta',
  motorcycle: 'Moto',
  car:        'Auto',
  cargo_bike: 'Cargo bike',
}

interface Props {
  rider: RiderProfile
  token: string
  onStatusChanged: (newStatus: string) => void
  onLogout: () => void
}

export default function RiderProfileScreen({ rider, token, onStatusChanged, onLogout }: Props) {
  const [toggling, setToggling] = useState(false)
  const isAvailable = rider.status === 'available'
  const canToggle   = rider.status === 'available' || rider.status === 'offline'

  async function handleToggle() {
    if (!canToggle) {
      Alert.alert(
        'No disponible',
        rider.status === 'busy'
          ? 'No puedes desconectarte mientras tienes una entrega activa.'
          : `Tu cuenta está en estado: ${STATUS_LABELS[rider.status] ?? rider.status}`,
      )
      return
    }

    const newStatus = isAvailable ? 'offline' : 'available'
    setToggling(true)
    try {
      await updateRiderStatus(token, newStatus)
      onStatusChanged(newStatus)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setToggling(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{rider.full_name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{rider.full_name}</Text>
        <Text style={styles.statusLabel}>{STATUS_LABELS[rider.status] ?? rider.status}</Text>
      </View>

      {/* Rating */}
      {rider.avg_rating !== null && (
        <View style={styles.ratingCard}>
          <Text style={styles.ratingValue}>{'★'.repeat(Math.round(rider.avg_rating))}</Text>
          <Text style={styles.ratingNumber}>{rider.avg_rating.toFixed(1)}</Text>
          <Text style={styles.ratingCount}>({rider.total_ratings} calificaciones)</Text>
        </View>
      )}

      {/* Status toggle */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Estado</Text>
            <Text style={styles.toggleSub}>
              {isAvailable ? 'Recibirás pedidos' : 'No recibirás pedidos'}
            </Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={handleToggle}
            disabled={toggling || !canToggle}
            trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#FF6B35' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Vehicle info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Vehículo</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tipo</Text>
          <Text style={styles.infoValue}>{VEHICLE_LABELS[rider.vehicle_type] ?? rider.vehicle_type}</Text>
        </View>
        {rider.vehicle_model && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Modelo</Text>
            <Text style={styles.infoValue}>{rider.vehicle_model}</Text>
          </View>
        )}
        {rider.license_plate && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patente</Text>
            <Text style={styles.infoValue}>{rider.license_plate}</Text>
          </View>
        )}
      </View>

      {/* Contact info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Contacto</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Teléfono</Text>
          <Text style={styles.infoValue}>{rider.phone}</Text>
        </View>
      </View>

      {/* Document status */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Documentos</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Estado</Text>
          <Text style={[
            styles.infoValue,
            rider.document_status === 'approved' ? styles.approved : styles.pending,
          ]}>
            {rider.document_status === 'approved'   ? '✓ Aprobados' :
             rider.document_status === 'documents_submitted' ? '⏳ En revisión' :
             rider.document_status === 'rejected'   ? '✗ Rechazados' :
             '⚠ Pendientes de subir'}
          </Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0A0A14' },
  content:       { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar:        { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,107,53,0.2)', borderWidth: 2, borderColor: 'rgba(255,107,53,0.4)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText:    { color: '#FF6B35', fontSize: 28, fontWeight: '700' },
  name:          { color: '#fff', fontSize: 20, fontWeight: '700' },
  statusLabel:   { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 },
  ratingCard:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(234,179,8,0.2)' },
  ratingValue:   { color: '#EAB308', fontSize: 18 },
  ratingNumber:  { color: '#EAB308', fontSize: 20, fontWeight: '700' },
  ratingCount:   { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  card:          { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  toggleRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel:   { color: '#fff', fontSize: 15, fontWeight: '600' },
  toggleSub:     { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  sectionTitle:  { color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  infoLabel:     { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  infoValue:     { color: '#fff', fontSize: 13 },
  approved:      { color: '#4ADE80' },
  pending:       { color: '#F59E0B' },
  logoutBtn:     { marginTop: 8, padding: 16, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center' },
  logoutText:    { color: '#EF4444', fontSize: 15, fontWeight: '600' },
})
