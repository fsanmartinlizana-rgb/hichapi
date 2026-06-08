/**
 * CustomerNavigator — Tab navigator for authenticated comensales.
 * Tabs: Home | Pedidos | Tracking | Fidelidad | Perfil
 */
import React, { useEffect } from 'react'
import { Platform } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import type { CustomerTabParamList, CustomerOrdersStackParamList, CustomerTrackingStackParamList, CustomerProfileStackParamList, CustomerSearchStackParamList } from '../types/navigation'
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

function TabIcon({ routeName, focused, color, size }: { routeName: string; focused: boolean; color: string; size: number }) {
  let iconName: keyof typeof Ionicons.glyphMap = 'ellipse'

  if (routeName === 'Home') {
    iconName = focused ? 'home' : 'home-outline'
  } else if (routeName === 'Pedidos') {
    iconName = focused ? 'cube' : 'cube-outline'
  } else if (routeName === 'Perfil') {
    iconName = focused ? 'person' : 'person-outline'
  }

  return <Ionicons name={iconName} size={size + 2} color={color} />
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
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarIcon: ({ focused, color, size }) => (
          <TabIcon routeName={route.name} focused={focused} color={color} size={size} />
        ),
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 12,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
      })}
    >
      <Tab.Screen name="Home" component={CustomerHomeScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Buscar" component={SearchStackNavigator} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Pedidos" component={OrdersStackNavigator} options={{ title: 'Pedidos' }} />
      <Tab.Screen name="Tracking" component={TrackingStackNavigator} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Perfil" component={ProfileStackNavigator} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  )
}
