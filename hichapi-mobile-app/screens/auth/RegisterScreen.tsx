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
import type { RegisterScreenProps } from '../../types/navigation';

const registerSchema = z.object({
  name: z.string().min(2, 'Ingresa tu nombre completo'),
  email: z.string().min(1, 'El correo es requerido').email('Ingresa un correo válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type RegisterFormErrors = {
  name?: string;
  email?: string;
  password?: string;
};

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { registerCustomer } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegisterFormErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const result = registerSchema.safeParse({ name, email, password });
    if (!result.success) {
      const errors: RegisterFormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof RegisterFormErrors;
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

  const handleSubmit = async () => {
    setAuthError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      await registerCustomer(name.trim(), email.trim().toLowerCase(), password);
      // It will automatically log in and AppNavigator will route correctly
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Error al registrarte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>Únete a HiChapi para pedir y reservar</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput
              style={[styles.input, fieldErrors.name ? styles.inputError : null]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (fieldErrors.name) setFieldErrors((e) => ({ ...e, name: undefined }));
              }}
              placeholder="Ej: Juan Pérez"
              placeholderTextColor="#9CA3AF"
            />
            {fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}
          </View>

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
            />
            {fieldErrors.email && <Text style={styles.errorText}>{fieldErrors.email}</Text>}
          </View>

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
            />
            {fieldErrors.password && <Text style={styles.errorText}>{fieldErrors.password}</Text>}
          </View>

          {authError && (
            <View style={styles.authErrorContainer}>
              <Text style={styles.authErrorText}>{authError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading ? styles.buttonDisabled : null]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Registrarme</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40 },
  backButton: { marginTop: 20, marginBottom: 20 },
  header: { marginBottom: 30 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  form: { width: '100%' },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  input: {
    height: 48, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 14, fontSize: 16, color: '#1a1a1a', backgroundColor: '#F9FAFB'
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  errorText: { fontSize: 13, color: '#EF4444', marginTop: 4 },
  authErrorContainer: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  authErrorText: { fontSize: 14, color: '#DC2626', textAlign: 'center' },
  button: { height: 50, backgroundColor: '#FF6B35', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonDisabled: { backgroundColor: '#FF6B3580' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
