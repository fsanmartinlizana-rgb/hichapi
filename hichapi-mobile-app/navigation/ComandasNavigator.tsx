/**
 * ComandasNavigator — Stack navigator for the Comandas (kitchen board) flow.
 * Screens: ComandasBoard (kanban board), ItemDetail (placeholder).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import type { ComandasStackParamList, ItemDetailScreenProps } from '../types/navigation';

import ComandasScreen from '../screens/comandas/ComandasScreen';

/** Inline placeholder for ItemDetail — will be replaced in a later task. */
function ItemDetailScreen({ route }: ItemDetailScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>ItemDetailScreen</Text>
      <Text style={styles.subtitle}>Item ID: {route.params.itemId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 18,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});

const Stack = createStackNavigator<ComandasStackParamList>();

export default function ComandasNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ComandasBoard"
        component={ComandasScreen}
        options={{ title: 'Comandas' }}
      />
      <Stack.Screen
        name="ItemDetail"
        component={ItemDetailScreen}
        options={{
          title: 'Detalle de ítem',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}
