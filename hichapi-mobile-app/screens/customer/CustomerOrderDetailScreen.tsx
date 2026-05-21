import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type {
  CustomerOrdersStackParamList,
  CustomerTabParamList,
} from '../../types/navigation'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { getOrder, listRatings, submitRating } from '../../services/customer/api'
import { customerStyles, formatClp } from '../../components/customer/customerStyles'
import { ACTIVE_DELIVERY_STATUSES } from '../../utils/constants'
import type { UnifiedOrder } from '../../types/customer'

type Route = RouteProp<CustomerOrdersStackParamList, 'CustomerOrderDetail'>
type Nav = CompositeNavigationProp<
  StackNavigationProp<CustomerOrdersStackParamList>,
  BottomTabNavigationProp<CustomerTabParamList>
>

export default function CustomerOrderDetailScreen() {
  const { params } = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const [order, setOrder] = useState<UnifiedOrder | null>(null)
  const [rated, setRated] = useState(false)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [entityType, setEntityType] = useState<'restaurant' | 'rider'>('restaurant')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, ratings] = await Promise.all([
        getOrder(params.orderId),
        listRatings(),
      ])
      setOrder(o)
      setRated(ratings.some((r) => r.order_id === params.orderId))
    } finally {
      setLoading(false)
    }
  }, [params.orderId])

  React.useEffect(() => {
    load()
  }, [load])

  const canRate =
    order &&
    !rated &&
    ((order.order_type === 'delivery' && order.status === 'delivered') ||
      (order.order_type === 'presencial' && order.status === 'paid'))

  async function sendRating() {
    if (!order || stars < 1) return
    const entity_id =
      entityType === 'rider' && order.rider_id ? order.rider_id : order.restaurant_id
    await submitRating({
      entity_type: entityType,
      entity_id,
      order_id: order.id,
      order_type: order.order_type,
      stars,
      comment: comment.trim() || undefined,
    })
    setRated(true)
  }

  if (loading || !order) {
    return (
      <View style={[customerStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#FF6B35" />
      </View>
    )
  }

  return (
    <ScrollView style={customerStyles.screen} contentContainerStyle={customerStyles.scroll}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={{ color: '#FF6B35', marginBottom: 12 }}>← Volver</Text>
      </TouchableOpacity>

      <Text style={customerStyles.title}>{order.restaurant_name}</Text>
      <Text style={customerStyles.subtitle}>
        {order.status} · {formatClp(order.total_clp)}
      </Text>

      {order.order_type === 'delivery' && ACTIVE_DELIVERY_STATUSES.has(order.status) && (
        <TouchableOpacity
          style={[customerStyles.btn, { marginTop: 16 }]}
          onPress={() =>
            navigation.navigate('Tracking', {
              screen: 'CustomerTracking',
              params: { deliveryOrderId: order.id },
            })
          }
        >
          <Text style={customerStyles.btnText}>Seguir pedido</Text>
        </TouchableOpacity>
      )}

      {order.delivery_address && (
        <View style={customerStyles.card}>
          <Text style={customerStyles.label}>Dirección</Text>
          <Text>{order.delivery_address}</Text>
        </View>
      )}

      {order.items && order.items.length > 0 && (
        <View style={customerStyles.card}>
          <Text style={customerStyles.label}>Items</Text>
          {order.items.map((item, i) => (
            <Text key={i} style={{ marginBottom: 4 }}>
              {item.quantity}× {item.name} — {formatClp(item.unit_price * item.quantity)}
            </Text>
          ))}
        </View>
      )}

      {canRate && (
        <View style={customerStyles.card}>
          <Text style={customerStyles.label}>Calificar pedido</Text>
          {order.order_type === 'delivery' && order.rider_id && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setEntityType('restaurant')}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: entityType === 'restaurant' ? '#FF6B3520' : '#F3F4F6',
                }}
              >
                <Text style={{ textAlign: 'center', fontSize: 12 }}>Restaurante</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEntityType('rider')}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: entityType === 'rider' ? '#FF6B3520' : '#F3F4F6',
                }}
              >
                <Text style={{ textAlign: 'center', fontSize: 12 }}>Repartidor</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setStars(s)}>
                <Text style={{ fontSize: 28, color: s <= stars ? '#FBBF24' : '#E5E7EB' }}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={customerStyles.input}
            placeholder="Comentario opcional"
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <TouchableOpacity style={customerStyles.btn} onPress={sendRating}>
            <Text style={customerStyles.btnText}>Enviar calificación</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}
