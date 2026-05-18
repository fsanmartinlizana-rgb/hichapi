/**
 * Password recovery screen for HiChapi Mobile App.
 * Sends a password reset email via AuthService.recoverPassword().
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';
import { authService } from '../../services/auth/AuthService';
import type { PasswordRecoveryScreenProps } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const recoverySchema = z.object({
  email: z
    .string()
    .min(1, 'El correo es requerido')
    .email('Ingresa un correo válido'),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PasswordRecoveryScreen({ navigation }: PasswordRecoveryScreenProps) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  const validate = (): boolean => {
    const result = recoverySchema.safeParse({ email });
    if (!result.success) {
      setEmailError(result.error.issues[0]?.message ?? 'Correo inválido');
      return false;
    }
    setEmailError(null);
    return true;
  };

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const handleSubmit = async () => {
    setRequestError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      await authService.recoverPassword(email.trim().toLowerCase());
      setSuccess(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error al enviar instrucciones';
      setRequestError(
        message.includes('User not found')
          ? 'No encontramos una cuenta con ese correo'
          : 'No se pudo enviar el correo. Intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Success state
  // -------------------------------------------------------------------------

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>📧</Text>
        <Text style={styles.successTitle}>Revisa tu correo electrónico</Text>
        <Text style={styles.successMessage}>
          Te enviamos instrucciones para restablecer tu contraseña a{' '}
          <Text style={styles.emailHighlight}>{email}</Text>.
        </Text>
        <Text style={styles.successHint}>
          Si no ves el correo, revisa tu carpeta de spam.
        </Text>
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

  // -------------------------------------------------------------------------
  // Form state
  // -------------------------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back navigation */}
        <TouchableOpacity
          style={styles.backNavButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Volver atrás"
          accessibilityHint="Toca para regresar a la pantalla anterior"
          accessibilityRole="button"
        >
          <Text style={styles.backNavText}>← Volver</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Recuperar contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={[styles.input, emailError ? styles.inputError : null]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError(null);
              }}
              placeholder="tu@correo.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              accessibilityLabel="Campo de correo electrónico"
              accessibilityHint="Ingresa el correo asociado a tu cuenta"
            />
            {emailError ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {emailError}
              </Text>
            ) : null}
          </View>

          {/* Request error */}
          {requestError ? (
            <View style={styles.requestErrorContainer}>
              <Text style={styles.requestErrorText} accessibilityRole="alert">
                {requestError}
              </Text>
            </View>
          ) : null}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.button, loading ? styles.buttonDisabled : null]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityLabel="Enviar instrucciones de recuperación"
            accessibilityHint="Toca para recibir instrucciones de recuperación en tu correo"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Enviar instrucciones</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backNavButton: {
    paddingVertical: 8,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  backNavText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '500',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#F9FAFB',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 4,
  },
  requestErrorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  requestErrorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
  },
  button: {
    height: 50,
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#FF6B3580',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Success state styles
  successContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    fontSize: 56,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  emailHighlight: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
  successHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
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
