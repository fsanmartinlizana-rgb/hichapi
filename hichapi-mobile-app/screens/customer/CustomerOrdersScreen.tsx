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
import { Ionicons } from '@expo/vector-icons'
import type { CustomerOrdersStackParamList } from '../../types/navigation'
import { listOrders } from '../../services/customer/api'
import { customerStyles, formatClp } from '../../components/customer/customerStyles'
import { ACTIVE_DELIVERY_STATUSES } from '../../utils/constants'
import type { UnifiedOrder, CustomerOrderType } from '../../types/customer'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Nav = StackNavigationProp<CustomerOrdersStackParamList, 'CustomerOrders'>

const getStatusConfig = (status: string) => {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'completed':
    case 'delivered':
      return { bg: '#DEF7EC', text: '#03543F', label: 'Pagado' }
    case 'pending':
    case 'processing':
    case 'accepted':
    case 'preparing':
      return { bg: '#FEF3C7', text: '#92400E', label: 'Pendiente' }
    case 'cancelled':
    case 'failed':
      return { bg: '#FDE8E8', text: '#9B1C1C', label: 'Cancelado' }
    default:
      return { bg: '#F3F4F6', text: '#374151', label: status }
  }
}

export default function CustomerOrdersScreen() {
  const insets = useSafeAreaInsets()
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
    <View style={[customerStyles.screen, { paddingTop: insets.top }]}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Text style={customerStyles.title}>Mis pedidos</Text>
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 10, marginBottom: 8 }}>
          {(['all', 'delivery', 'presencial'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setType(t)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 24,
                backgroundColor: type === t ? '#FF6B35' : '#FFFFFF',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: type === t ? 0.2 : 0.05,
                shadowRadius: 4,
                elevation: type === t ? 4 : 2,
                borderWidth: type === t ? 0 : 1,
                borderColor: '#F3F4F6',
              }}
            >
              <Text style={{ color: type === t ? '#fff' : '#6B7280', fontSize: 13, fontWeight: '600' }}>
                {t === 'all' ? 'Todos' : t === 'delivery' ? 'Delivery' : 'Local'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
          <Text style={{ textAlign: 'center', marginTop: 16, color: '#6B7280', fontSize: 16, fontWeight: '500' }}>
            Aún no tienes pedidos
          </Text>
          <Text style={{ textAlign: 'center', marginTop: 8, color: '#9CA3AF', fontSize: 14 }}>
            ¡Explora restaurantes y haz tu primer pedido!
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {orders.map((o) => {
            const statusConfig = getStatusConfig(o.status)
            return (
              <TouchableOpacity
                key={`${o.order_type}-${o.id}`}
                style={[
                  customerStyles.card,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderWidth: 0,
                    backgroundColor: '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.06,
                    shadowRadius: 12,
                    elevation: 3,
                    marginBottom: 14,
                    marginTop: 0,
                  }
                ]}
                onPress={() => navigation.navigate('CustomerOrderDetail', { orderId: o.id })}
              >
                <View style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: '#FFF0ED',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 14,
                }}>
                  <Ionicons 
                    name={o.order_type === 'delivery' ? 'bicycle' : 'restaurant'} 
                    size={24} 
                    color="#FF6B35" 
                  />
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 16, color: '#111827', marginBottom: 4 }} numberOfLines={1}>
                    {o.restaurant_name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 6 }}>
                    <Text style={{ color: '#6B7280', fontSize: 13 }}>
                      {new Date(o.created_at).toLocaleDateString('es-CL')}
                    </Text>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginHorizontal: 6 }} />
                    <View style={{
                      backgroundColor: statusConfig.bg,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                    }}>
                      <Text style={{ color: statusConfig.text, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>
                  {o.order_type === 'delivery' && ACTIVE_DELIVERY_STATUSES.has(o.status) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <Ionicons name="location" size={14} color="#FF6B35" />
                      <Text style={{ color: '#FF6B35', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                        Tracking disponible
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 8 }}>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827' }}>
                    {formatClp(o.total_clp)}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#D1D5DB" style={{ marginTop: 8 }} />
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}
