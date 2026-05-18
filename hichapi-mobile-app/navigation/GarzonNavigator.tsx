/**
 * GarzonNavigator — Stack navigator for the Garzón (waiter) flow.
 * Screens: GarzonList (main order list), OrderDetail.
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { GarzonStackParamList } from '../types/navigation';

import GarzonScreen from '../screens/garzon/GarzonScreen';
import OrderDetailScreen from '../screens/garzon/OrderDetailScreen';

const Stack = createStackNavigator<GarzonStackParamList>();

export default function GarzonNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="GarzonList"
        component={GarzonScreen}
        options={{ title: 'Órdenes' }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          title: 'Detalle de orden',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}
