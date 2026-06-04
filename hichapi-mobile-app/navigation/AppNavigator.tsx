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
import { useAppRole } from '../hooks/useAppRole';
import { STORAGE_KEYS } from '../utils/constants';
import type { RootStackParamList } from '../types/navigation';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import CustomerNavigator from './CustomerNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import ClientNavigator from './ClientNavigator';
import RiderNavigator from './RiderNavigator';

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

import Constants from 'expo-constants';

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { session, loading } = useAuth();
  const { role, loading: roleLoading } = useAppRole();
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

  // Show loading indicator while auth state, onboarding check, or role is pending
  if (loading || !onboardingChecked || (session !== null && roleLoading)) {
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

  const IS_STAFF = Constants.expoConfig?.extra?.variant === 'staff';

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session === null ? (
          <>
            <Stack.Screen name="Auth" component={AuthNavigator} />
            {!IS_STAFF && (
              <Stack.Screen name="Client" component={ClientNavigator} />
            )}
          </>
        ) : IS_STAFF ? (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="Rider" component={RiderNavigator} />
          </>
        ) : (
          <>
            <Stack.Screen name="Customer" component={CustomerNavigator} />
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
