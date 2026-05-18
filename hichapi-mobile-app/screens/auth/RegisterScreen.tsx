/**
 * Register screen for HiChapi Mobile App.
 * Staff accounts are created by administrators on the web platform.
 * This screen is informational only.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { RegisterScreenProps } from '../../types/navigation';

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  return (
    <View style={styles.container}>
      {/* Icon placeholder */}
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🔐</Text>
      </View>

      {/* Message */}
      <Text style={styles.title}>Cuentas de equipo</Text>
      <Text style={styles.message}>
        El administrador crea las cuentas del equipo desde la plataforma web de HiChapi.
      </Text>
      <Text style={styles.hint}>
        Si necesitas acceso, contacta al administrador de tu restaurante.
      </Text>

      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Volver al inicio de sesión"
        accessibilityHint="Toca para regresar a la pantalla de inicio de sesión"
        accessibilityRole="button"
      >
        <Text style={styles.backButtonText}>Volver al inicio de sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  backButton: {
    height: 50,
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    minWidth: 220,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
