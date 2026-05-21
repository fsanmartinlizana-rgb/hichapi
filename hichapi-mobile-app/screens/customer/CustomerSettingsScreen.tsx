import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import {
  isGeolocationOptedOut,
  setGeolocationOptOut,
  startCustomerGeofencing,
} from '../../services/customer/geofence'
import { clearPushToken, deleteAccount } from '../../services/customer/api'
import { customerStyles } from '../../components/customer/customerStyles'

export default function CustomerSettingsScreen() {
  const { logout } = useAuth()
  const [geoOptOut, setGeoOptOut] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(true)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    isGeolocationOptedOut().then(setGeoOptOut)
  }, [])

  async function toggleGeo(value: boolean) {
    const optOut = !value
    setGeoOptOut(optOut)
    await setGeolocationOptOut(optOut)
    if (!optOut) {
      await startCustomerGeofencing()
    }
  }

  async function togglePush(value: boolean) {
    setPushEnabled(value)
    if (!value) {
      try {
        await clearPushToken()
      } catch (e) {
        console.warn('[settings] clear push', e)
      }
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Eliminar cuenta',
      'Esta acción es irreversible. Se anonimizarán tus datos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (password.length < 6) {
              Alert.alert('Error', 'Ingresa tu contraseña')
              return
            }
            setDeleting(true)
            try {
              await deleteAccount(password)
              await logout()
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la cuenta')
            } finally {
              setDeleting(false)
            }
          },
        },
      ],
    )
  }

  return (
    <ScrollView style={customerStyles.screen} contentContainerStyle={customerStyles.scroll}>
      <Text style={customerStyles.title}>Configuración</Text>

      <View style={customerStyles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontWeight: '600' }}>Geolocalización</Text>
            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>
              Ofertas cuando pasas cerca de restaurantes
            </Text>
          </View>
          <Switch value={!geoOptOut} onValueChange={toggleGeo} trackColor={{ true: '#FF6B35' }} />
        </View>
      </View>

      <View style={customerStyles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontWeight: '600' }}>Notificaciones push</Text>
            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>
              Desactivar revoca el token en el servidor
            </Text>
          </View>
          <Switch value={pushEnabled} onValueChange={togglePush} trackColor={{ true: '#FF6B35' }} />
        </View>
      </View>

      <View style={[customerStyles.card, { borderColor: '#FECACA' }]}>
        <Text style={{ fontWeight: '700', color: '#DC2626' }}>Zona de peligro</Text>
        <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 8, marginBottom: 12 }}>
          Eliminar tu cuenta de comensal de forma permanente.
        </Text>
        <TextInput
          style={customerStyles.input}
          placeholder="Contraseña actual"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          style={[customerStyles.btn, { backgroundColor: '#EF4444' }]}
          onPress={confirmDelete}
          disabled={deleting}
        >
          <Text style={customerStyles.btnText}>
            {deleting ? 'Eliminando…' : 'Eliminar cuenta'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={{ marginTop: 24 }} onPress={logout}>
        <Text style={{ textAlign: 'center', color: '#6B7280', fontWeight: '600' }}>
          Cerrar sesión
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
