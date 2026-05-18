/**
 * ProfileScreen — user profile, app info, and settings.
 *
 * Features:
 * - User email, role, and restaurant name
 * - Logout button
 * - App version
 * - "Ver tutorial" button to replay onboarding
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAuth } from '../hooks/useAuth';
import { useRestaurant } from '../hooks/useRestaurant';
import { STORAGE_KEYS } from '../utils/constants';
import OnboardingScreen from './onboarding/OnboardingScreen';

// ---------------------------------------------------------------------------
// Role labels (Spanish)
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  garzon: 'Garzón',
  waiter: 'Garzón',
  super_admin: 'Super Admin',
};

function getRoleLabel(role?: string): string {
  if (!role) return 'Usuario';
  return ROLE_LABELS[role] ?? role;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { role: userRole, restaurantName } = useRestaurant();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const email = user?.email ?? '—';
  const role = getRoleLabel(userRole);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'No se pudo cerrar sesión. Intenta nuevamente.');
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  }, [logout]);

  // -------------------------------------------------------------------------
  // Tutorial
  // -------------------------------------------------------------------------

  const handleViewTutorial = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
    setShowTutorial(true);
  }, []);

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
  }, []);

  // -------------------------------------------------------------------------
  // Show tutorial overlay
  // -------------------------------------------------------------------------

  if (showTutorial) {
    return (
      <OnboardingScreen
        onComplete={handleTutorialComplete}
        isTutorial
      />
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ------------------------------------------------------------------ */}
      {/* User info card                                                      */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.card}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {email.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Correo</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {email}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Rol</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{role}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Restaurante</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {restaurantName}
          </Text>
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Actions card                                                        */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleViewTutorial}
          accessibilityLabel="Ver tutorial de la aplicación"
          accessibilityRole="button"
        >
          <Text style={styles.actionIcon}>🎓</Text>
          <Text style={styles.actionText}>Ver tutorial</Text>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* App info card                                                       */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Versión</Text>
          <Text style={styles.infoValue}>{appVersion}</Text>
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Logout button                                                       */}
      {/* ------------------------------------------------------------------ */}
      <TouchableOpacity
        style={[styles.logoutButton, loggingOut && styles.logoutButtonDisabled]}
        onPress={handleLogout}
        disabled={loggingOut}
        accessibilityLabel="Cerrar sesión"
        accessibilityRole="button"
      >
        {loggingOut ? (
          <ActivityIndicator size="small" color="#EF4444" />
        ) : (
          <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  roleBadge: {
    backgroundColor: '#FFF3EE',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#FFD4C2',
  },
  roleBadgeText: {
    fontSize: 12,
    color: '#CC4A1A',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  actionChevron: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 8,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
});
