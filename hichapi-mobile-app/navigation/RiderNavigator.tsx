/**
 * navigation/RiderNavigator.tsx
 *
 * Tab navigator for the rider app.
 * Tabs: Pedidos (marketplace/active-orders) | Mapa | Ganancias | Perfil
 * Guard: redirects to RiderAuthScreen if no auth token.
 * Requirements: 1.1, 3.1
 */
import React, { useState } from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { Text, View, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useRiderStore, RiderStoreProvider } from '../services/rider/store'
import RiderAuthScreen from '../screens/rider/RiderAuthScreen'
import RiderMarketplaceScreen from '../screens/rider/RiderMarketplaceScreen'
import ActiveOrdersList from '../screens/rider/ActiveOrdersList'
import RiderActiveOrderScreen from '../screens/rider/RiderActiveOrderScreen'
import RiderHeatMapScreen from '../screens/rider/RiderHeatMapScreen'
import RiderEarningsScreen from '../screens/rider/RiderEarningsScreen'
import RiderProfileScreen from '../screens/rider/RiderProfileScreen'
import type { DeliveryOrder } from '../../lib/delivery/types'

const Tab   = createBottomTabNavigator()
const Stack = createStackNavigator()

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Pedidos:   '🛵',
    Mapa:      '🗺️',
    Ganancias: '💰',
    Perfil:    '👤',
  }
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? '●'}
    </Text>
  )
}

/**
 * Pedidos tab — shows ActiveOrdersList or Marketplace depending on whether
 * the rider has active orders. Tapping an order drills into its detail screen.
 */
function PedidosStack({ token, vehicleType }: { token: string; vehicleType: any }) {
  const { activeOrders, updateActiveOrder, removeActiveOrder } = useRiderStore()
  const [showMarketplace, setShowMarketplace] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null)

  // Detail screen: active order map + route + status buttons
  if (selectedOrder) {
    return (
      <RiderActiveOrderScreen
        order={selectedOrder}
        token={token}
        vehicleType={vehicleType}
        onBack={() => setSelectedOrder(null)}
        onOrderCompleted={() => {
          removeActiveOrder(selectedOrder.id)
          setSelectedOrder(null)
        }}
        onStatusChanged={(updated: DeliveryOrder) => {
          updateActiveOrder(updated)
          setSelectedOrder(updated)
        }}
      />
    )
  }

  // Marketplace: either requested explicitly or no active orders
  if (showMarketplace || activeOrders.length === 0) {
    return (
      <RiderMarketplaceScreen
        token={token}
        vehicleType={vehicleType}
        onBack={activeOrders.length > 0 ? () => setShowMarketplace(false) : undefined}
      />
    )
  }

  // Default: list of all in-progress orders
  return (
    <ActiveOrdersList
      orders={activeOrders}
      onSelectOrder={setSelectedOrder}
      onGoToMarketplace={() => setShowMarketplace(true)}
    />
  )
}

function RiderTabs() {
  const { authToken, riderProfile, setAuthToken, setRiderProfile, logout, loading } = useRiderStore()

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A14', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    )
  }

  if (!authToken) {
    return (
      <RiderAuthScreen
        onAuthenticated={token => setAuthToken(token)}
      />
    )
  }

  const vehicleType = riderProfile?.vehicle_type ?? 'motorcycle'

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarStyle: {
          backgroundColor: '#0F0F1C',
          borderTopColor: 'rgba(255,255,255,0.08)',
        },
        tabBarActiveTintColor:   '#FF6B35',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        headerStyle:             { backgroundColor: '#0F0F1C' },
        headerTintColor:         '#fff',
      })}
    >
      <Tab.Screen name="Pedidos" options={{ headerShown: false }}>
        {() => <PedidosStack token={authToken} vehicleType={vehicleType} />}
      </Tab.Screen>

      <Tab.Screen name="Mapa">
        {() => <RiderHeatMapScreen token={authToken} />}
      </Tab.Screen>

      <Tab.Screen name="Ganancias">
        {() => <RiderEarningsScreen token={authToken} />}
      </Tab.Screen>

      <Tab.Screen name="Perfil">
        {() =>
          riderProfile ? (
            <RiderProfileScreen
              rider={riderProfile}
              token={authToken}
              onStatusChanged={(status) => setRiderProfile({ ...riderProfile, status })}
              onLogout={logout}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#0A0A14', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Text style={{ color: '#fff', fontSize: 16, marginBottom: 20, textAlign: 'center' }}>
                No pudimos cargar tu perfil de Rider.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#EF4444', padding: 16, borderRadius: 12 }}
                onPress={logout}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          )
        }
      </Tab.Screen>
    </Tab.Navigator>
  )
}

export default function RiderNavigator() {
  return (
    <RiderStoreProvider>
      <RiderTabs />
    </RiderStoreProvider>
  )
}

