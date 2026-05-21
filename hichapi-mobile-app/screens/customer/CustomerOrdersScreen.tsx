import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { CustomerOrdersStackParamList } from '../../types/navigation'
import { listOrders } from '../../services/customer/api'
import { customerStyles, formatClp } from '../../components/customer/customerStyles'
import { ACTIVE_DELIVERY_STATUSES } from '../../utils/constants'
import type { UnifiedOrder, CustomerOrderType } from '../../types/customer'

type Nav = StackNavigationProp<CustomerOrdersStackParamList, 'CustomerOrders'>

export default function CustomerOrdersScreen() {
  const navigation = useNavigation<Nav>()
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [type, setType] = useState<'all' | CustomerOrderType>('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listOrders({ type, page_size: 50 })
      setOrders(res.orders)
    } finally {
      setLoading(false)
    }
  }, [type])

  React.useEffect(() => {
    load()
  }, [load])

  return (
    <View style={customerStyles.screen}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Text style={customerStyles.title}>Mis pedidos</Text>
        <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
          {(['all', 'delivery', 'presencial'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setType(t)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: type === t ? '#FF6B35' : '#F3F4F6',
              }}
            >
              <Text style={{ color: type === t ? '#fff' : '#6B7280', fontSize: 12, fontWeight: '600' }}>
                {t === 'all' ? 'Todos' : t === 'delivery' ? 'Delivery' : 'Local'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#FF6B35" />
      ) : orders.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 40, color: '#9CA3AF' }}>
          Sin pedidos aún
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {orders.map((o) => (
            <TouchableOpacity
              key={`${o.order_type}-${o.id}`}
              style={customerStyles.card}
              onPress={() =>
                navigation.navigate('CustomerOrderDetail', { orderId: o.id })
              }
            >
              <Text style={{ fontWeight: '700' }}>{o.restaurant_name}</Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
                {new Date(o.created_at).toLocaleDateString('es-CL')} · {o.status}
              </Text>
              <Text style={{ fontWeight: '600', marginTop: 6 }}>{formatClp(o.total_clp)}</Text>
              {o.order_type === 'delivery' && ACTIVE_DELIVERY_STATUSES.has(o.status) && (
                <Text style={{ color: '#FF6B35', fontSize: 12, marginTop: 6 }}>
                  Tracking disponible
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
