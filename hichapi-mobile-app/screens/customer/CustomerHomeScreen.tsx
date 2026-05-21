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
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { CustomerTabParamList, CustomerTrackingStackParamList } from '../../types/navigation'
import { getCustomerProfile, listOrders } from '../../services/customer/api'
import { customerStyles, formatClp } from '../../components/customer/customerStyles'
import { ACTIVE_DELIVERY_STATUSES } from '../../utils/constants'
import type { UnifiedOrder } from '../../types/customer'

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'Home'>,
  StackNavigationProp<CustomerTrackingStackParamList>
>

export default function CustomerHomeScreen() {
  const navigation = useNavigation<Nav>()
  const [points, setPoints] = useState(0)
  const [active, setActive] = useState<UnifiedOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [profile, ordersRes] = await Promise.all([
        getCustomerProfile(),
        listOrders({ type: 'delivery', page_size: 20 }),
      ])
      setPoints(profile.loyalty_points)
      setActive(
        ordersRes.orders.filter((o) => ACTIVE_DELIVERY_STATUSES.has(o.status)),
      )
    } catch (e) {
      console.warn('[CustomerHome]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  if (loading && active.length === 0) {
    return (
      <View style={[customerStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    )
  }

  return (
    <ScrollView
      style={customerStyles.screen}
      contentContainerStyle={customerStyles.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={customerStyles.title}>Hola 👋</Text>
      <Text style={customerStyles.subtitle}>Tu resumen de pedidos y puntos</Text>

      <View style={customerStyles.pointsBadge}>
        <Text style={{ color: '#6B7280', fontSize: 13 }}>Puntos de fidelidad</Text>
        <Text style={customerStyles.pointsValue}>{points}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Fidelidad')}>
          <Text style={{ color: '#FF6B35', fontSize: 13, marginTop: 8, fontWeight: '600' }}>
            Ver fidelidad →
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[customerStyles.label, { marginTop: 20 }]}>Pedidos en curso</Text>
      {active.length === 0 ? (
        <View style={customerStyles.card}>
          <Text style={{ color: '#6B7280', fontSize: 14 }}>No tienes deliveries activos.</Text>
        </View>
      ) : (
        active.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={customerStyles.card}
            onPress={() =>
              navigation.navigate('Tracking', {
                screen: 'CustomerTracking',
                params: { deliveryOrderId: o.id },
              })
            }
          >
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{o.restaurant_name}</Text>
            <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
              {o.status} · {formatClp(o.total_clp)}
            </Text>
            <Text style={{ color: '#FF6B35', fontSize: 13, marginTop: 8, fontWeight: '600' }}>
              Seguir en vivo →
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  )
}
