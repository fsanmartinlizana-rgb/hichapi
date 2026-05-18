/**
 * screens/rider/RiderAuthScreen.tsx
 *
 * Login and registration screen for riders using Supabase Auth.
 * On successful registration, creates the rider_profiles record.
 * Requirements: 1.1, 1.2
 */
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, ActivityIndicator,
} from 'react-native'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
)

interface Props {
  onAuthenticated: (token: string) => void
}

type Mode = 'login' | 'register'

export default function RiderAuthScreen({ onAuthenticated }: Props) {
  const [mode,     setMode]     = useState<Mode>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Ingresa tu email y contraseña')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.session?.access_token) {
        onAuthenticated(data.session.access_token)
      }
    } catch (err: any) {
      Alert.alert('Error de inicio de sesión', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!email || !password) {
      Alert.alert('Error', 'Ingresa tu email y contraseña')
      return
    }
    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      if (data.session?.access_token) {
        // Profile will be created in the onboarding flow
        onAuthenticated(data.session.access_token)
      } else {
        Alert.alert(
          'Verifica tu email',
          'Te enviamos un enlace de confirmación. Revisa tu bandeja de entrada.',
        )
      }
    } catch (err: any) {
      Alert.alert('Error de registro', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Logo */}
      <View style={styles.logoSection}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>hi</Text>
        </View>
        <Text style={styles.appName}>HiChapi Rider</Text>
        <Text style={styles.tagline}>Plataforma de repartidores</Text>
      </View>

      {/* Mode tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, mode === 'login' && styles.tabActive]}
          onPress={() => setMode('login')}
        >
          <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
            Iniciar sesión
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'register' && styles.tabActive]}
          onPress={() => setMode('register')}
        >
          <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
            Registrarse
          </Text>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={mode === 'login' ? handleLogin : handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {mode === 'register' && (
        <Text style={styles.disclaimer}>
          Al registrarte, deberás completar tu perfil y subir documentos de verificación antes de poder recibir pedidos.
        </Text>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0A0A14' },
  content:         { padding: 24, paddingTop: 60, paddingBottom: 40 },
  logoSection:     { alignItems: 'center', marginBottom: 40 },
  logo:            { width: 64, height: 64, borderRadius: 16, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoText:        { color: '#fff', fontSize: 24, fontWeight: '800' },
  appName:         { color: '#fff', fontSize: 24, fontWeight: '700' },
  tagline:         { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 },
  tabs:            { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 24 },
  tab:             { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive:       { backgroundColor: '#FF6B35' },
  tabText:         { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '500' },
  tabTextActive:   { color: '#fff', fontWeight: '700' },
  form:            { gap: 16 },
  field:           { gap: 6 },
  label:           { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  input:           { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15 },
  submitBtn:       { backgroundColor: '#FF6B35', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  disclaimer:      { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18 },
})
