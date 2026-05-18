/**
 * MesasNavigator — Stack navigator for the Mesas (tables) flow.
 * Screens: MesasGrid (table grid), TableDetail, QRGenerator.
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { MesasStackParamList } from '../types/navigation';

import MesasScreen from '../screens/mesas/MesasScreen';
import TableDetailScreen from '../screens/mesas/TableDetailScreen';
import QRGeneratorScreen from '../screens/mesas/QRGeneratorScreen';

const Stack = createStackNavigator<MesasStackParamList>();

export default function MesasNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MesasGrid"
        component={MesasScreen}
        options={{ title: 'Mesas' }}
      />
      <Stack.Screen
        name="TableDetail"
        component={TableDetailScreen}
        options={{
          title: 'Detalle de mesa',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="QRGenerator"
        component={QRGeneratorScreen}
        options={{
          title: 'Código QR',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}
