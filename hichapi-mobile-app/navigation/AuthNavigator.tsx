/**
 * AuthNavigator — Stack navigator for the authentication flow.
 * Screens: Login, Register, PasswordRecovery.
 *
 * - Login: no header (full-screen branding)
 * - Register: header with back button
 * - PasswordRecovery: header with back button
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { AuthStackParamList } from '../types/navigation';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import PasswordRecoveryScreen from '../screens/auth/PasswordRecoveryScreen';

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          title: 'Crear cuenta',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="PasswordRecovery"
        component={PasswordRecoveryScreen}
        options={{
          title: 'Recuperar contraseña',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}
