import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { CustomerProfileStackParamList } from '../../types/navigation'
import { getCustomerProfile, updateCustomerProfile } from '../../services/customer/api'
import { customerStyles } from '../../components/customer/customerStyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Nav = StackNavigationProp<CustomerProfileStackParamList, 'CustomerProfile'>

export default function CustomerProfileScreen() {
  const navigation = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = await getCustomerProfile()
      setDisplayName(p.display_name)
      setPhone(p.phone ?? '')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  async function save() {
    const trimmedName = displayName.trim()
    if (!trimmedName) {
      Alert.alert('Atención', 'El nombre no puede estar vacío.')
      return
    }

    setSaving(true)
    setSaved(false)
    try {
      await updateCustomerProfile({
        display_name: trimmedName,
        phone: phone.trim() || undefined,
      })
      setSaved(true)
    } catch (error: any) {
      console.warn('[CustomerProfile]', error)
      Alert.alert('Error', 'No se pudo guardar el perfil. Inténtalo nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={[customerStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#FF6B35" />
      </View>
    )
  }

  return (
    <ScrollView style={[customerStyles.screen, { paddingTop: insets.top + 10 }]} contentContainerStyle={customerStyles.scroll}>
      <Text style={customerStyles.title}>Mi perfil</Text>

      <Text style={customerStyles.label}>Nombre</Text>
      <TextInput style={customerStyles.input} value={displayName} onChangeText={setDisplayName} />

      <Text style={customerStyles.label}>Teléfono</Text>
      <TextInput
        style={customerStyles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+56 9 …"
      />

      <TouchableOpacity style={customerStyles.btn} onPress={save} disabled={saving}>
        <Text style={customerStyles.btnText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
      </TouchableOpacity>
      {saved && <Text style={{ color: '#059669', marginTop: 8 }}>Perfil actualizado</Text>}

      <TouchableOpacity
        style={[customerStyles.btnOutline, { marginTop: 24 }]}
        onPress={() => navigation.navigate('CustomerAddresses')}
      >
        <Text style={customerStyles.btnOutlineText}>Mis direcciones →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[customerStyles.btnOutline, { marginTop: 12 }]}
        onPress={() => navigation.navigate('CustomerSettings')}
      >
        <Text style={customerStyles.btnOutlineText}>Configuración →</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
