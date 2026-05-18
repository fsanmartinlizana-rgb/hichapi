/**
 * MainNavigator — Bottom tab navigator for the main app experience.
 * Tabs: Garzón, Comandas, Mesas, Perfil.
 *
 * Active tab color: #FF6B35 (blue-500)
 * Inactive tab color: #6B7280 (gray-500)
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from '../types/navigation';

import GarzonNavigator from './GarzonNavigator';
import ComandasNavigator from './ComandasNavigator';
import MesasNavigator from './MesasNavigator';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ACTIVE_COLOR = '#FF6B35';
const INACTIVE_COLOR = '#6B7280';

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
      }}
    >
      <Tab.Screen
        name="Garzon"
        component={GarzonNavigator}
        options={{
          title: 'Garzón',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Comandas"
        component={ComandasNavigator}
        options={{
          title: 'Comandas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Mesas"
        component={MesasNavigator}
        options={{
          title: 'Mesas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
