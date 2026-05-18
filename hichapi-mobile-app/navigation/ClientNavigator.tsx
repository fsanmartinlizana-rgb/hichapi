/**
 * ClientNavigator — Stack navigator for the customer-facing flow.
 * Screens: QRScanner, ClientMenu, Cart, SplitPayment.
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { ClientStackParamList } from '../types/navigation';

import QRScannerScreen from '../screens/client/QRScannerScreen';
import ClientChatScreen from '../screens/client/ClientChatScreen';
import ClientMenuScreen from '../screens/client/ClientMenuScreen';
import CartScreen from '../screens/client/CartScreen';
import SplitPaymentScreen from '../screens/client/SplitPaymentScreen';

const Stack = createStackNavigator<ClientStackParamList>();

export default function ClientNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{ 
          title: 'Escanear QR',
          headerShown: false // Often handled by the screen overlay
        }}
      />
      <Stack.Screen
        name="ClientChat"
        component={ClientChatScreen}
        options={{ 
          headerShown: false 
        }}
      />
      <Stack.Screen
        name="ClientMenu"
        component={ClientMenuScreen}
        options={{ 
          title: 'Menú',
          headerBackTitleVisible: false 
        }}
      />
      <Stack.Screen
        name="Cart"
        component={CartScreen}
        options={{ 
          title: 'Carrito',
          headerBackTitleVisible: false 
        }}
      />
      <Stack.Screen
        name="SplitPayment"
        component={SplitPaymentScreen}
        options={{ 
          title: 'Dividir cuenta',
          headerBackTitleVisible: false 
        }}
      />
    </Stack.Navigator>
  );
}
