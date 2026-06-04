import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { CustomerTrackingStackParamList } from '../../types/navigation'
import { listOrders } from '../../services/customer/api'
import { customerStyles } from '../../components/customer/customerStyles'
import { ACTIVE_DELIVERY_STATUSES } from '../../utils/constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Nav = StackNavigationProp<CustomerTrackingStackParamList, 'CustomerTrackingHub'>

export default function CustomerTrackingHubScreen() {
  const navigation = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const [orders, setOrders] = useState<
    Array<{ id: string; restaurant_name: string; status: string }>
  >([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listOrders({ type: 'delivery', page_size: 30 })
      setOrders(
        res.orders
          .filter((o) => ACTIVE_DELIVERY_STATUSES.has(o.status))
          .map((o) => ({
            id: o.id,
            restaurant_name: o.restaurant_name,
            status: o.status,
          })),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA', paddingTop: insets.top }}>
      <ScrollView
        style={customerStyles.screen}
        contentContainerStyle={customerStyles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
      <Text style={customerStyles.title}>Tracking en vivo</Text>
      <Text style={customerStyles.subtitle}>Pedidos delivery activos</Text>

      {loading && orders.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#FF6B35" />
      ) : orders.length === 0 ? (
        <View style={customerStyles.card}>
          <Text style={{ color: '#6B7280' }}>No hay pedidos en curso para seguir.</Text>
        </View>
      ) : (
        orders.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={customerStyles.card}
            onPress={() =>
              navigation.navigate('CustomerTracking', { deliveryOrderId: o.id })
            }
          >
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{o.restaurant_name}</Text>
            <Text style={{ color: '#6B7280', marginTop: 4 }}>{o.status}</Text>
            <Text style={{ color: '#FF6B35', marginTop: 8, fontWeight: '600' }}>
              Ver mapa →
            </Text>
          </TouchableOpacity>
        ))
      )}
      </ScrollView>
    </View>
  )
}
