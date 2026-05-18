/**
 * AppNavigator — Root navigator for HiChapi Mobile App.
 *
 * Routing logic:
 *  - loading === true  → LoadingScreen
 *  - onboarding not completed → OnboardingNavigator
 *  - session === null  → AuthNavigator
 *  - session !== null  → MainNavigator
 *
 * Also configures deep link handling for push notification taps.
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../hooks/useAuth';
import { STORAGE_KEYS } from '../utils/constants';
import type { RootStackParamList } from '../types/navigation';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import ClientNavigator from './ClientNavigator';

// ---------------------------------------------------------------------------
// Deep link configuration (task 6.8)
// ---------------------------------------------------------------------------

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['hichapi://'],
  config: {
    screens: {
      Main: {
        screens: {
          Garzon: {
            screens: { OrderDetail: 'order/:orderId' },
          },
          Mesas: {
            screens: { TableDetail: 'table/:tableId' },
          },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Loading screen
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root stack
// ---------------------------------------------------------------------------

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { session, loading } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Check AsyncStorage for onboarding completion on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED)
      .then((value) => {
        setOnboardingCompleted(value === 'true');
      })
      .catch(() => {
        setOnboardingCompleted(false);
      })
      .finally(() => {
        setOnboardingChecked(true);
      });
  }, []);

  // Show loading indicator while auth state or onboarding check is pending
  if (loading || !onboardingChecked) {
    return <LoadingScreen />;
  }

  // Onboarding not yet completed — show onboarding flow
  if (!onboardingCompleted) {
    return (
      <OnboardingNavigator
        onComplete={() => setOnboardingCompleted(true)}
      />
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session === null ? (
          <>
            <Stack.Screen name="Auth" component={AuthNavigator} />
            <Stack.Screen name="Client" component={ClientNavigator} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="Client" component={ClientNavigator} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
