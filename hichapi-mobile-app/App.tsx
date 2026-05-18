/**
 * App.tsx — Root component for HiChapi Mobile App.
 */

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { RealtimeProvider } from './contexts/RealtimeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <AuthProvider>
            <RealtimeProvider>
              <CartProvider>
                <AppNavigator />
              </CartProvider>
            </RealtimeProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
