import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { CustomerTabParamList, CustomerTrackingStackParamList } from '../../types/navigation'
import { listOrders } from '../../services/customer/api'
import { customerStyles, formatClp } from '../../components/customer/customerStyles'
import { ACTIVE_DELIVERY_STATUSES } from '../../utils/constants'
import type { UnifiedOrder } from '../../types/customer'
import { Ionicons } from '@expo/vector-icons'

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'Home'>,
  StackNavigationProp<CustomerTrackingStackParamList>
>

export default function CustomerHomeScreen() {
  const navigation = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const [active, setActive] = useState<UnifiedOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ordersRes = await listOrders({ type: 'delivery', page_size: 20 })
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
      style={[customerStyles.screen, { paddingTop: insets.top + 10 }]}
      contentContainerStyle={[customerStyles.scroll, { paddingBottom: 100 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={{ marginBottom: 24, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 }}>
          Hola 👋
        </Text>
        <Text style={{ fontSize: 16, color: '#666' }}>
          ¿Qué tienes en mente hoy?
        </Text>
      </View>

      <View style={styles.actionsContainer}>
        {/* Acción 1: Escanear QR */}
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#FF6B35' }]}
          onPress={() => (navigation.getParent() as any)?.navigate('Client', { screen: 'QRScanner' })}
          activeOpacity={0.9}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="qr-code-outline" size={32} color="#FF6B35" />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitleLight}>Estoy en un local</Text>
            <Text style={styles.cardSubtitleLight}>Escanear código QR</Text>
          </View>
        </TouchableOpacity>

        {/* Acción 2: Hablar con Chapi */}
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' }]}
          onPress={() => navigation.navigate('Buscar', { screen: 'CustomerSearch' })}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: '#FFF0EB' }]}>
            <Ionicons name="chatbubbles-outline" size={32} color="#FF6B35" />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitleDark}>Quiero vitrinear</Text>
            <Text style={styles.cardSubtitleDark}>Pregúntale a Chapi</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Pedidos activos */}
      <View style={{ marginTop: 32 }}>
        <Text style={[customerStyles.label, { marginBottom: 16 }]}>Tus pedidos en curso</Text>
        {active.length === 0 ? (
          <View style={[customerStyles.card, { alignItems: 'center', paddingVertical: 24 }]}>
            <Ionicons name="bicycle-outline" size={40} color="#E5E7EB" style={{ marginBottom: 8 }} />
            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>No tienes deliveries activos en este momento.</Text>
          </View>
        ) : (
          active.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[customerStyles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() =>
                navigation.navigate('Tracking', {
                  screen: 'CustomerTracking',
                  params: { deliveryOrderId: o.id },
                })
              }
            >
              <View>
                <Text style={{ fontWeight: '700', fontSize: 16, color: '#1A1A2E' }}>{o.restaurant_name}</Text>
                <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
                  {o.status} · {formatClp(o.total_clp)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const { width } = Dimensions.get('window')

const styles = StyleSheet.create({
  actionsContainer: {
    gap: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitleLight: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  cardSubtitleLight: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  cardTitleDark: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  cardSubtitleDark: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
})
