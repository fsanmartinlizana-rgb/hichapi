/**
 * CustomerNavigator — Tab navigator for authenticated comensales.
 * Tabs: Home | Pedidos | Tracking | Fidelidad | Perfil
 */
import React, { useEffect } from 'react'
import { Text } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import type { CustomerTabParamList, CustomerOrdersStackParamList, CustomerTrackingStackParamList, CustomerProfileStackParamList } from '../types/navigation'
import { startCustomerGeofencing, stopCustomerGeofencing } from '../services/customer/geofence'
import { COLORS } from '../utils/theme'

import CustomerHomeScreen from '../screens/customer/CustomerHomeScreen'
import CustomerOrdersScreen from '../screens/customer/CustomerOrdersScreen'
import CustomerOrderDetailScreen from '../screens/customer/CustomerOrderDetailScreen'
import CustomerTrackingHubScreen from '../screens/customer/CustomerTrackingHubScreen'
import CustomerTrackingScreen from '../screens/customer/CustomerTrackingScreen'
import CustomerProfileScreen from '../screens/customer/CustomerProfileScreen'
import CustomerAddressesScreen from '../screens/customer/CustomerAddressesScreen'
import CustomerSettingsScreen from '../screens/customer/CustomerSettingsScreen'
import CustomerSearchScreen from '../screens/customer/CustomerSearchScreen'
import CustomerRestaurantMenuScreen from '../screens/customer/CustomerRestaurantMenuScreen'

const Tab = createBottomTabNavigator<CustomerTabParamList>()
const OrdersStack = createStackNavigator<CustomerOrdersStackParamList>()
const TrackingStack = createStackNavigator<CustomerTrackingStackParamList>()
const ProfileStack = createStackNavigator<CustomerProfileStackParamList>()
const SearchStack = createStackNavigator<CustomerSearchStackParamList>()

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Buscar: '🔍',
    Pedidos: '📦',
    Tracking: '📍',
    Perfil: '👤',
  }
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label] ?? '●'}</Text>
}

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator screenOptions={{ headerShown: false }}>
      <SearchStack.Screen name="CustomerSearch" component={CustomerSearchScreen} />
      <SearchStack.Screen name="CustomerRestaurantMenu" component={CustomerRestaurantMenuScreen} />
    </SearchStack.Navigator>
  )
}

function OrdersStackNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="CustomerOrders" component={CustomerOrdersScreen} />
      <OrdersStack.Screen name="CustomerOrderDetail" component={CustomerOrderDetailScreen} />
    </OrdersStack.Navigator>
  )
}

function TrackingStackNavigator() {
  return (
    <TrackingStack.Navigator screenOptions={{ headerShown: false }}>
      <TrackingStack.Screen name="CustomerTrackingHub" component={CustomerTrackingHubScreen} />
      <TrackingStack.Screen name="CustomerTracking" component={CustomerTrackingScreen} />
    </TrackingStack.Navigator>
  )
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="CustomerProfile" component={CustomerProfileScreen} />
      <ProfileStack.Screen name="CustomerAddresses" component={CustomerAddressesScreen} />
      <ProfileStack.Screen name="CustomerSettings" component={CustomerSettingsScreen} />
    </ProfileStack.Navigator>
  )
}

export default function CustomerNavigator() {
  useEffect(() => {
    startCustomerGeofencing().catch((e) => console.warn('[CustomerNavigator] geofence', e))
    return () => {
      stopCustomerGeofencing()
    }
  }, [])

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={CustomerHomeScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Buscar" component={SearchStackNavigator} options={{ title: 'Buscar' }} />
      <Tab.Screen name="Pedidos" component={OrdersStackNavigator} options={{ title: 'Pedidos' }} />
      <Tab.Screen name="Tracking" component={TrackingStackNavigator} options={{ title: 'Tracking' }} />
      <Tab.Screen name="Perfil" component={ProfileStackNavigator} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  )
}
