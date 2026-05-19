/**
 * screens/rider/RiderOnboardingScreen.tsx
 *
 * Screen shown after registration if the rider profile doesn't exist yet.
 * Collects required profile info (Name, Phone, RUT, Vehicle).
 */
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { createRiderProfile } from '../../services/rider/api'
import type { VehicleType } from '../../../lib/delivery/types'

interface Props {
  token: string
  onProfileCreated: () => void
  onLogout: () => void
}

export default function RiderOnboardingScreen({ token, onProfileCreated, onLogout }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    national_id: '',
    vehicle_type: 'motorcycle' as VehicleType,
    license_plate: '',
    vehicle_model: '',
  })

  async function handleSubmit() {
    if (!form.full_name || !form.phone || !form.national_id) {
      Alert.alert('Faltan datos', 'Por favor completa todos los campos obligatorios.')
      return
    }

    setLoading(true)
    try {
      await createRiderProfile(token, form)
      onProfileCreated() // Trigger profile refresh in parent
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo crear el perfil.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Completa tu Perfil</Text>
        <Text style={styles.subtitle}>
          Necesitamos algunos datos más para que puedas empezar a repartir con HiChapi.
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Nombre completo *</Text>
          <TextInput
            style={styles.input}
            value={form.full_name}
            onChangeText={t => setForm(f => ({ ...f, full_name: t }))}
            placeholder="Ej. Juan Pérez"
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Teléfono *</Text>
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={t => setForm(f => ({ ...f, phone: t }))}
            placeholder="+56 9 1234 5678"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>RUT *</Text>
          <TextInput
            style={styles.input}
            value={form.national_id}
            onChangeText={t => setForm(f => ({ ...f, national_id: t }))}
            placeholder="12.345.678-9"
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tipo de Vehículo *</Text>
          <View style={styles.vehicleOptions}>
            {(['bicycle', 'motorcycle', 'car', 'cargo_bike'] as VehicleType[]).map(vt => (
              <TouchableOpacity
                key={vt}
                style={[styles.vehicleBtn, form.vehicle_type === vt && styles.vehicleBtnActive]}
                onPress={() => setForm(f => ({ ...f, vehicle_type: vt }))}
              >
                <Text style={[styles.vehicleBtnText, form.vehicle_type === vt && styles.vehicleBtnTextActive]}>
                  {vt === 'bicycle' ? '🚲 Bici' :
                   vt === 'motorcycle' ? '🛵 Moto' :
                   vt === 'car' ? '🚗 Auto' : '🚚 Cargo'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {(form.vehicle_type === 'motorcycle' || form.vehicle_type === 'car' || form.vehicle_type === 'cargo_bike') && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Patente (opcional)</Text>
              <TextInput
                style={styles.input}
                value={form.license_plate}
                onChangeText={t => setForm(f => ({ ...f, license_plate: t }))}
                placeholder="AB-CD-12"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Modelo del vehículo (opcional)</Text>
              <TextInput
                style={styles.input}
                value={form.vehicle_model}
                onChangeText={t => setForm(f => ({ ...f, vehicle_model: t }))}
                placeholder="Ej. Honda CG 150"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Guardar Perfil</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0A0A14' },
  content:         { padding: 24, paddingTop: 60, paddingBottom: 60 },
  header:          { marginBottom: 32 },
  title:           { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle:        { color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 22 },
  form:            { gap: 20 },
  field:           { gap: 8 },
  label:           { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  input:           { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 16 },
  vehicleOptions:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vehicleBtn:      { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexGrow: 1, alignItems: 'center' },
  vehicleBtnActive:{ backgroundColor: 'rgba(255,107,53,0.15)', borderColor: '#FF6B35' },
  vehicleBtnText:  { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  vehicleBtnTextActive: { color: '#FF6B35' },
  submitBtn:       { backgroundColor: '#FF6B35', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  logoutBtn:       { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  logoutBtnText:   { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' },
})
