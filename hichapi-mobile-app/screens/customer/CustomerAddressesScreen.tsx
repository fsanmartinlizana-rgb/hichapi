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
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../../services/customer/api'
import { customerStyles } from '../../components/customer/customerStyles'
import type { SavedAddress } from '../../types/customer'

export default function CustomerAddressesScreen() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAddresses(await listAddresses())
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  async function addAddress() {
    if (!label.trim() || !street.trim() || !city.trim()) return
    await createAddress({
      label: label.trim(),
      street: street.trim(),
      city: city.trim(),
      notes: notes.trim() || undefined,
      is_default: addresses.length === 0,
    })
    setLabel('')
    setStreet('')
    setCity('')
    setNotes('')
    setShowForm(false)
    await load()
  }

  function confirmDelete(addr: SavedAddress) {
    Alert.alert('Eliminar dirección', `¿Eliminar "${addr.label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteAddress(addr.id)
          await load()
        },
      },
    ])
  }

  return (
    <ScrollView style={customerStyles.screen} contentContainerStyle={customerStyles.scroll}>
      <Text style={customerStyles.title}>Direcciones</Text>

      {loading ? (
        <ActivityIndicator color="#FF6B35" style={{ marginTop: 24 }} />
      ) : (
        <>
          {addresses.map((a) => (
            <View key={a.id} style={customerStyles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700' }}>
                  {a.label}
                  {a.is_default ? ' · default' : ''}
                </Text>
              </View>
              <Text style={{ color: '#6B7280', marginTop: 4 }}>
                {a.street}, {a.city}
              </Text>
              {a.notes ? (
                <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>{a.notes}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                {!a.is_default && (
                  <TouchableOpacity
                    onPress={async () => {
                      await updateAddress(a.id, { is_default: true })
                      await load()
                    }}
                  >
                    <Text style={{ color: '#FF6B35', fontWeight: '600' }}>Hacer default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => confirmDelete(a)}>
                  <Text style={{ color: '#EF4444' }}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {showForm ? (
            <View style={customerStyles.card}>
              <Text style={customerStyles.label}>Nueva dirección</Text>
              <TextInput
                style={customerStyles.input}
                placeholder="Etiqueta (Casa, Trabajo)"
                value={label}
                onChangeText={setLabel}
              />
              <TextInput
                style={customerStyles.input}
                placeholder="Calle y número"
                value={street}
                onChangeText={setStreet}
              />
              <TextInput
                style={customerStyles.input}
                placeholder="Ciudad"
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={customerStyles.input}
                placeholder="Notas opcional"
                value={notes}
                onChangeText={setNotes}
              />
              <TouchableOpacity style={customerStyles.btn} onPress={addAddress}>
                <Text style={customerStyles.btnText}>Guardar dirección</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12 }} onPress={() => setShowForm(false)}>
                <Text style={{ textAlign: 'center', color: '#6B7280' }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[customerStyles.btnOutline, { marginTop: 12 }]}
              onPress={() => setShowForm(true)}
            >
              <Text style={customerStyles.btnOutlineText}>+ Agregar dirección</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  )
}
