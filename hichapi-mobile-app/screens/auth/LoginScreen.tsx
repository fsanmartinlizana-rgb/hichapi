/**
 * Login screen for HiChapi Mobile App.
 * Provides email/password authentication with Zod validation and inline errors.
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
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import type { LoginScreenProps } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El correo es requerido')
    .email('Ingresa un correo válido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormErrors = {
  email?: string;
  password?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFormErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  const validate = (): boolean => {
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: LoginFormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof LoginFormErrors;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const handleSubmit = async () => {
    setAuthError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // Navigation is handled by AppNavigator reacting to auth state change
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error al iniciar sesión';
      // Provide a user-friendly message for common Supabase errors
      if (message.includes('Invalid login credentials')) {
        setAuthError('Correo o contraseña incorrectos');
      } else if (message.includes('Email not confirmed')) {
        setAuthError('Debes confirmar tu correo antes de iniciar sesión');
      } else {
        setAuthError('No se pudo iniciar sesión. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>hi</Text>
          </View>
          <Text style={styles.title}>HiChapi</Text>
          <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={[styles.input, fieldErrors.email ? styles.inputError : null]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: undefined }));
              }}
              placeholder="tu@correo.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              accessibilityLabel="Campo de correo electrónico"
              accessibilityHint="Ingresa tu correo electrónico"
            />
            {fieldErrors.email ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {fieldErrors.email}
              </Text>
            ) : null}
          </View>

          {/* Password field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={[styles.input, fieldErrors.password ? styles.inputError : null]}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
              }}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              accessibilityLabel="Campo de contraseña"
              accessibilityHint="Ingresa tu contraseña"
            />
            {fieldErrors.password ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {fieldErrors.password}
              </Text>
            ) : null}
          </View>

          {/* Auth error */}
          {authError ? (
            <View style={styles.authErrorContainer}>
              <Text style={styles.authErrorText} accessibilityRole="alert">
                {authError}
              </Text>
            </View>
          ) : null}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.button, loading ? styles.buttonDisabled : null]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityLabel="Iniciar sesión"
            accessibilityHint="Toca para iniciar sesión con tu correo y contraseña"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Iniciar sesión</Text>
            )}
          </TouchableOpacity>

          {/* Forgot password link */}
          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => navigation.navigate('PasswordRecovery')}
            accessibilityLabel="¿Olvidaste tu contraseña?"
            accessibilityHint="Toca para recuperar tu contraseña"
            accessibilityRole="button"
          >
            <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Client flow entry point */}
          <TouchableOpacity
            style={styles.guestButton}
            onPress={() => navigation.navigate('Client')}
            accessibilityLabel="Escanear QR de mesa"
            accessibilityHint="Toca para escanear el código QR de tu mesa y ver el menú"
            accessibilityRole="button"
          >
            <Ionicons name="qr-code-outline" size={20} color="#FF6B35" style={styles.buttonIcon} />
            <Text style={styles.guestButtonText}>Escanear QR de mesa</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
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
  authErrorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  authErrorText: {
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
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9CA3AF',
    fontSize: 14,
  },
  guestButton: {
    height: 50,
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  guestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
  },
  buttonIcon: {
    marginRight: 8,
  },
});
